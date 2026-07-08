import { NextResponse } from 'next/server';
import type { AdminApiResponse, PaginatedResponse, PaginationMeta } from './types';

/**
 * Build standardized success response
 */
export function apiSuccess<T>(
  data: T,
  message: string = 'Success',
  status: number = 200
): NextResponse {
  const response: AdminApiResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status });
}

/**
 * Build standardized error response
 */
export function apiError(
  error: string | Error,
  message: string = 'An error occurred',
  status: number = 400
): NextResponse {
  const errorMessage = error instanceof Error ? error.message : error;
  
  const response: AdminApiResponse = {
    success: false,
    message,
    error: errorMessage,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status });
}

/**
 * Build paginated response
 */
export function apiPaginated<T>(
  data: T[],
  pagination: PaginationMeta,
  message: string = 'Success',
  status: number = 200
): NextResponse {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination,
    message,
  };

  return NextResponse.json(response, { status });
}

/**
 * Create pagination metadata
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}

/**
 * Unauthorized response
 */
export function apiUnauthorized(): NextResponse {
  return apiError('Unauthorized', 'You must be logged in to access this resource.', 401);
}

/**
 * Forbidden response
 */
export function apiForbidden(): NextResponse {
  return apiError('Forbidden', 'Admin access required.', 403);
}

/**
 * Not found response
 */
export function apiNotFound(resource: string = 'Resource'): NextResponse {
  return apiError(`${resource} not found`, `The requested ${resource.toLowerCase()} does not exist.`, 404);
}

/**
 * Validation error response
 */
export function apiValidationError(message: string = 'Validation failed'): NextResponse {
  return apiError('Validation Error', message, 400);
}

/**
 * Server error response
 */
export function apiServerError(error: Error | string = 'Internal server error'): NextResponse {
  const errorMessage = error instanceof Error ? error.message : error;
  return apiError(errorMessage, 'An unexpected error occurred', 500);
}
