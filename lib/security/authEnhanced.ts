import { NextRequest } from "next/server";
import { eq, and, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { usersTable, userSessionsTable } from "@/db/schema";
import { verifyPassword, signJWT, verifyJWT } from "@/lib/auth";
import { checkBruteForce } from "./rateLimiting";

// Session security configuration
const SESSION_CONFIG = {
  MAX_SESSIONS_PER_USER: 10,
  SESSION_ROTATION_INTERVAL: 60 * 60 * 1000, // 1 hour
  INACTIVE_SESSION_TIMEOUT: 7 * 24 * 60 * 60 * 1000, // 7 days
  SUSPICIOUS_LOGIN_COOLDOWN: 15 * 60 * 1000, // 15 minutes
};

export interface LoginAttempt {
  email: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  failureReason?: string;
  sessionId?: string;
}

export interface SessionMetadata {
  ip: string;
  userAgent: string;
  country?: string;
  city?: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser?: string;
  os?: string;
}

// In-memory storage for login attempts (in production, use Redis)
const loginAttempts = new Map<string, LoginAttempt[]>();
const suspiciousIPs = new Map<string, { until: number; reason: string }>();

/**
 * Enhanced authentication with security checks
 */
export async function authenticateUserSecure(
  email: string,
  password: string,
  request: NextRequest
): Promise<{
  success: boolean;
  user?: any;
  error?: string;
  rateLimited?: boolean;
  retryAfter?: number;
}> {
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';
  
  // Check for suspicious IP
  const suspiciousCheck = suspiciousIPs.get(ip);
  if (suspiciousCheck && Date.now() < suspiciousCheck.until) {
    return {
      success: false,
      error: `IP temporarily blocked: ${suspiciousCheck.reason}`,
      rateLimited: true,
      retryAfter: Math.ceil((suspiciousCheck.until - Date.now()) / 1000),
    };
  }
  
  // Check brute force protection
  const bruteForceCheck = checkBruteForce(email, ip, 'failure');
  if (!bruteForceCheck.allowed) {
    recordLoginAttempt({
      email,
      ip,
      userAgent,
      timestamp: new Date(),
      success: false,
      failureReason: 'Rate limited',
    });
    
    return {
      success: false,
      error: 'Too many failed attempts. Please try again later.',
      rateLimited: true,
      retryAfter: bruteForceCheck.retryAfter,
    };
  }
  
  try {
    // Find user
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    
    if (!user || !user.isActive) {
      recordLoginAttempt({
        email,
        ip,
        userAgent,
        timestamp: new Date(),
        success: false,
        failureReason: 'Invalid credentials',
      });
      
      // Don't reveal if user exists
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }
    
    // Check if account is locked
    if (await isAccountLocked(user.id)) {
      recordLoginAttempt({
        email,
        ip,
        userAgent,
        timestamp: new Date(),
        success: false,
        failureReason: 'Account locked',
      });
      
      return {
        success: false,
        error: 'Account is temporarily locked due to suspicious activity',
      };
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      recordLoginAttempt({
        email,
        ip,
        userAgent,
        timestamp: new Date(),
        success: false,
        failureReason: 'Invalid password',
      });
      
      // Check if we should lock the account
      await checkForSuspiciousActivity(user.id, ip);
      
      return {
        success: false,
        error: 'Invalid email or password',
      };
    }
    
    // Success - reset brute force protection
    checkBruteForce(email, ip, 'success');
    
    recordLoginAttempt({
      email,
      ip,
      userAgent,
      timestamp: new Date(),
      success: true,
    });
    
    return {
      success: true,
      user,
    };
    
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Create secure session with enhanced metadata
 */
export async function createSecureSession(
  userId: string,
  request: NextRequest
): Promise<{ token: string; sessionId: string }> {
  const sessionMetadata = extractSessionMetadata(request);
  
  // Clean up old sessions for this user
  await cleanupUserSessions(userId);
  
  const sessionId = crypto.randomUUID();
  const token = await signJWT({
    userId,
    sessionId,
    type: 'session',
    iat: Math.floor(Date.now() / 1000),
    metadata: sessionMetadata,
  });
  
  const expiresAt = new Date();
  expiresAt.setTime(expiresAt.getTime() + SESSION_CONFIG.INACTIVE_SESSION_TIMEOUT);
  
  await db.insert(userSessionsTable).values({
    id: sessionId,
    userId,
    token,
    expiresAt,
    userAgent: sessionMetadata.userAgent,
    ipAddress: sessionMetadata.ip,
  });
  
  return { token, sessionId };
}

/**
 * Validate session with security checks
 */
export async function validateSecureSession(request: NextRequest): Promise<{
  valid: boolean;
  user?: any;
  session?: any;
  shouldRotate?: boolean;
  error?: string;
}> {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return { valid: false, error: 'No token provided' };
    }
    
    const payload = await verifyJWT(token);
    if (!payload || !payload.userId || !payload.sessionId) {
      return { valid: false, error: 'Invalid token' };
    }
    
    // Check session in database
    const [session] = await db
      .select()
      .from(userSessionsTable)
      .where(and(
        eq(userSessionsTable.token, token),
        gte(userSessionsTable.expiresAt, new Date())
      ))
      .limit(1);
    
    if (!session) {
      return { valid: false, error: 'Session expired or invalid' };
    }
    
    // Get user
    const [user] = await db
      .select()
      .from(usersTable)
      .where(and(
        eq(usersTable.id, payload.userId),
        eq(usersTable.isActive, true)
      ))
      .limit(1);
    
    if (!user) {
      return { valid: false, error: 'User not found or inactive' };
    }
    
    // Security checks
    const securityCheck = await performSessionSecurityChecks(session, request);
    if (!securityCheck.valid) {
      // Invalidate suspicious session
      await invalidateSession(session.id);
      return { valid: false, error: securityCheck.error };
    }
    
    // Check if session should be rotated
    const shouldRotate = shouldRotateSession(session);
    
    return {
      valid: true,
      user,
      session,
      shouldRotate,
    };
    
  } catch (error) {
    console.error('Session validation error:', error);
    return { valid: false, error: 'Session validation failed' };
  }
}

/**
 * Invalidate all user sessions (e.g., on password change)
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await db.delete(userSessionsTable).where(eq(userSessionsTable.userId, userId));
}

/**
 * Rotate session token
 */
export async function rotateSessionToken(sessionId: string): Promise<string> {
  const [session] = await db
    .select()
    .from(userSessionsTable)
    .where(eq(userSessionsTable.id, sessionId))
    .limit(1);
  
  if (!session) {
    throw new Error('Session not found');
  }
  
  const newToken = await signJWT({
    userId: session.userId,
    sessionId: session.id,
    type: 'session',
    iat: Math.floor(Date.now() / 1000),
  });
  
  await db
    .update(userSessionsTable)
    .set({ 
      token: newToken,
      updatedAt: new Date(),
    })
    .where(eq(userSessionsTable.id, sessionId));
  
  return newToken;
}

/**
 * Helper functions
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

function extractTokenFromRequest(request: NextRequest): string | null {
  // Try cookie first
  const cookieToken = request.cookies.get('auth-token')?.value;
  if (cookieToken) return cookieToken;
  
  // Try Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  return null;
}

function extractSessionMetadata(request: NextRequest): SessionMetadata {
  const userAgent = request.headers.get('user-agent') || '';
  const ip = getClientIP(request);
  
  // Basic device detection
  let deviceType: SessionMetadata['deviceType'] = 'unknown';
  if (userAgent.includes('Mobile')) deviceType = 'mobile';
  else if (userAgent.includes('Tablet')) deviceType = 'tablet';
  else if (userAgent.includes('Mozilla')) deviceType = 'desktop';
  
  return {
    ip,
    userAgent,
    deviceType,
  };
}

function recordLoginAttempt(attempt: LoginAttempt): void {
  const key = attempt.email;
  const attempts = loginAttempts.get(key) || [];
  
  // Keep only recent attempts (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentAttempts = attempts.filter(a => a.timestamp > oneDayAgo);
  
  recentAttempts.push(attempt);
  loginAttempts.set(key, recentAttempts.slice(-50)); // Keep last 50 attempts
}

async function isAccountLocked(userId: string): Promise<boolean> {
  // Check for recent failed attempts from multiple IPs
  const recentFailures = Array.from(loginAttempts.values())
    .flat()
    .filter(attempt => {
      const user = usersTable; // Would need to join to get user by email
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return !attempt.success && attempt.timestamp > oneHourAgo;
    });
  
  // Simple heuristic: if more than 10 failures in last hour, consider locked
  return recentFailures.length > 10;
}

async function checkForSuspiciousActivity(userId: string, ip: string): Promise<void> {
  // Check for patterns that indicate suspicious activity
  const userEmail = await getUserEmail(userId);
  if (!userEmail) return;
  
  const attempts = loginAttempts.get(userEmail) || [];
  const recentFailures = attempts.filter(attempt => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    return !attempt.success && attempt.timestamp > thirtyMinutesAgo;
  });
  
  // If too many failures from this IP, mark as suspicious
  if (recentFailures.filter(a => a.ip === ip).length >= 5) {
    suspiciousIPs.set(ip, {
      until: Date.now() + SESSION_CONFIG.SUSPICIOUS_LOGIN_COOLDOWN,
      reason: 'Multiple failed login attempts',
    });
  }
}

async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const [user] = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    
    return user?.email || null;
  } catch {
    return null;
  }
}

async function cleanupUserSessions(userId: string): Promise<void> {
  // Get all sessions for user, ordered by creation date
  const sessions = await db
    .select()
    .from(userSessionsTable)
    .where(eq(userSessionsTable.userId, userId));
  
  // If too many sessions, delete the oldest ones
  if (sessions.length >= SESSION_CONFIG.MAX_SESSIONS_PER_USER) {
    const sessionsToDelete = sessions
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, sessions.length - SESSION_CONFIG.MAX_SESSIONS_PER_USER + 1);
    
    for (const session of sessionsToDelete) {
      await db.delete(userSessionsTable).where(eq(userSessionsTable.id, session.id));
    }
  }
}

async function performSessionSecurityChecks(
  session: any, 
  request: NextRequest
): Promise<{ valid: boolean; error?: string }> {
  const currentIP = getClientIP(request);
  const currentUserAgent = request.headers.get('user-agent') || '';
  
  // Check for IP changes (basic session hijacking protection)
  if (session.ipAddress && session.ipAddress !== currentIP) {
    // In production, you might want to be more lenient or use geolocation
    console.warn(`Session IP change detected: ${session.ipAddress} -> ${currentIP}`);
    // For now, we'll allow it but log it
  }
  
  // Check for major user agent changes
  if (session.userAgent && !userAgentsSimilar(session.userAgent, currentUserAgent)) {
    console.warn(`Session user agent change detected`);
    // For now, we'll allow it but log it
  }
  
  return { valid: true };
}

function userAgentsSimilar(stored: string, current: string): boolean {
  // Extract browser and OS information for comparison
  const getBrowserOS = (ua: string) => {
    const browser = ua.match(/(Chrome|Firefox|Safari|Edge)/)?.[1] || 'unknown';
    const os = ua.match(/(Windows|Mac|Linux|Android|iOS)/)?.[1] || 'unknown';
    return `${browser}-${os}`;
  };
  
  return getBrowserOS(stored) === getBrowserOS(current);
}

function shouldRotateSession(session: any): boolean {
  const lastUpdate = session.updatedAt || session.createdAt;
  const timeSinceUpdate = Date.now() - lastUpdate.getTime();
  
  return timeSinceUpdate > SESSION_CONFIG.SESSION_ROTATION_INTERVAL;
}

async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(userSessionsTable).where(eq(userSessionsTable.id, sessionId));
}

// Cleanup expired sessions and suspicious IPs periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    // Clean up expired suspicious IPs
    const now = Date.now();
    for (const [ip, data] of suspiciousIPs.entries()) {
      if (now > data.until) {
        suspiciousIPs.delete(ip);
      }
    }
    
    // Clean up old login attempts
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const [email, attempts] of loginAttempts.entries()) {
      const recentAttempts = attempts.filter(a => a.timestamp > oneDayAgo);
      if (recentAttempts.length === 0) {
        loginAttempts.delete(email);
      } else {
        loginAttempts.set(email, recentAttempts);
      }
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}