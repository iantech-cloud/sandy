import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongoose';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    return NextResponse.json({
      success: true,
      data: {
        freelance: { earnings: '85-90%', description: 'Freelance jobs' },
        tutoring: { earnings: '85%', description: 'Online tutoring' },
        digital_products: { earnings: '75-95%', description: 'Digital products store' },
        ai_tasks: { earnings: '80%', description: 'AI task marketplace' },
        local_gigs: { earnings: '85%', description: 'Local gigs' },
        affiliate: { earnings: '60-80%', description: 'Affiliate marketing' }
      },
      message: 'All marketplaces available'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
