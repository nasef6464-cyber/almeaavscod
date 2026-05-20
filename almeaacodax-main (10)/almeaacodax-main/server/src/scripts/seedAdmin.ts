import bcrypt from "bcryptjs";
import { connectToDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { UserModel } from "../models/User.js";

async function seedAdmin() {
  await connectToDatabase();

  const existing = await UserModel.findOne({
    email: env.ADMIN_EMAIL.toLowerCase(),
  });

  if (existing) {
    existing.name = env.ADMIN_NAME;
    existing.role = "admin";
    existing.isActive = true;
    existing.passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
    await existing.save();

    console.log(`Updated admin user: ${existing.email}`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);

  const created = await UserModel.create({
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL.toLowerCase(),
    passwordHash,
    role: "admin",
    isActive: true,
    subscription: {
      plan: "premium",
      purchasedCourses: [],
      purchasedPackages: [],
    },
  });

  console.log(`Created admin user: ${created.email}`);
  process.exit(0);
}

seedAdmin().catch((error) => {
  console.error("Failed to seed admin user", error);
  process.exit(1);
});
