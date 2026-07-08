import { NextRequest } from 'next/server';
import { validateAdminRequest } from '@/app/lib/admin/auth';
import { apiSuccess, apiServerError } from '@/app/lib/admin/api-response';
import { connectToDatabase } from '@/app/lib/mongoose';
import { AdminAuditLog } from '@/app/lib/models';
import { parsePaginationParams, buildPaginationMeta } from '@/app/lib/admin/pagination';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Validate admin access first
    const authValidation = await validateAdminRequest();
    if (!authValidation.authorized) {
      return apiServerError(authValidation.error, authValidation.status);
    }

    await connectToDatabase();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '10';
    const search = searchParams.get('search');
    const action = searchParams.get('action');
    const status = searchParams.get('status');

    const { skip, limit: parsedLimit } = parsePaginationParams(page, limit);

    // Build filter
    const filter: any = {};

    if (search) {
      filter.$or = [
        { 'actor_id.username': { $regex: search, $options: 'i' } },
        { 'actor_id.email': { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { action_type: { $regex: search, $options: 'i' } },
      ];
    }

    if (action && action !== 'all') {
      filter.action = action;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    // Fetch logs with population
    const logs = await (AdminAuditLog as any)
      .find(filter)
      .populate('actor_id', 'username email')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    // Get total count
    const total = await (AdminAuditLog as any).countDocuments(filter);
    const pagination = buildPaginationMeta(parseInt(page), parsedLimit, total);

    return apiSuccess({
      logs,
      pagination,
    }, 'Audit logs retrieved successfully');
  } catch (error) {
    console.error('[v0] Error fetching audit logs:', error);
    return apiServerError(error);
  }
}
