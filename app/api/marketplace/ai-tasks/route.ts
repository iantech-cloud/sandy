import { connectToDatabase } from '@/app/lib/models';
import { AITask, AITaskSubmission } from '@/app/lib/models/RevenueStreams';
import { getSession } from 'next-auth/react';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const task_type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const query: any = { status: 'open' };
    if (task_type) query.task_type = task_type;

    const skip = (page - 1) * limit;

    const tasks = await AITask.find(query)
      .sort({ deadline: 1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('company_id', 'username email');

    const total = await AITask.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: tasks,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('[AI Tasks API] GET error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * Create new AI task (for companies)
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
      task_type,
      reward_per_task,
      estimated_time_minutes,
      total_tasks,
      deadline,
      quality_threshold
    } = body;

    if (!title || !description || !task_type || !reward_per_task || !total_tasks || !deadline) {
      return NextResponse.json({ 
        success: false, 
        message: 'Missing required fields' 
      }, { status: 400 });
    }

    const task_types = ['data_labeling', 'image_annotation', 'transcription', 'prompt_evaluation', 'content_moderation', 'other'];
    if (!task_types.includes(task_type)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid task type' 
      }, { status: 400 });
    }

    const task = new AITask({
      title,
      description,
      task_type,
      company_id: session.user.id,
      reward_per_task_cents: Math.round(reward_per_task * 100),
      estimated_completion_time_minutes: estimated_time_minutes,
      total_tasks_available: total_tasks,
      deadline: new Date(deadline),
      quality_threshold: quality_threshold || 85,
      status: 'open'
    });

    await task.save();

    return NextResponse.json({
      success: true,
      message: 'AI task created successfully',
      data: task
    });
  } catch (error: any) {
    console.error('[AI Tasks Create API] POST error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * Submit task work
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

    const { task_id, submission_data } = body;

    if (!task_id || !submission_data) {
      return NextResponse.json({ 
        success: false, 
        message: 'Missing required fields' 
      }, { status: 400 });
    }

    const task = await AITask.findById(task_id);
    if (!task) {
      return NextResponse.json({ 
        success: false, 
        message: 'Task not found' 
      }, { status: 404 });
    }

    if (task.status !== 'open' || task.tasks_completed >= task.total_tasks_available) {
      return NextResponse.json({ 
        success: false, 
        message: 'Task is no longer available' 
      }, { status: 400 });
    }

    const submission = new AITaskSubmission({
      task_id,
      worker_id: session.user.id,
      submission_data,
      status: 'pending_review',
      earned_cents: task.reward_per_task_cents
    });

    await submission.save();

    // Increment completed count
    await AITask.findByIdAndUpdate(task_id, { $inc: { tasks_completed: 1 } });

    return NextResponse.json({
      success: true,
      message: 'Submission received and pending review',
      data: submission
    });
  } catch (error: any) {
    console.error('[AI Task Submission API] PUT error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}

/**
 * GET /api/marketplace/ai-tasks/my-earnings
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

    const submissions = await AITaskSubmission.find({
      worker_id: session.user.id
    }).sort({ created_at: -1 });

    const stats = {
      total_submissions: submissions.length,
      approved: submissions.filter(s => s.status === 'approved').length,
      pending_review: submissions.filter(s => s.status === 'pending_review').length,
      rejected: submissions.filter(s => s.status === 'rejected').length,
      total_earned_cents: submissions
        .filter(s => s.status === 'approved')
        .reduce((sum, s) => sum + (s.earned_cents || 0), 0)
    };

    return NextResponse.json({
      success: true,
      data: {
        submissions,
        stats
      }
    });
  } catch (error: any) {
    console.error('[My AI Task Earnings API] error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}
