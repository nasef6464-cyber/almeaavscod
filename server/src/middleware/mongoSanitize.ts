import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

const MAX_SCAN_DEPTH = 12;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function findUnsafeMongoKey(value: unknown, path = "root", depth = 0): string | null {
  if (depth > MAX_SCAN_DEPTH) {
    return null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const unsafePath = findUnsafeMongoKey(value[index], `${path}[${index}]`, depth + 1);
      if (unsafePath) {
        return unsafePath;
      }
    }
    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key.startsWith("$") || key.includes(".")) {
      return `${path}.${key}`;
    }

    const unsafePath = findUnsafeMongoKey(nestedValue, `${path}.${key}`, depth + 1);
    if (unsafePath) {
      return unsafePath;
    }
  }

  return null;
}

export function rejectUnsafeMongoKeys(req: Request, res: Response, next: NextFunction) {
  const unsafeBodyKey = findUnsafeMongoKey(req.body, "body");
  const unsafeQueryKey = findUnsafeMongoKey(req.query, "query");
  const unsafePath = unsafeBodyKey || unsafeQueryKey;

  if (unsafePath) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "Request contains unsafe field names",
      requestId: req.requestId,
    });
  }

  return next();
}
