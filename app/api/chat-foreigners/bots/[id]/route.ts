import { NextRequest, NextResponse } from 'next/server';
import { updateChatForeignersBot, deleteChatForeignersBot } from '@/app/actions/chat-foreigners/bots';
import { auth } from '@/auth';
import { connectToDatabase, Profile } from '@/app/lib/models';

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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authCheck = await checkAdminAccess();
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: 403 });
    }

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
    const authCheck = await checkAdminAccess();
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: 403 });
    }

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
