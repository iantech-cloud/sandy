import { connectToDatabase } from '@/app/lib/models';
import { FreelanceJob } from '@/app/lib/models/RevenueStreams';
import { getSession } from 'next-auth/react';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status') || 'open';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const query: any = { status };
    if (category) query.category = category;

    const skip = (page - 1) * limit;

    const jobs = await FreelanceJob.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('client_id', 'username email');

    const total = await FreelanceJob.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: jobs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('[Freelance API] GET error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const body = await req.json();
    const session = await getSession({ req });

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { title, description, category, budget, deadline } = body;

    if (!title || !description || !category || !budget) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    // Commission calculation: 15% for HustleHub
    const budgetCents = Math.round(budget * 100);
    const commissionCents = Math.round(budgetCents * 0.15);
    const freelancerEarningsCents = budgetCents - commissionCents;

    const job = new FreelanceJob({
      title,
      description,
      category,
      budget_cents: budgetCents,
      client_id: session.user.id,
      deadline: deadline ? new Date(deadline) : null,
      commission_cents: commissionCents,
      freelancer_earnings_cents: freelancerEarningsCents,
      status: 'open'
    });

    await job.save();

    return NextResponse.json({
      success: true,
      message: 'Job posted successfully',
      data: job
    });
  } catch (error: any) {
    console.error('[Freelance API] POST error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
