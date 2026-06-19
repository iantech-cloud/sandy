import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { connectToDatabase } from '@/app/lib/mongoose';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    await connectToDatabase();
    return NextResponse.json({
      success: true,
      data: {
        total_referrals: 0,
        pending_bonuses_cents: 0,
        paid_bonuses_cents: 0,
        referral_link: `${process.env.NEXTAUTH_URL}?ref=${session.user?.id || 'UNKNOWN'}`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    await connectToDatabase();
    return NextResponse.json({ success: true, message: 'Referral tracked' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
