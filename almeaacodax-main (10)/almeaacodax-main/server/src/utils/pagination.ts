import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function resolvePagination(query: unknown, defaults: Partial<PaginationQuery> = {}) {
  const queryRecord = query && typeof query === "object" ? (query as Record<string, unknown>) : {};
  const parsed = paginationQuerySchema.parse(query);
  const page = defaults.page && !("page" in queryRecord) ? defaults.page : parsed.page;
  const limit = defaults.limit && !("limit" in queryRecord) ? defaults.limit : parsed.limit;
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function buildPaginatedResponse<T>(items: T[], pagination: PaginationQuery, total: number) {
  return {
    items,
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.ceil(total / Math.max(pagination.limit, 1)),
  };
}
