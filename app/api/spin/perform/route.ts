// app/api/spin/perform/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { performSpin } from '@/app/actions/spin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const spinAmountKes = body.spinAmount || 30; // Default to KES 30
    
    const result = await performSpin(spinAmountKes);
    return NextResponse.json(result);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
