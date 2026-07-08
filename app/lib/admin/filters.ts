import type { AdminFilters } from './types';

/**
 * Build MongoDB query filter from admin filters
 */
export function buildMongoFilter(filters: AdminFilters): Record<string, any> {
  const query: Record<string, any> = {};

  if (filters.search) {
    const searchRegex = { $regex: filters.search, $options: 'i' };
    query.$or = [
      { email: searchRegex },
      { username: searchRegex },
      { name: searchRegex },
    ];
  }

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      query.status = { $in: filters.status };
    } else {
      query.status = filters.status;
    }
  }

  if (filters.role) {
    if (Array.isArray(filters.role)) {
      query.role = { $in: filters.role };
    } else {
      query.role = filters.role;
    }
  }

  if (filters.startDate || filters.endDate) {
    query.created_at = {};
    if (filters.startDate) {
      query.created_at.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.created_at.$lte = new Date(filters.endDate);
    }
  }

  return query;
}

/**
 * Build MongoDB sort options
 */
export function buildMongoSort(
  sortBy: string = 'created_at',
  sortOrder: 'asc' | 'desc' = 'desc'
): Record<string, 1 | -1> {
  const allowedFields = [
    'created_at',
    'updated_at',
    'email',
    'username',
    'amount',
    'status',
    'last_login',
  ];

  const field = allowedFields.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder === 'asc' ? 1 : -1;

  return { [field]: order };
}

/**
 * Parse filter query parameters
 */
export function parseFiltersFromQuery(query: Record<string, any>): AdminFilters {
  return {
    search: query.search || undefined,
    status: query.status ? (Array.isArray(query.status) ? query.status : [query.status]) : undefined,
    role: query.role ? (Array.isArray(query.role) ? query.role : [query.role]) : undefined,
    startDate: query.startDate || undefined,
    endDate: query.endDate || undefined,
    sortBy: query.sortBy || 'created_at',
    sortOrder: (query.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
    page: query.page ? parseInt(query.page, 10) : 1,
    limit: query.limit ? parseInt(query.limit, 10) : 10,
  };
}
