import { NextRequest, NextResponse } from 'next/server';
import { listChatForeignersBots, getUserBotAccess, checkBotAccess, getBotDetails, createChatForeignersBot, updateChatForeignersBot, deleteChatForeignersBot } from '@/app/actions/chat-foreigners/bots';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'list';
    const botId = searchParams.get('botId');

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
