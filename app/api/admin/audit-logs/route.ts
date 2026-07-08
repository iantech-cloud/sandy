import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/models';
import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    admin_id: String,
    admin_name: String,
    action: String,
    resource: String,
    resource_id: String,
    changes: mongoose.Schema.Types.Mixed,
    ip_address: String,
    user_agent: String,
    status: { type: String, enum: ['success', 'failure'], default: 'success' },
  },
  { timestamps: true }
);

let AuditLog: mongoose.Model<any>;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    await connectToDatabase();

    if (!AuditLog) {
      AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
    }

    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
    const search = request.nextUrl.searchParams.get('search') || '';
    const status = request.nextUrl.searchParams.get('status') || '';
    const resource = request.nextUrl.searchParams.get('resource') || '';
    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    if (search) {
      query.$or = [
        { admin_name: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { resource: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      query.status = status;
    }

    if (resource) {
      query.resource = resource;
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
      }
    }

    // Fetch paginated logs
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const total = await AuditLog.countDocuments(query);

    // Get statistics
    const stats = await AuditLog.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          success: [
            { $match: { status: 'success' } },
            { $count: 'count' },
          ],
          failure: [
            { $match: { status: 'failure' } },
            { $count: 'count' },
          ],
          uniqueAdmins: [
            { $group: { _id: '$admin_id' } },
            { $count: 'count' },
          ],
        },
      },
    ]);

    const statsData = stats[0] || {};

    return NextResponse.json(
      {
        success: true,
        data: {
          logs: logs.map((log: any) => ({
            _id: log._id?.toString(),
            admin_id: log.admin_id,
            admin_name: log.admin_name,
            action: log.action,
            resource: log.resource,
            resource_id: log.resource_id,
            changes: log.changes || {},
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            status: log.status,
            createdAt: log.createdAt,
          })),
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
          stats: {
            totalLogs: statsData.total?.[0]?.count || 0,
            successCount: statsData.success?.[0]?.count || 0,
            failureCount: statsData.failure?.[0]?.count || 0,
            uniqueAdmins: statsData.uniqueAdmins?.[0]?.count || 0,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin] Audit logs API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, resource, resource_id, changes, status: logStatus } = body;

    if (!action || !resource) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    if (!AuditLog) {
      AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
    }

    const log = await AuditLog.create({
      admin_id: session.user.id,
      admin_name: session.user.name || session.user.email,
      action,
      resource,
      resource_id: resource_id || null,
      changes: changes || {},
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      status: logStatus || 'success',
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Audit log created successfully',
        data: log,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Admin] Audit logs POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create audit log' },
      { status: 500 }
    );
  }
}
