/**
 * Standardized API Response Types
 */

interface BaseResponse {
  success: boolean;
  timestamp: string;
}

interface SuccessResponse<T> extends BaseResponse {
  success: true;
  data: T;
  message?: string;
}

interface ErrorResponse extends BaseResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

interface PaginatedResponse<T> extends SuccessResponse<T[]> {
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  message?: string
): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an error response
 */
export function errorResponse(
  code: string,
  message: string,
  details?: string
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  limit: number,
  offset: number,
  total: number,
  message?: string
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    message,
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + limit < total,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DUPLICATE_RECORD: 'DUPLICATE_RECORD',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Error response factory
 */
export const ApiError = {
  unauthorized: (details?: string) =>
    errorResponse(ErrorCodes.UNAUTHORIZED, 'Unauthorized', details),
  forbidden: (details?: string) =>
    errorResponse(ErrorCodes.FORBIDDEN, 'Forbidden', details),
  notFound: (resource: string) =>
    errorResponse(ErrorCodes.NOT_FOUND, `${resource} not found`),
  badRequest: (message: string, details?: string) =>
    errorResponse(ErrorCodes.BAD_REQUEST, message, details),
  validationError: (message: string, details?: string) =>
    errorResponse(ErrorCodes.VALIDATION_ERROR, message, details),
  internal: (message: string = 'Internal server error', details?: string) =>
    errorResponse(ErrorCodes.INTERNAL_ERROR, message, details),
  duplicate: (resource: string) =>
    errorResponse(ErrorCodes.DUPLICATE_RECORD, `${resource} already exists`),
  insufficientBalance: (amount: number) =>
    errorResponse(
      ErrorCodes.INSUFFICIENT_BALANCE,
      `Insufficient balance. Required: ${amount}`
    ),
  rateLimitExceeded: (message?: string) =>
    errorResponse(
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      message || 'Rate limit exceeded'
    ),
  paymentFailed: (message: string) =>
    errorResponse(ErrorCodes.PAYMENT_FAILED, message),
};
