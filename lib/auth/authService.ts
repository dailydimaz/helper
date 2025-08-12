import * as argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema/users";
import { eq } from "drizzle-orm";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-super-secret-jwt-key");
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

export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    return await argon2.verify(hashedPassword, password);
  } catch {
    return false;
  }
}

export async function createJWT(user: AuthUser): Promise<string> {
  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    permissions: user.permissions,
    access: user.access,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET);
  
  return token;
}

export async function verifyJWT(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.userId as string,
      email: payload.email as string,
      displayName: payload.displayName as string,
      permissions: payload.permissions as string,
      access: payload.access as { role: "afk" | "core" | "nonCore"; keywords: string[] },
    };
  } catch {
    return null;
  }
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (!user || !user.isActive || user.deletedAt) {
      return null;
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName || "",
      permissions: user.permissions,
      access: user.access,
    };
  } catch {
    return null;
  }
}

export async function createUser(email: string, password: string, displayName?: string): Promise<AuthUser | null> {
  try {
    const hashedPassword = await hashPassword(password);
    
    const [newUser] = await db
      .insert(usersTable)
      .values({
        email: email.toLowerCase(),
        password: hashedPassword,
        displayName: displayName || "",
        permissions: "member",
        isActive: true,
        access: { role: "afk", keywords: [] },
      })
      .returning();

    return {
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName || "",
      permissions: newUser.permissions,
      access: newUser.access,
    };
  } catch {
    return null;
  }
}
