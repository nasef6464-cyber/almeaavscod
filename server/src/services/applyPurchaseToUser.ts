import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/connection.js";
import { users } from "../db/schema/index.js";
import { UserModel } from "../models/User.js";

const USE_PG = () => env.USE_POSTGRES && env.DATABASE_URL;

const uniqueStrings = (values: Array<string | undefined | null>) =>
  Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));

export const applyPurchaseToUser = async (
  userId: string,
  payload: { courseId?: string; packageId?: string; includedCourseIds?: string[] },
) => {
  if (USE_PG()) {
    const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = result[0];
    if (!user) return null;

    const purchasedCourses = uniqueStrings([
      ...(user.purchasedCourses || []),
      ...(payload.courseId ? [payload.courseId] : []),
      ...((payload.includedCourseIds || []).map(String)),
    ]);

    const enrolledCourses = uniqueStrings([
      ...(user.enrolledCourses || []),
      ...(payload.courseId ? [payload.courseId] : []),
      ...((payload.includedCourseIds || []).map(String)),
    ]);

    const purchasedPackages = uniqueStrings([
      ...(user.purchasedPackages || []),
      ...(payload.packageId ? [payload.packageId] : []),
    ]);

    const [updated] = await db.update(users)
      .set({
        purchasedCourses,
        enrolledCourses,
        purchasedPackages,
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    return null;
  }

  const purchasedCourses = uniqueStrings([
    ...(user.subscription?.purchasedCourses || []),
    ...(payload.courseId ? [payload.courseId] : []),
    ...((payload.includedCourseIds || []).map(String)),
  ]);

  const enrolledCourses = uniqueStrings([
    ...(user.enrolledCourses || []),
    ...(payload.courseId ? [payload.courseId] : []),
    ...((payload.includedCourseIds || []).map(String)),
  ]);

  const purchasedPackages = uniqueStrings([
    ...(user.subscription?.purchasedPackages || []),
    ...(payload.packageId ? [payload.packageId] : []),
  ]);

  user.subscription = {
    ...user.subscription,
    plan: purchasedPackages.length > 0 ? "premium" : (user.subscription?.plan || "free"),
    purchasedCourses,
    purchasedPackages,
  };
  user.enrolledCourses = enrolledCourses;
  await user.save();
  return user;
};
