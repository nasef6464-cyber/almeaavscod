import { PathModel } from "../models/Path.js";

type AuthUserLike = {
  role?: string;
};

export const isStaffRole = (role?: string) => role === "admin" || role === "teacher" || role === "supervisor";

const ACTIVE_PATH_CACHE_TTL_MS = 60 * 1000;
let activePathIdsCache: { expiresAt: number; ids: string[] } | null = null;

export const clearActivePathIdsCache = () => {
  activePathIdsCache = null;
};

export const getActivePathIds = async () => {
  if (activePathIdsCache && activePathIdsCache.expiresAt > Date.now()) {
    return activePathIdsCache.ids;
  }

  const paths = await PathModel.find({ isActive: { $ne: false } }).select("_id");
  const ids = paths.map((path) => String(path._id));
  activePathIdsCache = {
    expiresAt: Date.now() + ACTIVE_PATH_CACHE_TTL_MS,
    ids,
  };
  return ids;
};

export const withLearnerVisiblePaths = async <T extends Record<string, unknown>>(
  baseFilter: T,
  authUser?: AuthUserLike,
  pathField = "pathId",
) => {
  if (isStaffRole(authUser?.role)) {
    return baseFilter;
  }

  const activePathIds = await getActivePathIds();

  return {
    $and: [
      baseFilter,
      {
        $or: [
          { [pathField]: { $in: activePathIds } },
          { [pathField]: { $exists: false } },
          { [pathField]: "" },
          { [pathField]: null },
        ],
      },
    ],
  };
};
