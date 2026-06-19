import { connectToDatabase } from '@/app/lib/models';
import { FreelanceJob } from '@/app/lib/models/RevenueStreams';
import { getSession } from 'next-auth/react';
import { NextRequest, NextResponse } from 'next/server';

const ASSIGNMENT_CATEGORIES = [
  'homework_help',
  'research_paper',
  'essay_writing',
  'tutoring',
  'editing',
  'exam_prep',
  'project_help',
  'code_assignment'
];

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const level = searchParams.get('level');
    const subject = searchParams.get('subject');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const query: any = { 
      status: 'open',
      category: { $in: ASSIGNMENT_CATEGORIES }
    };

    if (level) query.level = level;
    if (subject) query.subject = new RegExp(subject, 'i');

    const skip = (page - 1) * limit;

    const assignments = await FreelanceJob.find(query)
      .sort({ deadline: 1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('client_id', 'username email');

    const total = await FreelanceJob.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: assignments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('[Assignment API] GET error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

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
      title, 
      description, 
      assignment_type, 
      level,
      subject,
      budget, 
      deadline,
      files_url
    } = body;

    if (!title || !description || !assignment_type || !budget || !deadline) {
      return NextResponse.json({ 
        success: false, 
        message: 'Missing required fields' 
      }, { status: 400 });
    }

    if (!ASSIGNMENT_CATEGORIES.includes(assignment_type)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid assignment type' 
      }, { status: 400 });
    }

    // Commission: 15% for HustleHub, 85% for tutor
    const budgetCents = Math.round(budget * 100);
    const commissionCents = Math.round(budgetCents * 0.15);
    const tutorEarningsCents = budgetCents - commissionCents;

    const assignment = new FreelanceJob({
      title,
      description,
      category: assignment_type,
      level,
      subject,
      budget_cents: budgetCents,
      client_id: session.user.id,
      deadline: new Date(deadline),
      commission_cents: commissionCents,
      freelancer_earnings_cents: tutorEarningsCents,
      status: 'open',
      metadata: {
        assignment_type,
        files_url,
        level,
        subject
      }
    });

    await assignment.save();

    return NextResponse.json({
      success: true,
      message: 'Assignment posted successfully',
      data: assignment
    });
  } catch (error: any) {
    console.error('[Assignment API] POST error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * GET /api/marketplace/assignments/categories
 */
export async function PATCH(req: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      data: {
        categories: ASSIGNMENT_CATEGORIES,
        levels: ['primary', 'secondary', 'high_school', 'university', 'professional'],
        common_subjects: [
          'Mathematics',
          'Physics',
          'Chemistry',
          'Biology',
          'English',
          'History',
          'Economics',
          'Computer Science',
          'Programming',
          'Data Science',
          'Business',
          'Finance'
        ]
      }
    });
  } catch (error: any) {
    console.error('[Assignment Categories API] error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}
