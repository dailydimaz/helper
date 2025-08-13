import { SignJWT, jwtVerify } from "jose";
import { createHash } from "crypto";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema/users";
import { eq } from "drizzle-orm";

const jwtSecretEnv = process.env.JWT_SECRET;
if (!jwtSecretEnv) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretEnv);
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  permissions: string;
  access: {
    role: "afk" | "core" | "nonCore";
    keywords: string[];
  };
};

// Simple hash function for development (NOT for production)
function simpleHash(password: string): string {
  return createHash('sha256').update(password + 'salt').digest('hex');
}

export async function createUser(email: string, password: string, displayName: string): Promise<AuthUser | null> {
  try {
    const hashedPassword = simpleHash(password);
    
    const [user] = await db
      .insert(usersTable)
      .values({
        email,
        displayName,
        password: hashedPassword,
        permissions: "user",
      })
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        permissions: usersTable.permissions,
      });

    if (!user) return null;

    return {
      ...user,
      displayName: user.displayName || "",
      access: {
        role: "core",
        keywords: [],
      },
    };
  } catch (error) {
    console.error("Create user error:", error);
    return null;
  }
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  try {
    const hashedPassword = simpleHash(password);
    
    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        permissions: usersTable.permissions,
        password: usersTable.password,
      })
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (!user || user.password !== hashedPassword) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName || "",
      permissions: user.permissions,
      access: {
        role: "core",
        keywords: [],
      },
    };
  } catch (error) {
    console.error("Authenticate user error:", error);
    return null;
  }
}

export async function createJWT(user: AuthUser): Promise<string> {
  const payload = {
    sub: user.id.toString(),
    email: user.email,
    displayName: user.displayName,
    permissions: user.permissions,
    access: user.access,
  };

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET);

  return jwt;
}

export async function verifyJWT(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    return {
      id: payload.sub as string,
      email: payload.email as string,
      displayName: payload.displayName as string,
      permissions: payload.permissions as string,
      access: payload.access as AuthUser['access'],
    };
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
}