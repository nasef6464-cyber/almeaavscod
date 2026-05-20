import { Request, Response, NextFunction } from "express";

const UNSAFE_KEYS = ["$where", "$eq", "$ne", "$gt", "$gte", "$lt", "$lte", "$in", "$nin", "$and", "$or", "$not", "$nor", "$regex", "$exists", "$type", "$expr", "$jsonSchema", "$mod", "$text", "$all", "$elemMatch", "$size"];

function isUnsafeKey(key: string): boolean {
  return key.startsWith("$") || key.includes(".");
}

function checkObject(obj: Record<string, unknown>, path = ""): string | null {
  for (const [key, value] of Object.entries(obj)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (isUnsafeKey(key)) {
      return fullPath;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const result = checkObject(value as Record<string, unknown>, fullPath);
      if (result) return result;
    }
  }
  return null;
}

export function rejectUnsafeMongoKeys(req: Request, res: Response, next: NextFunction) {
  const body = req.body as Record<string, unknown> | undefined;
  if (body && typeof body === "object") {
    const unsafeKey = checkObject(body);
    if (unsafeKey) {
      return res.status(400).json({
        message: `Unsafe key detected: ${unsafeKey}`,
      });
    }
  }

  const query = req.query as Record<string, unknown>;
  if (query && typeof query === "object") {
    const unsafeKey = checkObject(query);
    if (unsafeKey) {
      return res.status(400).json({
        message: `Unsafe query key detected: ${unsafeKey}`,
      });
    }
  }

  next();
}
