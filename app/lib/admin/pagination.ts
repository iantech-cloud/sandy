/**
 * Parse and validate pagination parameters
 */
export function parsePaginationParams(
  page?: string | number,
  limit?: string | number,
  maxLimit: number = 100
): { page: number; limit: number; skip: number } {
  let parsedPage = parseInt(String(page || 1), 10);
  let parsedLimit = parseInt(String(limit || 10), 10);

  // Validate page
  if (isNaN(parsedPage) || parsedPage < 1) {
    parsedPage = 1;
  }

  // Validate limit
  if (isNaN(parsedLimit) || parsedLimit < 1) {
    parsedLimit = 10;
  }

  // Cap at maximum limit
  if (parsedLimit > maxLimit) {
    parsedLimit = maxLimit;
  }

  const skip = (parsedPage - 1) * parsedLimit;

  return { page: parsedPage, limit: parsedLimit, skip };
}

/**
 * Create MongoDB pagination options
 */
export function getPaginationOptions(
  page: number = 1,
  limit: number = 10,
  maxLimit: number = 100
) {
  const { skip } = parsePaginationParams(page, limit, maxLimit);

  return {
    skip,
    limit: Math.min(limit, maxLimit),
  };
}

/**
 * Build pagination metadata
 */
export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number
) {
  const pages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    pages,
    hasNextPage: page < pages,
    hasPrevPage: page > 1,
  };
}
