import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/db.js";
import { UserModel } from "../models/User.js";

const demoUsers = [
  {
    name: "adminnasef",
    email: "nasef64@gmail.com",
    password: "Nn@0120110367",
    role: "admin",
    subscription: {
      plan: "premium",
      purchasedCourses: ["c1", "c3", "c10"],
      purchasedPackages: ["p1"],
    },
    enrolledCourses: ["c1", "c3", "c10"],
    enrolledPaths: ["p_qudrat", "p_tahsili"],
    completedLessons: ["l1", "l2"],
  },
  {
    name: "سارة المعلمة",
    email: "teacher@example.com",
    password: "Teacher@123",
    role: "teacher",
    subscription: {
      plan: "premium",
      purchasedCourses: [],
      purchasedPackages: [],
    },
    enrolledCourses: [],
    enrolledPaths: ["p_qudrat"],
    completedLessons: [],
  },
  {
    name: "علي الطالب",
    email: "student@example.com",
    password: "Student@123",
    role: "student",
    subscription: {
      plan: "premium",
      purchasedCourses: ["c1", "c3"],
      purchasedPackages: [],
    },
    enrolledCourses: ["c1", "c3"],
    enrolledPaths: ["p_qudrat", "p_tahsili"],
    completedLessons: ["l1", "l2"],
  },
  {
    name: "أحمد المشرف",
    email: "supervisor@example.com",
    password: "Supervisor@123",
    role: "supervisor",
    subscription: {
      plan: "premium",
      purchasedCourses: [],
      purchasedPackages: [],
    },
    enrolledCourses: [],
    enrolledPaths: ["p_qudrat"],
    completedLessons: [],
  },
  {
    name: "خالد ولي الأمر",
    email: "parent@example.com",
    password: "Parent@123",
    role: "parent",
    subscription: {
      plan: "free",
      purchasedCourses: [],
      purchasedPackages: [],
    },
    enrolledCourses: [],
    enrolledPaths: [],
    completedLessons: [],
  },
];

async function seedDemoUsers() {
  await connectToDatabase();

  try {
    for (const user of demoUsers) {
      const passwordHash = await bcrypt.hash(user.password, 10);
      await UserModel.findOneAndUpdate(
        { email: user.email.toLowerCase() },
        {
          name: user.name,
          email: user.email.toLowerCase(),
          passwordHash,
          role: user.role,
          isActive: true,
          subscription: user.subscription,
          enrolledCourses: user.enrolledCourses,
          enrolledPaths: user.enrolledPaths,
          completedLessons: user.completedLessons,
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      console.log(`Seeded ${user.role}: ${user.email.toLowerCase()}`);
    }

    const student = await UserModel.findOne({ email: "student@example.com" });
    const parent = await UserModel.findOne({ email: "parent@example.com" });

    if (student && parent) {
      parent.linkedStudentIds = [String(student.id)];
      await parent.save();
      console.log(`Linked parent@example.com to student ${student.email}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

seedDemoUsers().catch((error) => {
  console.error("Failed to seed demo users", error);
  process.exit(1);
});
