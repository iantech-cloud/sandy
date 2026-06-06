import { NextRequest, NextResponse } from 'next/server';
import { closeChat } from '@/app/actions/chat-foreigners/payments';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { botId } = body;

    if (!botId) {
      return NextResponse.json(
        { success: false, error: 'Missing botId' },
        { status: 400 }
      );
    }

    const result = await closeChat(botId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Close chat error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      },
      { status: 500 }
    );
  }
}
