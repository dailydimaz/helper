import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { usersTable, userSessionsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import { GET as meHandler } from '@/app/api/auth/me/route';
import { middleware } from '@/middleware';
import { createSession, verifyJWT, setAuthCookie, clearAuthCookie } from '@/lib/auth';

function createTestRequest(method: string, url: string, body?: any, cookies?: Record<string, string>): NextRequest {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'User-Agent': 'test-agent',
  });
  
  if (cookies) {
    const cookieStrings = Object.entries(cookies).map(([key, value]) => `${key}=${value}`);
    headers.set('Cookie', cookieStrings.join('; '));
  }

  const request = new NextRequest(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Mock IP for session tracking
  Object.defineProperty(request, 'ip', {
    value: '127.0.0.1',
    writable: false,
  });

  return request;
}

async function extractCookieFromResponse(response: Response): Promise<string | null> {
  const setCookieHeader = response.headers.get('Set-Cookie');
  if (!setCookieHeader) return null;
  
  const match = setCookieHeader.match(/auth-token=([^;]+)/);
  return match ? match[1] : null;
}

async function cleanupTestUser(email: string) {
  try {
    // Delete user sessions first (foreign key constraint)
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (user) {
      await db.delete(userSessionsTable).where(eq(userSessionsTable.userId, user.id));
      await db.delete(usersTable).where(eq(usersTable.email, email));
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

describe('Authentication End-to-End Tests', () => {
  const testEmail = `test-${Date.now()}-${Math.random()}@example.com`;
  const testPassword = 'TestPassword123!';
  const testDisplayName = 'Test User';

  afterEach(async () => {
    await cleanupTestUser(testEmail);
  });

  describe('Registration Flow', () => {
    it('should register a new user with complete validation', async () => {
      const request = createTestRequest('POST', 'http://localhost:3000/api/auth/register', {
        email: testEmail,
        password: testPassword,
        displayName: testDisplayName,
      });

      const response = await registerHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data.email).toBe(testEmail);
      expect(result.data.displayName).toBe(testDisplayName);
      expect(result.data.password).toBeUndefined(); // Should not return password
      expect(result.message).toBe('Registration successful');

      // Verify auth cookie is set
      const cookie = await extractCookieFromResponse(response);
      expect(cookie).toBeTruthy();

      // Verify user exists in database
      const [user] = await db.select().from(usersTable).where(eq(usersTable.email, testEmail)).limit(1);
      expect(user).toBeTruthy();
      expect(user.email).toBe(testEmail);
      expect(user.isActive).toBe(true);
    });

    it('should validate email format during registration', async () => {
      const request = createTestRequest('POST', 'http://localhost:3000/api/auth/register', {
        email: 'invalid-email',
        password: testPassword,
        displayName: testDisplayName,
      });

      const response = await registerHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email address');
    });

    it('should validate password length during registration', async () => {
      const request = createTestRequest('POST', 'http://localhost:3000/api/auth/register', {
        email: testEmail,
        password: 'short',
        displayName: testDisplayName,
      });

      const response = await registerHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Password must be at least 8 characters');
    });

    it('should prevent duplicate email registration', async () => {
      // First registration
      await registerHandler(createTestRequest('POST', 'http://localhost:3000/api/auth/register', {
        email: testEmail,
        password: testPassword,
        displayName: testDisplayName,
      }));

      // Second registration with same email
      const request = createTestRequest('POST', 'http://localhost:3000/api/auth/register', {
        email: testEmail,
        password: 'AnotherPassword123!',
        displayName: 'Another User',
      });

      const response = await registerHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toBe('User with this email already exists');
    });

    it('should handle registration without display name', async () => {
      const request = createTestRequest('POST', 'http://localhost:3000/api/auth/register', {
        email: testEmail,
        password: testPassword,
      });

      const response = await registerHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.displayName).toBe('');
    });
  });

  describe('Login Flow', () => {
    beforeEach(async () => {
      // Register a user for login tests
      await registerHandler(createTestRequest('POST', 'http://localhost:3000/api/auth/register', {
        email: testEmail,
        password: testPassword,
        displayName: testDisplayName,
      }));
    });

    it('should login with valid credentials', async () => {
      const request = createTestRequest('POST', 'http://localhost:3000/api/auth/login', {
        email: testEmail,
        password: testPassword,
      });

      const response = await loginHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data.email).toBe(testEmail);
      expect(result.data.password).toBeUndefined(); // Should not return password
      expect(result.message).toBe('Login successful');

      // Verify auth cookie is set
      const cookie = await extractCookieFromResponse(response);
      expect(cookie).toBeTruthy();

      // Verify session exists in database
      const sessions = await db.select().from(userSessionsTable).where(eq(userSessionsTable.token, cookie!));
      expect(sessions.length).toBe(1);
    });

    it('should reject invalid email', async () => {
      const request = createTestRequest('POST', 'http://localhost:3000/api/auth/login', {
        email: 'nonexistent@example.com',
        password: testPassword,
      });

      const response = await loginHandler(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should reject invalid password', async () => {
      const request = createTestRequest('POST', 'http://localhost:3000/api/auth/login', {
        email: testEmail,
        password: 'wrongpassword',
      });

      const response = await loginHandler(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });

    it('should validate email format during login', async () => {
      const request = createTestRequest('POST', 'http://localhost:3000/api/auth/login', {
        email: 'invalid-email',
        password: testPassword,
      });

      const response = await loginHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email address');
    });

    it('should require password field', async () => {
      const request = createTestRequest('POST', 'http://localhost:3000/api/auth/login', {
        email: testEmail,
      });

      const response = await loginHandler(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Password is required');
    });
  });

  describe('Session Management', () => {
    let authToken: string;

    beforeEach(async () => {
      // Register and login to get auth token
      await registerHandler(createTestRequest('POST', 'http://localhost:3000/api/auth/register', {
        email: testEmail,
        password: testPassword,
        displayName: testDisplayName,
      }));

      const loginResponse = await loginHandler(createTestRequest('POST', 'http://localhost:3000/api/auth/login', {
        email: testEmail,
        password: testPassword,
      }));

      authToken = await extractCookieFromResponse(loginResponse) || '';
    });

    it('should return user data for authenticated requests', async () => {
      const request = createTestRequest('GET', 'http://localhost:3000/api/auth/me', undefined, {
        'auth-token': authToken,
      });

      const response = await meHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(result.data.email).toBe(testEmail);
      expect(result.data.password).toBeUndefined();
    });

    it('should reject unauthenticated requests to /me', async () => {
      const request = createTestRequest('GET', 'http://localhost:3000/api/auth/me');

      const response = await meHandler(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication required');
    });

    it('should reject requests with invalid tokens', async () => {
      const request = createTestRequest('GET', 'http://localhost:3000/api/auth/me', undefined, {
        'auth-token': 'invalid-token',
      });

      const response = await meHandler(request);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication required');
    });

    it('should validate JWT token format and expiration', async () => {
      const payload = await verifyJWT(authToken);
      expect(payload).toBeTruthy();
      expect(payload.userId).toBeTruthy();
      expect(payload.type).toBe('session');
      expect(payload.iat).toBeTruthy();
      expect(payload.exp).toBeTruthy();
    });
  });

  describe('Logout Flow', () => {
    let authToken: string;

    beforeEach(async () => {
      // Register and login to get auth token
      await registerHandler(createTestRequest('POST', 'http://localhost:3000/api/auth/register', {
        email: testEmail,
        password: testPassword,
        displayName: testDisplayName,
      }));

      const loginResponse = await loginHandler(createTestRequest('POST', 'http://localhost:3000/api/auth/login', {
        email: testEmail,
        password: testPassword,
      }));

      authToken = await extractCookieFromResponse(loginResponse) || '';
    });

    it('should logout and clear session', async () => {
      const request = createTestRequest('POST', 'http://localhost:3000/api/auth/logout', undefined, {
        'auth-token': authToken,
      });

      const response = await logoutHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Logout successful');

      // Verify auth cookie is cleared
      const setCookieHeader = response.headers.get('Set-Cookie');
      expect(setCookieHeader).toContain('auth-token=;');

      // Verify session is invalidated
      const meRequest = createTestRequest('GET', 'http://localhost:3000/api/auth/me', undefined, {
        'auth-token': authToken,
      });
      const meResponse = await meHandler(meRequest);
      expect(meResponse.status).toBe(401);
    });

    it('should handle logout without active session', async () => {
      const request = createTestRequest('POST', 'http://localhost:3000/api/auth/logout');

      const response = await logoutHandler(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Logout successful');
    });
  });

  describe('HTTP-Only Cookie Handling', () => {
    it('should set HTTP-only cookies with proper security attributes', async () => {
      const response = setAuthCookie('test-token');
      const setCookieHeader = response.headers.get('Set-Cookie');

      expect(setCookieHeader).toBeTruthy();
      expect(setCookieHeader).toContain('auth-token=test-token');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('SameSite=Lax');
      expect(setCookieHeader).toContain('Path=/');
      expect(setCookieHeader).toContain('Max-Age=604800'); // 7 days
    });

    it('should clear cookies properly', async () => {
      const response = clearAuthCookie();
      const setCookieHeader = response.headers.get('Set-Cookie');

      expect(setCookieHeader).toBeTruthy();
      expect(setCookieHeader).toContain('auth-token=;');
    });

    it('should include Secure flag in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = setAuthCookie('test-token');
      const setCookieHeader = response.headers.get('Set-Cookie');

      expect(setCookieHeader).toContain('Secure');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Concurrent Session Handling', () => {
    beforeEach(async () => {
      await registerHandler(createTestRequest('POST', 'http://localhost:3000/api/auth/register', {
        email: testEmail,
        password: testPassword,
        displayName: testDisplayName,
      }));
    });

    it('should allow multiple concurrent sessions', async () => {
      // Create first session
      const login1Response = await loginHandler(createTestRequest('POST', 'http://localhost:3000/api/auth/login', {
        email: testEmail,
        password: testPassword,
      }));
      const token1 = await extractCookieFromResponse(login1Response) || '';

      // Create second session
      const login2Response = await loginHandler(createTestRequest('POST', 'http://localhost:3000/api/auth/login', {
        email: testEmail,
        password: testPassword,
      }));
      const token2 = await extractCookieFromResponse(login2Response) || '';

      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).not.toBe(token2);

      // Both sessions should work
      const me1Response = await meHandler(createTestRequest('GET', 'http://localhost:3000/api/auth/me', undefined, {
        'auth-token': token1,
      }));
      const me2Response = await meHandler(createTestRequest('GET', 'http://localhost:3000/api/auth/me', undefined, {
        'auth-token': token2,
      }));

      expect(me1Response.status).toBe(200);
      expect(me2Response.status).toBe(200);

      // Verify both sessions exist in database
      const [user] = await db.select().from(usersTable).where(eq(usersTable.email, testEmail)).limit(1);
      const sessions = await db.select().from(userSessionsTable).where(eq(userSessionsTable.userId, user.id));
      expect(sessions.length).toBeGreaterThanOrEqual(2);
    });
  });
});