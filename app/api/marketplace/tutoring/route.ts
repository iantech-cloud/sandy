import { connectToDatabase } from '@/app/lib/models';
import { TutoringSession } from '@/app/lib/models/RevenueStreams';
import { getSession } from 'next-auth/react';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const subject = searchParams.get('subject');
    const level = searchParams.get('level');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const query: any = { status: 'scheduled' };
    if (subject) query.subject = new RegExp(subject, 'i');
    if (level) query.level = level;

    const skip = (page - 1) * limit;

    const sessions = await TutoringSession.find(query)
      .sort({ scheduled_at: 1 })
      .skip(skip)
      .limit(limit)
      .populate('tutor_id', 'username email')
      .populate('student_id', 'username email');

    const total = await TutoringSession.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: sessions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('[Tutoring API] GET error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * Schedule a tutoring session
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const session = await getSession({ req });

    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Unauthorized' 
      }, { status: 401 });
    }

    const {
      tutor_id,
      subject,
      level,
      rate_per_hour,
      duration_minutes,
      scheduled_at,
      notes
    } = body;

    if (!tutor_id || !subject || !level || !rate_per_hour || !duration_minutes || !scheduled_at) {
      return NextResponse.json({ 
        success: false, 
        message: 'Missing required fields' 
      }, { status: 400 });
    }

    const levels = ['primary', 'secondary', 'high_school', 'university', 'professional'];
    if (!levels.includes(level)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid level' 
      }, { status: 400 });
    }

    if (rate_per_hour < 500) {
      return NextResponse.json({ 
        success: false, 
        message: 'Minimum rate is KES 500/hour' 
      }, { status: 400 });
    }

    // Calculate total cost
    const hoursFraction = duration_minutes / 60;
    const rateCents = Math.round(rate_per_hour * 100);
    const totalCostCents = Math.round(rateCents * hoursFraction);
    
    // Commission: 15% for HustleHub
    const commissionCents = Math.round(totalCostCents * 0.15);
    const tutorEarningsCents = totalCostCents - commissionCents;

    const tutoringSession = new TutoringSession({
      tutor_id,
      student_id: session.user.id,
      subject,
      level,
      rate_per_hour_cents: rateCents,
      duration_minutes,
      total_cost_cents: totalCostCents,
      scheduled_at: new Date(scheduled_at),
      tutor_earnings_cents: tutorEarningsCents,
      hustlehub_commission_cents: commissionCents,
      notes,
      status: 'scheduled'
    });

    await tutoringSession.save();

    return NextResponse.json({
      success: true,
      message: 'Tutoring session scheduled successfully',
      data: tutoringSession
    });
  } catch (error: any) {
    console.error('[Tutoring Session API] POST error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * Complete tutoring session and submit rating
 */
export async function PUT(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const session = await getSession({ req });

    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Unauthorized' 
      }, { status: 401 });
    }

    const { session_id, rating, review } = body;

    if (!session_id || !rating) {
      return NextResponse.json({ 
        success: false, 
        message: 'Missing required fields' 
      }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ 
        success: false, 
        message: 'Rating must be between 1 and 5' 
      }, { status: 400 });
    }

    const tutoringSession = await TutoringSession.findById(session_id);
    if (!tutoringSession) {
      return NextResponse.json({ 
        success: false, 
        message: 'Session not found' 
      }, { status: 404 });
    }

    if (tutoringSession.student_id !== session.user.id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Unauthorized' 
      }, { status: 401 });
    }

    // Update session
    tutoringSession.completed_at = new Date();
    tutoringSession.status = 'completed';
    tutoringSession.student_rating = rating;
    tutoringSession.student_review = review || '';
    await tutoringSession.save();

    return NextResponse.json({
      success: true,
      message: 'Session completed and rated',
      data: tutoringSession
    });
  } catch (error: any) {
    console.error('[Complete Tutoring Session API] PUT error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * GET /api/marketplace/tutoring/my-profile
 */
export async function PATCH(req: NextRequest) {
  try {
    await connectToDatabase();

    const session = await getSession({ req });
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Unauthorized' 
      }, { status: 401 });
    }

    // Get tutor stats
    const sessions = await TutoringSession.find({
      tutor_id: session.user.id
    });

    const completedSessions = sessions.filter(s => s.status === 'completed');
    const totalEarnings = completedSessions.reduce((sum, s) => sum + (s.tutor_earnings_cents || 0), 0);
    const averageRating = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + (s.student_rating || 0), 0) / completedSessions.length
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        total_sessions: sessions.length,
        completed_sessions: completedSessions.length,
        total_earnings_cents: totalEarnings,
        average_rating: parseFloat(averageRating.toFixed(1)),
        upcoming_sessions: sessions.filter(s => s.status === 'scheduled' && new Date(s.scheduled_at) > new Date())
      }
    });
  } catch (error: any) {
    console.error('[Tutor Profile API] error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}
