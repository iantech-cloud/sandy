import { NextRequest } from 'next/server';
import { validateAdminRequest } from '@/app/lib/admin/auth';
import { apiSuccess, apiServerError } from '@/app/lib/admin/api-response';
import { connectToDatabase, UserContent } from '@/app/lib/models';
import { parsePaginationParams, buildPaginationMeta } from '@/app/lib/admin/pagination';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Validate admin access first
    const authValidation = await validateAdminRequest();
    if (!authValidation.authorized) {
      return apiServerError(authValidation.error, authValidation.status);
    }

    await connectToDatabase();
    
    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '10';
    const { skip, limit: parsedLimit } = parsePaginationParams(page, limit);

    // Get total count
    const total = await UserContent.countDocuments();
    
    // Get paginated submissions - populate user info
    const submissions = await UserContent.find({})
      .populate('user', 'username email name')
      .populate('approved_by', 'username email name')
      .sort({ submission_date: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean()
      .exec();

    // Serialize documents to ensure proper JSON serialization
    const data = submissions.map((sub: any) => ({
      _id: sub._id?.toString() || '',
      title: sub.title || '',
      content_type: sub.content_type || '',
      status: sub.status || 'pending',
      payment_status: sub.payment_status || 'pending',
      payment_amount: sub.payment_amount || 0,
      submission_date: sub.submission_date ? new Date(sub.submission_date).toISOString() : new Date().toISOString(),
      task_category: sub.task_category || '',
      content: sub.content || '',
      user: {
        _id: sub.user?._id?.toString() || '',
        username: sub.user?.username || '',
        name: sub.user?.name || '',
        email: sub.user?.email || '',
      },
    }));

    const pagination = buildPaginationMeta(parseInt(page), parsedLimit, total);

    return apiSuccess({
      submissions: data,
      pagination
    }, 'Submissions retrieved successfully');
  } catch (error) {
    console.error('[v0] Error fetching submissions:', error);
    return apiServerError(error);
  }
}
