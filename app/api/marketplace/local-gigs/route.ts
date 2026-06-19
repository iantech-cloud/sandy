import { connectToDatabase } from '@/app/lib/models';
import { LocalGig } from '@/app/lib/models/RevenueStreams';
import { getSession } from 'next-auth/react';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const location = searchParams.get('location');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const query: any = { status: 'available' };
    if (category) query.category = category;
    if (location) query.location = new RegExp(location, 'i');

    const skip = (page - 1) * limit;

    const gigs = await LocalGig.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('provider_id', 'username email');

    const total = await LocalGig.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: gigs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('[Local Gigs API] GET error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * Post a local gig
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
      title,
      description,
      category,
      location,
      rate,
      scheduled_date
    } = body;

    if (!title || !description || !category || !location || !rate) {
      return NextResponse.json({ 
        success: false, 
        message: 'Missing required fields' 
      }, { status: 400 });
    }

    const categories = ['tutoring', 'photography', 'delivery', 'repairs', 'social_media', 'other'];
    if (!categories.includes(category)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid category' 
      }, { status: 400 });
    }

    // Commission: 15% for HustleHub
    const rateCents = Math.round(rate * 100);
    const commissionCents = Math.round(rateCents * 0.15);

    const gig = new LocalGig({
      title,
      description,
      category,
      provider_id: session.user.id,
      location,
      rate_cents: rateCents,
      scheduled_date: scheduled_date ? new Date(scheduled_date) : null,
      hustlehub_commission_cents: commissionCents,
      status: 'available'
    });

    await gig.save();

    return NextResponse.json({
      success: true,
      message: 'Local gig posted successfully',
      data: gig
    });
  } catch (error: any) {
    console.error('[Local Gigs Post API] POST error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * Book a local gig (client booking)
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

    const { gig_id, scheduled_date } = body;

    if (!gig_id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Gig ID required' 
      }, { status: 400 });
    }

    const gig = await LocalGig.findById(gig_id);
    if (!gig) {
      return NextResponse.json({ 
        success: false, 
        message: 'Gig not found' 
      }, { status: 404 });
    }

    if (gig.status !== 'available') {
      return NextResponse.json({ 
        success: false, 
        message: 'Gig is no longer available' 
      }, { status: 400 });
    }

    // Update gig with booking
    gig.client_id = session.user.id;
    gig.status = 'booked';
    gig.scheduled_date = scheduled_date ? new Date(scheduled_date) : gig.scheduled_date;
    await gig.save();

    return NextResponse.json({
      success: true,
      message: 'Gig booked successfully',
      data: gig
    });
  } catch (error: any) {
    console.error('[Book Local Gig API] PUT error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}
