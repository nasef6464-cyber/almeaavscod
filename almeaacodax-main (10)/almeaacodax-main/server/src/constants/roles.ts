export const roles = [
  "student",
  "teacher",
  "admin",
  "supervisor",
  "parent",
] as const;

export type AppRole = (typeof roles)[number];
