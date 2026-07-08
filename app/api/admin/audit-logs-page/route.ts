import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth, validatePaginationParams, buildPaginationMeta } from '../middleware';
import { connectToDatabase, AdminAuditLog, Profile } from '@/app/lib/models';

export async function GET(req: NextRequest) {
  try {
    // Validate admin access
    const authResult = await validateAdminAuth();
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status || 401 }
      );
    }

    await connectToDatabase();

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '20';
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const { skip, limit: parsedLimit } = validatePaginationParams(page, limit);

    // Build filter
    const filter: any = {};

    if (action && action !== 'all') {
      filter.action = action;
    }

    if (startDate || endDate) {
      filter.created_at = {};
      if (startDate) {
        filter.created_at.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.created_at.$lte = new Date(endDate);
      }
    }

    // Get total count
    const total = await AdminAuditLog.countDocuments(filter);

    // Fetch paginated logs
    const logs = await AdminAuditLog.find(filter)
      .populate('actor_id', 'email username')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const pagination = buildPaginationMeta(parseInt(page), parsedLimit, total);

    return NextResponse.json({
      success: true,
      data: {
        logs: logs.map((log: any) => ({
          _id: log._id?.toString(),
          action: log.action,
          actor: log.actor_id ? {
            _id: log.actor_id._id?.toString(),
            email: log.actor_id.email,
            username: log.actor_id.username,
          } : null,
          targetType: log.target_type,
          targetId: log.target_id,
          resourceType: log.resource_type,
          resourceId: log.resource_id,
          actionType: log.action_type,
          changes: log.changes || {},
          description: log.description,
          ipAddress: log.ip_address,
          userAgent: log.user_agent,
          createdAt: log.created_at?.toISOString(),
        })),
        pagination,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[v0] Admin audit logs API error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
