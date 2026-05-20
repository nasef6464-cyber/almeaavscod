import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { users } from "../db/schema/index.js";
import { UserModel } from "../models/User.js";
import { signAccessToken } from "../utils/jwt.js";

const USE_PG = () => process.env.USE_POSTGRES === "true" && !!process.env.DATABASE_URL;

interface GoogleTokenInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  given_name?: string;
  family_name?: string;
}

async function verifyGoogleToken(token: string): Promise<GoogleTokenInfo> {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);

  if (!response.ok) {
    throw new Error("Invalid Google token");
  }

  const data = await response.json();

  if (!data.email || !data.sub) {
    throw new Error("Invalid Google token payload");
  }

  return data as GoogleTokenInfo;
}

export async function handleGoogleAuth(idToken: string) {
  const googleUser = await verifyGoogleToken(idToken);
  const email = googleUser.email.toLowerCase();

  if (USE_PG()) {
    let user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];

    if (!user) {
      const userId = `user_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const passwordHash = await bcrypt.hash(randomUUID(), 10);

      [user] = await db.insert(users).values({
        id: userId,
        name: googleUser.name,
        email,
        passwordHash,
        role: "student",
        avatar: googleUser.picture || "",
        isEmailVerified: googleUser.email_verified,
        isActive: true,
      }).returning();
    } else {
      if (!user.avatar && googleUser.picture) {
        await db.update(users)
          .set({ avatar: googleUser.picture })
          .where(eq(users.id, user.id));
        user.avatar = googleUser.picture;
      }
      if (!user.isEmailVerified && googleUser.email_verified) {
        await db.update(users)
          .set({ isEmailVerified: true })
          .where(eq(users.id, user.id));
        user.isEmailVerified = true;
      }
    }

    const token = signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role as "student" | "teacher" | "admin" | "supervisor" | "parent",
      name: user.name,
    });

    const { passwordHash: _, ...safeUser } = user;

    return { token, user: safeUser, isNewUser: !user.createdAt };
  }

  let user = await UserModel.findOne({ email });

  if (!user) {
    const passwordHash = await bcrypt.hash(randomUUID(), 10);
    user = await UserModel.create({
      name: googleUser.name,
      email,
      passwordHash,
      role: "student",
      avatar: googleUser.picture || "",
      isEmailVerified: googleUser.email_verified,
      isActive: true,
    });
  } else {
    if (!user.avatar && googleUser.picture) {
      user.avatar = googleUser.picture;
      await user.save();
    }
    if (!user.isEmailVerified && googleUser.email_verified) {
      user.isEmailVerified = true;
      await user.save();
    }
  }

  const token = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  const { passwordHash: _, ...safeUser } = user.toJSON();

  return { token, user: safeUser, isNewUser: !user.createdAt };
}

export function getGoogleAuthUrl() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/google/callback`;

  if (!clientId) {
    return null;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
