import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, ChatForeignersBot, Profile } from '@/app/lib/models';
import { auth } from '@/auth';

async function checkAdminAccess() {
  const session = await auth();
  if (!session?.user?.email) {
    return { authorized: false, error: 'Unauthorized' };
  }

  await connectToDatabase();
  const adminUser = await Profile.findOne({ email: session.user.email }).select('role').lean();
  if (adminUser?.role !== 'admin') {
    return { authorized: false, error: 'Admin access required' };
  }

  return { authorized: true };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authCheck = await checkAdminAccess();
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: 403 });
    }

    await connectToDatabase();
    const botId = params.id;

    const bot = await ChatForeignersBot.findById(botId);
    if (!bot) {
      return NextResponse.json(
        { success: false, error: 'Bot not found' },
        { status: 404 }
      );
    }

    // Parse training data if it's a string
    let trainingData = bot.training_data;
    if (typeof trainingData === 'string') {
      try {
        trainingData = JSON.parse(trainingData);
      } catch {
        trainingData = {};
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        botId: bot._id.toString(),
        botName: bot.name,
        trainingData: trainingData || {},
      },
    });
  } catch (error) {
    console.error('[API] Training data fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch training data',
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authCheck = await checkAdminAccess();
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: 403 });
    }

    await connectToDatabase();
    const botId = params.id;
    const body = await request.json();
    const { trainingData } = body;

    if (!trainingData || typeof trainingData !== 'object') {
      return NextResponse.json(
        { success: false, error: 'trainingData must be a valid JSON object' },
        { status: 400 }
      );
    }

    const bot = await ChatForeignersBot.findById(botId);
    if (!bot) {
      return NextResponse.json(
        { success: false, error: 'Bot not found' },
        { status: 404 }
      );
    }

    // Store training data as JSON string
    bot.training_data = JSON.stringify(trainingData);
    await bot.save();

    return NextResponse.json({
      success: true,
      data: {
        botId: bot._id.toString(),
        botName: bot.name,
        trainingData: JSON.parse(bot.training_data),
      },
      message: 'Training data updated successfully',
    });
  } catch (error) {
    console.error('[API] Training data update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update training data',
      },
      { status: 500 }
    );
  }
}
