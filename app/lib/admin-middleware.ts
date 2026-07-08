/**
 * Admin API Middleware & Utilities
 * Handles:
 * - Rate limiting for admin endpoints
 * - Environment variable validation
 * - Admin authorization checks
 * - Audit logging
 * - Bookkeeping and accounting operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { rateLimit, API_RATE_LIMITS, rateLimitResponse } from './rate-limit';
import { connectToDatabase, Profile, Transaction } from './models';
import { successResponse, ApiError } from './responses';
import mongoose from 'mongoose';

// Environment variable validation
export function validateAdminEnv() {
  const required = ['MONGODB_URI', 'NEXTAUTH_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`[Admin] Missing environment variables: ${missing.join(', ')}`);
    return false;
  }

  return true;
}

// Admin authorization middleware
export async function checkAdminAuth(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: 'Unauthorized: No session' },
          { status: 401 }
        ),
      };
    }

    // Check if user is admin or super_admin
    const isAdmin = ['admin', 'super_admin'].includes(session.user.role || '');
    if (!isAdmin) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: 'Forbidden: Insufficient permissions' },
          { status: 403 }
        ),
      };
    }

    return {
      authorized: true,
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    };
  } catch (error) {
    console.error('[Admin] Auth check error:', error);
    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      ),
    };
  }
}

// Rate limiting middleware for admin endpoints
export function applyAdminRateLimit(request: NextRequest, identifier?: string) {
  // Use admin ID from auth or IP address as fallback
  const key = identifier || request.headers.get('x-forwarded-for') || 'unknown';
  const rateLimitConfig = API_RATE_LIMITS.admin;

  const result = rateLimit(key, rateLimitConfig.limit, rateLimitConfig.windowMs);

  if (result.exceeded) {
    return {
      limited: true,
      response: rateLimitResponse(result.resetTime),
    };
  }

  return {
    limited: false,
    remaining: result.remaining,
    resetTime: result.resetTime,
  };
}

// Audit logging helper
export async function logAdminAction(
  adminId: string,
  adminName: string,
  action: string,
  resource: string,
  resourceId?: string,
  changes?: Record<string, any>,
  status: 'success' | 'failure' = 'success'
) {
  try {
    await connectToDatabase();

    // Get or create AuditLog model with inline schema
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

    const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

    const ipAddress = process.env.NODE_ENV === 'development' 
      ? '127.0.0.1' 
      : process.env.ADMIN_IP || 'unknown';

    const auditEntry = await AuditLog.create({
      admin_id: adminId,
      admin_name: adminName,
      action,
      resource,
      resource_id: resourceId || null,
      changes: changes || {},
      ip_address: ipAddress,
      user_agent: 'AdminAPI',
      status,
    });

    return auditEntry;
  } catch (error) {
    console.error('[Admin] Failed to log audit action:', error);
    // Don't throw - audit logging should not break the main request
    return null;
  }
}

// Transaction validation helper
export function validateTransactionData(data: any) {
  const errors: string[] = [];

  if (!data.user_id) errors.push('user_id is required');
  if (!data.type) errors.push('type is required');
  if (data.amount === undefined || data.amount === null) errors.push('amount is required');
  if (typeof data.amount !== 'number' || data.amount <= 0) errors.push('amount must be a positive number');

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Bookkeeping: Create transaction record with full details
export async function createTransactionRecord(
  userId: string,
  type: string,
  amount: number,
  description: string,
  metadata?: Record<string, any>
) {
  try {
    await connectToDatabase();

    const transaction = await Transaction.create({
      user_id: userId,
      type,
      amount,
      description,
      status: 'completed',
      metadata: metadata || {},
      created_at: new Date(),
      created_by_admin: true,
    });

    return {
      success: true,
      transaction,
    };
  } catch (error) {
    console.error('[Admin] Failed to create transaction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create transaction',
    };
  }
}

// Bookkeeping: Update user account balance
export async function updateUserBalance(
  userId: string,
  amount: number,
  operation: 'add' | 'subtract' = 'add'
) {
  try {
    await connectToDatabase();

    const updateAmount = operation === 'add' ? amount : -amount;

    const user = await Profile.findByIdAndUpdate(
      userId,
      { 
        $inc: { account_balance: updateAmount },
        updated_at: new Date(),
      },
      { new: true, lean: true }
    );

    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    return {
      success: true,
      user: {
        id: user._id,
        balance: user.account_balance,
      },
    };
  } catch (error) {
    console.error('[Admin] Failed to update user balance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update balance',
    };
  }
}

// Accounting: Get user financial summary
export async function getUserFinancialSummary(userId: string) {
  try {
    await connectToDatabase();

    const user = await Profile.findById(userId).lean();
    if (!user) {
      return null;
    }

    // Get transaction summary
    const transactions = await Transaction.aggregate([
      { $match: { user_id: userId } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = {
      userId,
      currentBalance: user.account_balance || 0,
      totalTransactions: transactions.reduce((sum, t) => sum + t.count, 0),
      byType: transactions.reduce((acc, t) => {
        acc[t._id] = {
          total: t.total,
          count: t.count,
        };
        return acc;
      }, {} as Record<string, any>),
    };

    return summary;
  } catch (error) {
    console.error('[Admin] Failed to get financial summary:', error);
    return null;
  }
}

// Accounting: Get platform-wide financial stats
export async function getPlatformFinancialStats() {
  try {
    await connectToDatabase();

    const stats = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalVolume: { $sum: '$amount' },
          avgTransaction: { $avg: '$amount' },
          minTransaction: { $min: '$amount' },
          maxTransaction: { $max: '$amount' },
        },
      },
    ]);

    const userStats = await Profile.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: {
              $cond: [{ $eq: ['$status', 'active'] }, 1, 0],
            },
          },
          totalBalance: { $sum: { $toDouble: '$account_balance' } },
          avgBalance: { $avg: { $toDouble: '$account_balance' } },
        },
      },
    ]);

    return {
      transactions: stats[0] || {},
      users: userStats[0] || {},
    };
  } catch (error) {
    console.error('[Admin] Failed to get platform stats:', error);
    return null;
  }
}

// Validate pagination parameters
export function validatePagination(page?: string | number, limit?: string | number) {
  let pageNum = parseInt(String(page || '1'));
  let limitNum = parseInt(String(limit || '20'));

  // Validation
  if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
  if (isNaN(limitNum) || limitNum < 1) limitNum = 20;
  if (limitNum > 100) limitNum = 100; // Max limit 100 per request

  const skip = (pageNum - 1) * limitNum;

  return { page: pageNum, limit: limitNum, skip };
}

// Safe query builder for MongoDB
export function buildQuery(filters: Record<string, any>) {
  const query: Record<string, any> = {};

  // Search filter
  if (filters.search) {
    query.$or = [
      { username: { $regex: filters.search, $options: 'i' } },
      { email: { $regex: filters.search, $options: 'i' } },
      { name: { $regex: filters.search, $options: 'i' } },
    ];
  }

  // Status filter
  if (filters.status) {
    query.status = filters.status;
  }

  // Role filter
  if (filters.role) {
    query.role = filters.role;
  }

  // Date range filter
  if (filters.dateFrom || filters.dateTo) {
    query.created_at = {};
    if (filters.dateFrom) {
      query.created_at.$gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      query.created_at.$lte = new Date(`${filters.dateTo}T23:59:59.999Z`);
    }
  }

  return query;
}

// Response wrapper with headers
export function adminResponse(data: any, status = 200) {
  return NextResponse.json(
    { success: true, data },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
      },
    }
  );
}

export function adminError(error: string, status = 400) {
  return NextResponse.json(
    { success: false, error },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  );
}
