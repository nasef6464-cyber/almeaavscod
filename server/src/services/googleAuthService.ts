import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { users } from "../db/schema/index.js";
import { UserModel } from "../models/User.js";
import { signAccessToken } from "../utils/jwt.js";
import { env } from "../config/env.js";

const USE_PG = () => env.USE_POSTGRES && env.DATABASE_URL;

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
  if (!response.ok) throw new Error("Invalid Google token");
  const data = await response.json();
  if (!data.email || !data.sub) throw new Error("Invalid Google token payload");
  return data as GoogleTokenInfo;
}

async function exchangeGoogleCode(code: string): Promise<{ access_token: string; id_token: string }> {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID || "",
    client_secret: env.GOOGLE_CLIENT_SECRET || "",
    redirect_uri: env.GOOGLE_REDIRECT_URI || "",
    grant_type: "authorization_code",
  });
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Google code exchange failed: ${text.slice(0, 200)}`);
  }
  return resp.json() as Promise<{ access_token: string; id_token: string }>;
}

async function getGoogleUserInfo(accessToken: string): Promise<GoogleTokenInfo> {
  const resp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) throw new Error("Failed to get Google user info");
  return resp.json() as Promise<GoogleTokenInfo>;
}

async function findOrCreateUser(googleUser: GoogleTokenInfo) {
  const email = googleUser.email.toLowerCase();

  if (USE_PG()) {
    let user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];

    if (!user) {
      const userId = `user_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const passwordHash = await bcrypt.hash(randomUUID(), 10);
      [user] = await db.insert(users).values({
        id: userId,
        googleId: googleUser.sub,
        name: googleUser.name,
        email,
        passwordHash,
        role: "student",
        avatar: googleUser.picture || "",
        isEmailVerified: googleUser.email_verified,
        isActive: true,
      }).returning();
    } else {
      const updates: Record<string, any> = {};
      if (!user.avatar && googleUser.picture) updates.avatar = googleUser.picture;
      if (!user.isEmailVerified && googleUser.email_verified) updates.isEmailVerified = true;
      if (!user.googleId) updates.googleId = googleUser.sub;
      if (Object.keys(updates).length > 0) {
        await db.update(users).set(updates).where(eq(users.id, user.id));
        Object.assign(user, updates);
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
      googleId: googleUser.sub,
      name: googleUser.name,
      email,
      passwordHash,
      role: "student",
      avatar: googleUser.picture || "",
      isEmailVerified: googleUser.email_verified,
      isActive: true,
    });
  } else {
    let changed = false;
    if (!user.avatar && googleUser.picture) { user.avatar = googleUser.picture; changed = true; }
    if (!user.isEmailVerified && googleUser.email_verified) { user.isEmailVerified = true; changed = true; }
    if (!user.googleId) { user.googleId = googleUser.sub; changed = true; }
    if (changed) await user.save();
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

export async function handleGoogleAuth(idToken: string) {
  const googleUser = await verifyGoogleToken(idToken);
  return findOrCreateUser(googleUser);
}

export async function handleGoogleCallback(code: string) {
  const tokens = await exchangeGoogleCode(code);
  const googleUser = await getGoogleUserInfo(tokens.access_token);
  return findOrCreateUser(googleUser);
}

export function getGoogleAuthUrl(returnTo?: string) {
  const clientId = env.GOOGLE_CLIENT_ID;
  const redirectUri = env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) return null;
  const state = returnTo ? Buffer.from(JSON.stringify({ returnTo })).toString("base64url") : "";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
  });
  if (state) params.set("state", state);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
