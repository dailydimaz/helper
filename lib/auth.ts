import * as argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { usersTable, userSessionsTable } from "@/db/schema";
import { env } from "./env";
import { eq } from "drizzle-orm";

// JWT configuration
const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);
const JWT_COOKIE_NAME = "auth-token";

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    return false;
  }
}

// JWT utilities
export async function signJWT(payload: Record<string, any>): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(JWT_SECRET);
}

export async function verifyJWT(token: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch (error) {
    return null;
  }
}

// Session management
export async function createSession(userId: string, request?: NextRequest): Promise<string> {
  const token = await signJWT({ 
    userId, 
    type: "session",
    iat: Math.floor(Date.now() / 1000)
  });

  const expiresAt = new Date();
  expiresAt.setTime(expiresAt.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days

  await db.insert(userSessionsTable).values({
    userId,
    token,
    expiresAt,
    userAgent: request?.headers.get("user-agent") || null,
    ipAddress: request?.ip || null,
  });

  return token;
}

export async function getSession(): Promise<{ user: any; session: any } | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(JWT_COOKIE_NAME)?.value;

    if (!token) return null;

    const payload = await verifyJWT(token);
    if (!payload || !payload.userId) return null;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    if (!user || !user.isActive) return null;

    const [session] = await db
      .select()
      .from(userSessionsTable)
      .where(eq(userSessionsTable.token, token))
      .limit(1);

    if (!session || session.expiresAt < new Date()) return null;

    return { user, session };
  } catch (error) {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

// Cookie utilities
export function setAuthCookie(token: string): NextResponse {
  const response = NextResponse.json({ success: true });
  response.cookies.set(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });
  return response;
}

export function clearAuthCookie(): NextResponse {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(JWT_COOKIE_NAME);
  return response;
}

// User management
export async function createUser(email: string, password: string, displayName?: string) {
  const hashedPassword = await hashPassword(password);
  
  const [newUser] = await db.insert(usersTable).values({
    email,
    password: hashedPassword,
    displayName: displayName || "",
  }).returning();

  return newUser;
}

export async function authenticateUser(email: string, password: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user || !user.isActive) return null;

  const isValidPassword = await verifyPassword(password, user.password);
  if (!isValidPassword) return null;

  return user;
}

// Middleware helper
export async function withAuth(request: NextRequest): Promise<{ user: any } | null> {
  const token = request.cookies.get(JWT_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyJWT(token);
  if (!payload || !payload.userId) return null;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId))
    .limit(1);

  if (!user || !user.isActive) return null;

  return { user };
}

// Permission utilities
export function hasPermission(user: any, permission: string): boolean {
  return user.permissions === "admin" || user.permissions === permission;
}

export function requirePermission(user: any, permission: string): void {
  if (!hasPermission(user, permission)) {
    throw new Error("Insufficient permissions");
  }
}