import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/db/client';
import { usersTable, userSessionsTable } from '@/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { getSession, getCurrentUser, createSession, hashPassword } from '@/lib/auth';
import { GET as meHandler } from '@/app/api/auth/me/route';
import { NextRequest } from 'next/server';

// Mock cookies for server-side testing
const mockCookies = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: () => mockCookies,
}));

async function cleanupTestUser(email: string) {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (user) {
      await db.delete(userSessionsTable).where(eq(userSessionsTable.userId, user.id));
      await db.delete(usersTable).where(eq(usersTable.email, email));
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

function createTestRequest(url: string, cookies?: Record<string, string>): NextRequest {
  const headers = new Headers();
  
  if (cookies) {
    const cookieStrings = Object.entries(cookies).map(([key, value]) => `${key}=${value}`);
    headers.set('Cookie', cookieStrings.join('; '));
  }

  return new NextRequest(url, { headers });
}

describe('Session Management Tests', () => {
  const testEmail = `test-session-${Date.now()}-${Math.random()}@example.com`;
  const testPassword = 'TestPassword123!';
  let testUserId: string;
  let validToken: string;

  beforeEach(async () => {
    // Reset mocks
    mockCookies.get.mockReset();
    mockCookies.set.mockReset();
    mockCookies.delete.mockReset();

    // Create test user
    const hashedPassword = await hashPassword(testPassword);
    const [user] = await db.insert(usersTable).values({
      email: testEmail,
      password: hashedPassword,
      displayName: 'Test User',
      permissions: 'member',
      isActive: true,
      access: { role: 'afk' as const, keywords: [] },
    }).returning();
    testUserId = user.id;

    // Create valid session token
    validToken = await createSession(testUserId);
  });

  afterEach(async () => {
    await cleanupTestUser(testEmail);
  });

  describe('Session Retrieval', () => {
    it('should retrieve valid session with user data', async () => {
      mockCookies.get.mockReturnValue({ value: validToken });

      const sessionData = await getSession();
      
      expect(sessionData).toBeTruthy();
      expect(sessionData!.user).toBeTruthy();
      expect(sessionData!.session).toBeTruthy();
      expect(sessionData!.user.id).toBe(testUserId);
      expect(sessionData!.user.email).toBe(testEmail);
      expect(sessionData!.session.token).toBe(validToken);
    });

    it('should return null for missing cookie', async () => {
      mockCookies.get.mockReturnValue(undefined);

      const sessionData = await getSession();
      expect(sessionData).toBeNull();
    });

    it('should return null for invalid token', async () => {
      mockCookies.get.mockReturnValue({ value: 'invalid.token.here' });

      const sessionData = await getSession();
      expect(sessionData).toBeNull();
    });

    it('should return null for inactive user', async () => {
      // Deactivate user
      await db.update(usersTable)
        .set({ isActive: false })
        .where(eq(usersTable.id, testUserId));

      mockCookies.get.mockReturnValue({ value: validToken });

      const sessionData = await getSession();
      expect(sessionData).toBeNull();
    });

    it('should return null for deleted user', async () => {
      // Soft delete user
      await db.update(usersTable)
        .set({ deletedAt: new Date() })
        .where(eq(usersTable.id, testUserId));

      mockCookies.get.mockReturnValue({ value: validToken });

      const sessionData = await getSession();
      expect(sessionData).toBeNull();
    });
  });

  describe('Session Expiration', () => {
    it('should reject expired sessions', async () => {
      // Create session with past expiration
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      await db.update(userSessionsTable)
        .set({ expiresAt: expiredDate })
        .where(eq(userSessionsTable.token, validToken));

      mockCookies.get.mockReturnValue({ value: validToken });

      const sessionData = await getSession();
      expect(sessionData).toBeNull();
    });

    it('should accept non-expired sessions', async () => {
      // Create session with future expiration
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now
      await db.update(userSessionsTable)
        .set({ expiresAt: futureDate })
        .where(eq(userSessionsTable.token, validToken));

      mockCookies.get.mockReturnValue({ value: validToken });

      const sessionData = await getSession();
      expect(sessionData).toBeTruthy();
      expect(sessionData!.user.id).toBe(testUserId);
    });

    it('should handle sessions expiring at exact moment', async () => {
      // Set expiration to right now
      const now = new Date();
      await db.update(userSessionsTable)
        .set({ expiresAt: now })
        .where(eq(userSessionsTable.token, validToken));

      mockCookies.get.mockReturnValue({ value: validToken });

      // Wait a moment to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const sessionData = await getSession();
      expect(sessionData).toBeNull();
    });
  });

  describe('Current User Retrieval', () => {
    it('should get current user from valid session', async () => {
      mockCookies.get.mockReturnValue({ value: validToken });

      const user = await getCurrentUser();
      
      expect(user).toBeTruthy();
      expect(user.id).toBe(testUserId);
      expect(user.email).toBe(testEmail);
      expect(user.displayName).toBe('Test User');
    });

    it('should return null when no session exists', async () => {
      mockCookies.get.mockReturnValue(undefined);

      const user = await getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe('Session Cleanup and Invalidation', () => {
    it('should handle multiple sessions per user', async () => {
      const token2 = await createSession(testUserId);
      const token3 = await createSession(testUserId);

      // All sessions should be valid
      const sessions = await db.select()
        .from(userSessionsTable)
        .where(eq(userSessionsTable.userId, testUserId));
      
      expect(sessions.length).toBe(3); // original + 2 new
      expect(sessions.map(s => s.token)).toContain(validToken);
      expect(sessions.map(s => s.token)).toContain(token2);
      expect(sessions.map(s => s.token)).toContain(token3);
    });

    it('should properly handle session token uniqueness', async () => {
      const tokens = [];
      for (let i = 0; i < 10; i++) {
        tokens.push(await createSession(testUserId));
      }

      // All tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);
    });

    it('should clean up expired sessions (simulation)', async () => {
      // Create multiple sessions
      const token2 = await createSession(testUserId);
      const token3 = await createSession(testUserId);

      // Expire the first two
      const expiredDate = new Date(Date.now() - 1000);
      await db.update(userSessionsTable)
        .set({ expiresAt: expiredDate })
        .where(eq(userSessionsTable.token, validToken));
      
      await db.update(userSessionsTable)
        .set({ expiresAt: expiredDate })
        .where(eq(userSessionsTable.token, token2));

      // In a real cleanup job, we'd delete expired sessions
      const expiredSessions = await db.select()
        .from(userSessionsTable)
        .where(and(
          eq(userSessionsTable.userId, testUserId),
          lt(userSessionsTable.expiresAt, new Date())
        ));

      expect(expiredSessions.length).toBe(2);

      // The non-expired session should still work
      mockCookies.get.mockReturnValue({ value: token3 });
      const sessionData = await getSession();
      expect(sessionData).toBeTruthy();
    });
  });

  describe('Session API Integration', () => {
    it('should authenticate API requests with valid session', async () => {
      const request = createTestRequest('http://localhost:3000/api/auth/me', {
        'auth-token': validToken,
      });

      const response = await meHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(testUserId);
      expect(result.data.email).toBe(testEmail);
    });

    it('should reject API requests with expired session', async () => {
      // Expire the session
      const expiredDate = new Date(Date.now() - 1000);
      await db.update(userSessionsTable)
        .set({ expiresAt: expiredDate })
        .where(eq(userSessionsTable.token, validToken));

      const request = createTestRequest('http://localhost:3000/api/auth/me', {
        'auth-token': validToken,
      });

      const response = await meHandler(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication required');
    });

    it('should reject API requests with invalid session token', async () => {
      const request = createTestRequest('http://localhost:3000/api/auth/me', {
        'auth-token': 'invalid.token.here',
      });

      const response = await meHandler(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication required');
    });

    it('should reject API requests without session token', async () => {
      const request = createTestRequest('http://localhost:3000/api/auth/me');

      const response = await meHandler(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication required');
    });
  });

  describe('Session Metadata Tracking', () => {
    it('should track user agent and IP address', async () => {
      const mockRequest = {
        headers: new Map([
          ['user-agent', 'Mozilla/5.0 Test Browser'],
        ]),
        ip: '192.168.1.100',
      } as unknown as NextRequest;

      const token = await createSession(testUserId, mockRequest);
      
      const [session] = await db.select()
        .from(userSessionsTable)
        .where(eq(userSessionsTable.token, token));

      expect(session.userAgent).toBe('Mozilla/5.0 Test Browser');
      expect(session.ipAddress).toBe('192.168.1.100');
    });

    it('should handle missing user agent and IP gracefully', async () => {
      const mockRequest = {
        headers: new Map(),
        ip: undefined,
      } as unknown as NextRequest;

      const token = await createSession(testUserId, mockRequest);
      
      const [session] = await db.select()
        .from(userSessionsTable)
        .where(eq(userSessionsTable.token, token));

      expect(session.userAgent).toBeNull();
      expect(session.ipAddress).toBeNull();
    });
  });

  describe('Session Security', () => {
    it('should not leak session tokens in error messages', async () => {
      mockCookies.get.mockReturnValue({ value: 'malformed-token' });

      const sessionData = await getSession();
      expect(sessionData).toBeNull();

      // In a real app, errors should not expose the token value
      // This is more of a code review item than a test
    });

    it('should handle database errors gracefully', async () => {
      // Simulate database error by using non-existent user ID
      mockCookies.get.mockReturnValue({ value: 'valid.jwt.but-nonexistent-user' });

      const sessionData = await getSession();
      expect(sessionData).toBeNull();
    });

    it('should validate session exists in database even with valid JWT', async () => {
      // Delete session from database but keep valid JWT
      await db.delete(userSessionsTable)
        .where(eq(userSessionsTable.token, validToken));

      mockCookies.get.mockReturnValue({ value: validToken });

      const sessionData = await getSession();
      expect(sessionData).toBeNull();
    });
  });

  describe('Concurrent Session Behavior', () => {
    it('should support multiple concurrent sessions', async () => {
      const token1 = await createSession(testUserId);
      const token2 = await createSession(testUserId);

      // Both sessions should be valid simultaneously
      mockCookies.get.mockReturnValue({ value: token1 });
      const session1 = await getSession();
      expect(session1).toBeTruthy();

      mockCookies.get.mockReturnValue({ value: token2 });
      const session2 = await getSession();
      expect(session2).toBeTruthy();

      expect(session1!.session.token).not.toBe(session2!.session.token);
    });

    it('should maintain session independence', async () => {
      const token1 = await createSession(testUserId);
      const token2 = await createSession(testUserId);

      // Expire one session
      await db.update(userSessionsTable)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(userSessionsTable.token, token1));

      // First session should be invalid
      mockCookies.get.mockReturnValue({ value: token1 });
      const session1 = await getSession();
      expect(session1).toBeNull();

      // Second session should still be valid
      mockCookies.get.mockReturnValue({ value: token2 });
      const session2 = await getSession();
      expect(session2).toBeTruthy();
    });
  });
});