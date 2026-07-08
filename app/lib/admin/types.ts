/**
 * Unified admin API response format
 */
export interface AdminApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  error?: string;
  timestamp?: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
  message: string;
}

/**
 * User admin view
 */
export interface AdminUser {
  _id: string;
  email: string;
  username: string;
  role: 'user' | 'admin' | 'super_admin';
  is_active: boolean;
  is_approved: boolean;
  is_verified: boolean;
  status: 'active' | 'banned' | 'suspended';
  created_at: string;
  last_login?: string;
  profile_completed: boolean;
}

/**
 * Transaction for admin view
 */
export interface AdminTransaction {
  _id: string;
  user_id: string;
  type: 'deposit' | 'withdrawal' | 'referral' | 'spin' | 'other';
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description: string;
  created_at: string;
  updated_at: string;
}

/**
 * Withdrawal request
 */
export interface AdminWithdrawal {
  _id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed';
  payment_method: string;
  account_details: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Content submission for approval
 */
export interface AdminSubmission {
  _id: string;
  user_id: string;
  type: string;
  content: any;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

/**
 * Audit log entry
 */
export interface AdminAuditLog {
  _id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  changes: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

/**
 * Dashboard stats
 */
export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  pendingApprovals: number;
  totalTransactions: number;
  totalWithdrawals: number;
  pendingWithdrawals: number;
  monthlyRevenue: number;
  usersGrowth: number;
}

/**
 * Filter criteria for queries
 */
export interface AdminFilters {
  search?: string;
  status?: string | string[];
  role?: string | string[];
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
