/**
 * Knowledge Base Initialization
 * Seeds the knowledge base with default documents (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { seedKnowledgeBase } from '@/app/lib/services/knowledge-base';

export async function POST(request: NextRequest) {
  try {
    // Only allow admins to seed knowledge base
    const session = await auth().catch(() => null);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Only admins can seed the knowledge base' },
        { status: 403 }
      );
    }

    await seedKnowledgeBase();

    return NextResponse.json({
      success: true,
      message: 'Knowledge base seeded successfully',
    });
  } catch (error) {
    console.error('[KB Init] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to seed knowledge base',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Status endpoint
  return NextResponse.json({ status: 'ready', service: 'knowledge-base' });
}
