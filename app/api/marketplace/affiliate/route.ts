import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

import { connectToDatabase } from '@/app/lib/mongoose';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    return NextResponse.json({ success: true, data: [], message: 'Affiliate marketplace' });
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
    return NextResponse.json({ success: true, message: 'Affiliate created' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
