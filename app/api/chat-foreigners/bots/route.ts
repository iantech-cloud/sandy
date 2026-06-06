import { NextRequest, NextResponse } from 'next/server';
import { listChatForeignersBots, getUserBotAccess, checkBotAccess, getBotDetails, createChatForeignersBot, updateChatForeignersBot, deleteChatForeignersBot } from '@/app/actions/chat-foreigners/bots';
import { connectToDatabase, ChatForeignersBot, ChatForeignersBotAccess } from '@/app/lib/models';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'list';
    const botId = searchParams.get('botId');
    const includeAccess = searchParams.get('includeAccess') === 'true';

    if (type === 'access') {
      const result = await getUserBotAccess();
      return NextResponse.json(result);
    }

    if (type === 'check' && botId) {
      const result = await checkBotAccess(botId);
      return NextResponse.json(result);
    }

    if (type === 'details' && botId) {
      const result = await getBotDetails(botId);
      return NextResponse.json(result);
    }

    // Admin mode: include full access data for each person
    if (includeAccess) {
      await connectToDatabase();
      const bots = await ChatForeignersBot.find({ isActive: true }).sort({ created_at: -1 }).lean();
      const allAccesses = await ChatForeignersBotAccess.find({}).lean();

      const botsWithAccess = bots.map((bot: any) => {
        const botAccess = allAccesses.filter(
          (a: any) => a.bot_id?.toString() === bot._id.toString()
        );
        return {
          _id: bot._id.toString(),
          id: bot._id.toString(),
          name: bot.name,
          username: bot.username,
          bio: bot.bio,
          avatar_url: bot.avatar_url,
          unlockPrice: bot.unlockCost_cents / 100,
          unlockCost_cents: bot.unlockCost_cents,
          category: bot.category,
          isActive: bot.isActive,
          userAccess: botAccess.map((a: any) => ({
            _id: a._id.toString(),
            userId: a.user_id?.toString(),
            botId: a.bot_id?.toString(),
            messageCount: a.messageCount,
            firstMilestoneComplete: a.firstMilestoneComplete,
            createdAt: a.created_at,
          })),
        };
      });

      return NextResponse.json({ success: true, data: botsWithAccess });
    }

    const result = await listChatForeignersBots();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Bots fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createChatForeignersBot(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Bot creation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create bot',
      },
      { status: 500 }
    );
  }
}
