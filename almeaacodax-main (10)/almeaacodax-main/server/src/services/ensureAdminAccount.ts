import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { UserModel } from "../models/User.js";

export async function ensureAdminAccount() {
  const email = env.ADMIN_EMAIL.toLowerCase();
  const existing = await UserModel.findOne({ email });

  if (!existing) {
    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
    await UserModel.create({
      name: env.ADMIN_NAME,
      email,
      passwordHash,
      role: "admin",
      isActive: true,
      subscription: {
        plan: "premium",
        purchasedCourses: [],
        purchasedPackages: [],
      },
    });
    console.log(`[admin] Created admin account for ${email}`);
    return;
  }

  let changed = false;

  if (existing.role !== "admin") {
    existing.role = "admin";
    changed = true;
  }

  if (!existing.isActive) {
    existing.isActive = true;
    changed = true;
  }

  if (!existing.passwordHash) {
    existing.passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
    changed = true;
  }

  if (existing.name !== env.ADMIN_NAME) {
    existing.name = env.ADMIN_NAME;
    changed = true;
  }

  if (changed) {
    await existing.save();
    console.log(`[admin] Updated admin account for ${email}`);
  }
}
