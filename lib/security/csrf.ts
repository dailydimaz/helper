import { NextRequest, NextResponse } from "next/server";
import { randomBytes, timingSafeEqual, createHash } from "@/lib/crypto-polyfill";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

const CSRF_SECRET = new TextEncoder().encode(env.JWT_SECRET);
const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_TOKEN_LIFETIME = 24 * 60 * 60 * 1000; // 24 hours

// Endpoints that require CSRF protection
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];
const CSRF_PROTECTED_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/conversation',
  '/api/messages',
  '/api/files',
  '/api/saved-replies',
  '/api/members',
  '/api/settings',
];

export interface CSRFTokenPayload {
  sessionId: string;
  userId?: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Generate a CSRF token for a session
 */
export async function generateCSRFToken(sessionId: string, userId?: string): Promise<string> {
  const now = Date.now();
  const payload: CSRFTokenPayload = {
    sessionId,
    userId,
    issuedAt: now,
    expiresAt: now + CSRF_TOKEN_LIFETIME,
  };

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((now + CSRF_TOKEN_LIFETIME) / 1000))
    .sign(CSRF_SECRET);
}

/**
 * Verify a CSRF token
 */
export async function verifyCSRFToken(token: string): Promise<CSRFTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, CSRF_SECRET);
    const csrfPayload = payload as CSRFTokenPayload;
    
    // Additional expiry check
    if (csrfPayload.expiresAt < Date.now()) {
      return null;
    }
    
    return csrfPayload;
  } catch {
    return null;
  }
}

/**
 * Generate a double-submit cookie token (alternative method)
 */
export function generateDoubleSubmitToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Verify double-submit cookie token
 */
export function verifyDoubleSubmitToken(cookieToken: string, headerToken: string): boolean {
  if (!cookieToken || !headerToken) return false;
  
  try {
    const cookieBuffer = Buffer.from(cookieToken, 'hex');
    const headerBuffer = Buffer.from(headerToken, 'hex');
    
    return cookieBuffer.length === headerBuffer.length && 
           timingSafeEqual(cookieBuffer, headerBuffer);
  } catch {
    return false;
  }
}

/**
 * Check if request requires CSRF protection
 */
export function requiresCSRFProtection(request: NextRequest): boolean {
  const method = request.method;
  const pathname = request.nextUrl.pathname;
  
  // Only protect state-changing methods
  if (!CSRF_PROTECTED_METHODS.includes(method)) {
    return false;
  }
  
  // Check if path requires CSRF protection
  return CSRF_PROTECTED_PATHS.some(path => pathname.startsWith(path));
}

/**
 * Verify CSRF protection for a request
 */
export async function verifyCSRFProtection(request: NextRequest): Promise<{
  valid: boolean;
  error?: string;
  sessionId?: string;
}> {
  if (!requiresCSRFProtection(request)) {
    return { valid: true };
  }

  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;

  if (!headerToken) {
    return {
      valid: false,
      error: 'CSRF token missing from request headers',
    };
  }

  if (!cookieToken) {
    return {
      valid: false,
      error: 'CSRF token missing from cookies',
    };
  }

  // Try JWT-based CSRF token first
  const jwtPayload = await verifyCSRFToken(headerToken);
  if (jwtPayload) {
    // Verify the cookie token matches (double-submit pattern)
    const cookieHash = createHash('sha256').update(cookieToken).digest('hex');
    const expectedHash = createHash('sha256').update(jwtPayload.sessionId).digest('hex');
    
    if (cookieHash === expectedHash) {
      return {
        valid: true,
        sessionId: jwtPayload.sessionId,
      };
    }
  }

  // Fallback to double-submit cookie method
  if (verifyDoubleSubmitToken(cookieToken, headerToken)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: 'Invalid CSRF token',
  };
}

/**
 * Set CSRF token in response
 */
export function setCSRFToken(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Needs to be accessible by JavaScript for header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_LIFETIME / 1000,
    path: '/',
  });

  // Also set in header for immediate use
  response.headers.set('X-CSRF-Token', token);
}

/**
 * Clear CSRF token from response
 */
export function clearCSRFToken(response: NextResponse): void {
  response.cookies.delete(CSRF_COOKIE_NAME);
}

/**
 * CSRF middleware factory
 */
export function createCSRFMiddleware() {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    if (!requiresCSRFProtection(request)) {
      return null; // Continue to next middleware
    }

    const verification = await verifyCSRFProtection(request);
    
    if (!verification.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'CSRF protection failed',
          message: verification.error || 'Invalid CSRF token',
        },
        { status: 403 }
      );
    }

    return null; // Continue to next middleware
  };
}

/**
 * Generate CSRF token for new session
 */
export async function initializeCSRF(
  request: NextRequest,
  response: NextResponse,
  sessionId: string,
  userId?: string
): Promise<void> {
  // Generate JWT-based CSRF token
  const jwtToken = await generateCSRFToken(sessionId, userId);
  
  // Generate cookie token (hashed session ID for double-submit)
  const cookieToken = createHash('sha256').update(sessionId).digest('hex');
  
  // Set both tokens
  setCSRFToken(response, jwtToken);
  response.cookies.set(CSRF_COOKIE_NAME, cookieToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_LIFETIME / 1000,
    path: '/',
  });
}

/**
 * Refresh CSRF token (called on user actions)
 */
export async function refreshCSRFToken(
  sessionId: string,
  userId?: string
): Promise<string> {
  return await generateCSRFToken(sessionId, userId);
}

/**
 * Origin validation (additional CSRF protection)
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  if (!host) return false;

  const allowedOrigins = [
    `https://${host}`,
    `http://${host}`, // Allow HTTP in development
    env.NEXT_PUBLIC_APP_URL,
  ];

  // Check origin header
  if (origin && !allowedOrigins.includes(origin)) {
    return false;
  }

  // Check referer header as fallback
  if (!origin && referer) {
    const refererUrl = new URL(referer);
    const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
    
    return allowedOrigins.includes(refererOrigin);
  }

  // Allow if no origin header (direct API calls, mobile apps, etc.)
  return true;
}

/**
 * Enhanced CSRF protection with origin validation
 */
export async function validateCSRFWithOrigin(request: NextRequest): Promise<{
  valid: boolean;
  error?: string;
  sessionId?: string;
}> {
  // First check origin
  if (!validateOrigin(request)) {
    return {
      valid: false,
      error: 'Request origin not allowed',
    };
  }

  // Then check CSRF token
  return await verifyCSRFProtection(request);
}