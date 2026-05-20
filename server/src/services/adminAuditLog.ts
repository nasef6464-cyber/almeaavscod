import type { Request } from "express";
import { AdminAuditLogModel } from "../models/AdminAuditLog.js";

type AdminAuditPayload = {
  action: string;
  resourceType?: string;
  resourceId?: string;
  status?: "success" | "blocked" | "failed";
  metadata?: Record<string, unknown>;
};

const resolveIp = (req: Request) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0] || "";
  }
  if (typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0]?.trim() || "";
  }
  return req.ip || req.socket.remoteAddress || "";
};

export async function recordAdminAuditLog(req: Request, payload: AdminAuditPayload) {
  try {
    await AdminAuditLogModel.create({
      actorId: req.authUser?.id || "",
      actorEmail: req.authUser?.email || "",
      actorRole: req.authUser?.role || "",
      action: payload.action,
      resourceType: payload.resourceType || "",
      resourceId: payload.resourceId || "",
      status: payload.status || "success",
      ip: resolveIp(req),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
      metadata: payload.metadata || {},
    });
  } catch (error) {
    console.error("Admin audit log failed:", error);
  }
}
