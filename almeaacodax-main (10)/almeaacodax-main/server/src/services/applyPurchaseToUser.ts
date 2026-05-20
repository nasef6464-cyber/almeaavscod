import { mirrorGrantToUserSubscription } from "./accessGrantService.js";

export const applyPurchaseToUser = async (
  userId: string,
  payload: { courseId?: string; packageId?: string; includedCourseIds?: string[] },
) => {
  return mirrorGrantToUserSubscription({
    userId,
    packageId: payload.packageId,
    courseIds: [
      ...(payload.courseId ? [payload.courseId] : []),
      ...((payload.includedCourseIds || []).map(String)),
    ],
  });
};
