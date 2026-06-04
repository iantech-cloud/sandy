import { NextRequest, NextResponse } from 'next/server';
import { updateChatForeignersBot, deleteChatForeignersBot } from '@/app/actions/chat-foreigners/bots';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const result = await updateChatForeignersBot(params.id, body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Bot update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update bot',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await deleteChatForeignersBot(params.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Bot delete error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete bot',
      },
      { status: 500 }
    );
  }
}
