import { randomUUID } from "node:crypto";
import { AccessGrantModel } from "../models/AccessGrant.js";
import { UserModel } from "../models/User.js";

const uniqueStrings = (values: Array<string | undefined | null>) =>
  Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));

export type AccessGrantSourceType =
  | "payment_request"
  | "payment_webhook"
  | "access_code"
  | "admin_manual"
  | "membership";

export interface GrantAccessPayload {
  userId: string;
  sourceType: AccessGrantSourceType;
  sourceId: string;
  packageId?: string;
  courseIds?: string[];
  contentTypes?: string[];
  pathIds?: string[];
  subjectIds?: string[];
  grantedBy?: string;
  expiresAt?: number | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export async function mirrorGrantToUserSubscription(payload: {
  userId: string;
  packageId?: string;
  courseIds?: string[];
}) {
  const packageId = String(payload.packageId || "").trim();
  const courseIds = uniqueStrings(payload.courseIds || []);
  const update: Record<string, unknown> = {
    $set: {
      "subscription.plan": packageId ? "premium" : "premium",
    },
  };

  const addToSet: Record<string, unknown> = {};
  if (packageId) {
    addToSet["subscription.purchasedPackages"] = packageId;
  }
  if (courseIds.length) {
    addToSet["subscription.purchasedCourses"] = { $each: courseIds };
    addToSet.enrolledCourses = { $each: courseIds };
  }
  if (Object.keys(addToSet).length) {
    update.$addToSet = addToSet;
  }

  return UserModel.findByIdAndUpdate(payload.userId, update, { new: true });
}

export async function grantAccessToUser(payload: GrantAccessPayload) {
  const packageId = String(payload.packageId || "").trim();
  const courseIds = uniqueStrings(payload.courseIds || []);
  const contentTypes = uniqueStrings(payload.contentTypes?.length ? payload.contentTypes : ["all"]);
  const pathIds = uniqueStrings(payload.pathIds || []);
  const subjectIds = uniqueStrings(payload.subjectIds || []);

  let grant = await AccessGrantModel.findOne({
    $or: [
      { idempotencyKey: payload.idempotencyKey },
      { sourceType: payload.sourceType, sourceId: payload.sourceId },
    ],
  });
  let created = false;

  if (!grant) {
    try {
      grant = await AccessGrantModel.create({
        id: `grant_${Date.now()}_${randomUUID().slice(0, 8)}`,
        userId: payload.userId,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        packageId,
        courseIds,
        contentTypes,
        pathIds,
        subjectIds,
        status: "active",
        grantedBy: payload.grantedBy || "system",
        grantedAt: Date.now(),
        expiresAt: payload.expiresAt || null,
        idempotencyKey: payload.idempotencyKey,
        metadata: payload.metadata || {},
      });
      created = true;
    } catch (error: any) {
      if (error?.code !== 11000) {
        throw error;
      }

      grant = await AccessGrantModel.findOne({
        $or: [
          { idempotencyKey: payload.idempotencyKey },
          { sourceType: payload.sourceType, sourceId: payload.sourceId },
        ],
      });
      created = false;
    }
  }

  const user = await mirrorGrantToUserSubscription({
    userId: payload.userId,
    packageId,
    courseIds,
  });

  return {
    grant,
    user,
    created,
  };
}
