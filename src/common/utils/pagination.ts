export type PaginationResult = {
  page: number;
  limit: number;
  totalPages: number;
};

export type PaginationParams = {
  page?: number;
  limit?: number;
  maxLimit?: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEFAULT_MAX_LIMIT = 100;

export function resolvePagination({
  page,
  limit,
  maxLimit = DEFAULT_MAX_LIMIT,
}: PaginationParams) {
  const safePage =
    Number.isFinite(page) && page && page > 0 ? Math.floor(page) : DEFAULT_PAGE;
  const safeLimitValue =
    Number.isFinite(limit) && limit && limit > 0
      ? Math.floor(limit)
      : DEFAULT_LIMIT;
  const safeLimit = Math.min(safeLimitValue, maxLimit);
  const skip = (safePage - 1) * safeLimit;

  return { skip, take: safeLimit, page: safePage, limit: safeLimit };
}

export function buildPagination(
  page: number,
  limit: number,
  total: number,
): PaginationResult {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  return { page, limit, totalPages };
}
