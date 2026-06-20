import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase, UserContent, Profile } from '@/app/lib/models';

export async function GET(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDatabase();
    
    // Get admin submissions - populate user info
    const submissions = await UserContent.find({})
      .populate('user_id', 'username email name')
      .populate('approved_by', 'username email name')
      .sort({ created_at: -1 })
      .lean()
      .exec();

    // Serialize documents to ensure proper JSON serialization
    const serialized = submissions.map((sub: any) => ({
      _id: sub._id?.toString() || '',
      title: sub.title || '',
      content_type: sub.content_type || '',
      status: sub.status || 'pending',
      payment_status: sub.payment_status || 'pending',
      payment_amount: sub.payment_amount || 0,
      submission_date: sub.created_at ? new Date(sub.created_at).toISOString() : new Date().toISOString(),
      task_category: sub.task_category || '',
      word_count: sub.word_count || 0,
      user: {
        _id: sub.user_id?._id?.toString() || '',
        username: sub.user_id?.username || '',
        name: sub.user_id?.name || '',
        email: sub.user_id?.email || '',
      },
    }));

    return NextResponse.json(
      { 
        success: true, 
        data: serialized 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}
