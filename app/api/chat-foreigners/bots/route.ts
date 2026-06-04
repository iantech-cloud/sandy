import { NextRequest, NextResponse } from 'next/server';
import { listChatForeignersBots, getUserBotAccess, checkBotAccess, getBotDetails } from '@/app/actions/chat-foreigners/bots';

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
