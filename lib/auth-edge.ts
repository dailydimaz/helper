// Edge Runtime compatible auth utilities (JWT only, no password hashing)
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

// JWT configuration
const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);

// JWT utilities (Edge Runtime compatible)
export async function signJWT(payload: Record<string, any>, expiresIn = "7d"): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export async function verifyJWT(token: string): Promise<any> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload;
}

// Password functions not available in Edge Runtime
export async function hashPassword(password: string): Promise<string> {
  throw new Error('Password hashing not available in Edge Runtime');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  throw new Error('Password verification not available in Edge Runtime');
}