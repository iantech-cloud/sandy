import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, ChatForeignersBot } from '@/app/lib/models';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const botId = params.id;

    const bot = await ChatForeignersBot.findById(botId);
    if (!bot) {
      return NextResponse.json(
        { success: false, error: 'Bot not found' },
        { status: 404 }
      );
    }

    // Generate unique username for clone
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const clonedUsername = `${bot.username}_${randomSuffix}`;

    const clonedBot = await ChatForeignersBot.create({
      name: bot.name,
      username: clonedUsername,
      avatar_url: bot.avatar_url,
      bio: bot.bio,
      personalityType: bot.personalityType,
      speakingStyle: bot.speakingStyle,
      mood: bot.mood,
      interests: bot.interests,
      unlockCost_cents: bot.unlockCost_cents,
      isActive: true,
      training_data: bot.training_data,
      cloned_from: botId,
    });

    return NextResponse.json({
      success: true,
      data: {
        _id: clonedBot._id.toString(),
        name: clonedBot.name,
        username: clonedBot.username,
        avatar: clonedBot.avatar_url,
        bio: clonedBot.bio,
        clonedFrom: botId,
      },
      message: `Bot cloned successfully with username: ${clonedUsername}`,
    });
  } catch (error) {
    console.error('[API] Bot clone error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clone bot',
      },
      { status: 500 }
    );
  }
}
