import { NextRequest, NextResponse } from 'next/server';
import { getChatForeignersProfile } from '@/app/actions/chat-foreigners/wallet';

export async function GET(request: NextRequest) {
  try {
    const result = await getChatForeignersProfile();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Profile fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      },
      { status: 500 }
    );
  }
}
