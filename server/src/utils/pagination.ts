export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  filter?: Record<string, unknown>;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function parsePaginationQuery(query: Record<string, unknown>): PaginationQuery {
  return {
    page: Math.max(1, Number(query.page) || 1),
    limit: Math.min(100, Math.max(1, Number(query.limit) || 20)),
    sortBy: typeof query.sortBy === "string" ? query.sortBy : "createdAt",
    sortOrder: query.sortOrder === "asc" ? "asc" : "desc",
    search: typeof query.search === "string" ? query.search : undefined,
    filter: typeof query.filter === "object" ? (query.filter as Record<string, unknown>) : undefined,
  };
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationResult<unknown>["pagination"] {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function buildPaginatedResponse<T>(data: T[], page: number, limit: number, total: number): PaginationResult<T> {
  return {
    data,
    pagination: buildPaginationMeta(page, limit, total),
  };
}

export function resolvePagination(query: Record<string, unknown>): { skip: number; limit: number; page: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { skip: (page - 1) * limit, limit, page };
}
