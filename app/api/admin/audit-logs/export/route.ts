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

    const format = request.nextUrl.searchParams.get('format') || 'csv';

    // Get all logs (no pagination for export)
    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).lean();

    if (format === 'csv') {
      // Generate CSV content
      const headers = [
        'Admin ID',
        'Admin Name',
        'Action',
        'Resource',
        'Resource ID',
        'Status',
        'IP Address',
        'Timestamp',
      ];

      const rows = logs.map((log: any) => [
        log.admin_id,
        log.admin_name,
        log.action,
        log.resource,
        log.resource_id || '',
        log.status,
        log.ip_address,
        new Date(log.createdAt).toLocaleString(),
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => {
            // Escape CSV values
            if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
              return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
          }).join(',')
        ),
      ].join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    if (format === 'json') {
      return NextResponse.json(
        {
          success: true,
          data: logs.map((log: any) => ({
            _id: log._id?.toString(),
            admin_id: log.admin_id,
            admin_name: log.admin_name,
            action: log.action,
            resource: log.resource,
            resource_id: log.resource_id,
            status: log.status,
            ip_address: log.ip_address,
            createdAt: log.createdAt,
          })),
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: 'Unsupported format' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Admin] Export audit logs error:', error);
    return NextResponse.json(
      { error: 'Failed to export audit logs' },
      { status: 500 }
    );
  }
}
