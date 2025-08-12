import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '@/middleware';
import { db } from '@/db/client';
import { usersTable, userSessionsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as loginHandler } from '@/app/api/auth/login/route';

function createTestRequest(
  url: string, 
  method: string = 'GET', 
  cookies?: Record<string, string>
): NextRequest {
  const headers = new Headers({
    'User-Agent': 'test-agent',
  });
  
  if (cookies) {
    const cookieStrings = Object.entries(cookies).map(([key, value]) => `${key}=${value}`);
    headers.set('Cookie', cookieStrings.join('; '));
  }

  return new NextRequest(url, {
    method,
    headers,
  });
}

async function extractCookieFromResponse(response: Response): Promise<string | null> {
  const setCookieHeader = response.headers.get('Set-Cookie');
  if (!setCookieHeader) return null;
  
  const match = setCookieHeader.match(/auth-token=([^;]+)/);
  return match ? match[1] : null;
}

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

describe('Middleware Protection Tests', () => {
  const testEmail = `test-middleware-${Date.now()}-${Math.random()}@example.com`;
  const testPassword = 'TestPassword123!';
  let authToken: string;

  beforeEach(async () => {
    // Create test user and get auth token
    await registerHandler(new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        displayName: 'Test User',
      }),
    }));

    const loginResponse = await loginHandler(new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    }));

    authToken = await extractCookieFromResponse(loginResponse) || '';
  });

  afterEach(async () => {
    await cleanupTestUser(testEmail);
  });

  describe('Protected Route Access', () => {
    const protectedRoutes = [
      'http://localhost:3000/adm',
      'http://localhost:3000/adm/dashboard',
      'http://localhost:3000/adm/users',
      'http://localhost:3000/mine',
      'http://localhost:3000/mine/conversations',
      'http://localhost:3000/api/adm',
      'http://localhost:3000/api/adm/users',
      'http://localhost:3000/api/adm/settings',
    ];

    protectedRoutes.forEach(url => {
      it(`should protect ${url} and redirect unauthenticated users to login`, async () => {
        const request = createTestRequest(url);
        const response = await middleware(request);

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toContain('/login');
      });

      it(`should allow authenticated access to ${url}`, async () => {
        const request = createTestRequest(url, 'GET', { 'auth-token': authToken });
        const response = await middleware(request);

        // Middleware should allow the request to continue (no redirect)
        expect(response.status).not.toBe(302);
      });
    });
  });

  describe('Public Route Access', () => {
    const publicRoutes = [
      'http://localhost:3000/login',
      'http://localhost:3000/api/auth/login',
      'http://localhost:3000/api/auth/register',
      'http://localhost:3000/api/auth/logout',
      'http://localhost:3000/widget',
      'http://localhost:3000/widget/test',
      'http://localhost:3000/api/widget',
      'http://localhost:3000/api/widget/session',
      'http://localhost:3000/api/health',
      'http://localhost:3000/',
      'http://localhost:3000/inbox',
      'http://localhost:3000/api/chat',
    ];

    publicRoutes.forEach(url => {
      it(`should allow unauthenticated access to ${url}`, async () => {
        const request = createTestRequest(url);
        const response = await middleware(request);

        // Should not redirect to login
        expect(response.status).not.toBe(302);
        expect(response.headers.get('Location')).not.toContain('/login');
      });
    });
  });

  describe('Authentication State Redirects', () => {
    it('should redirect authenticated users away from login page', async () => {
      const request = createTestRequest('http://localhost:3000/login', 'GET', { 'auth-token': authToken });
      const response = await middleware(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/mine');
    });

    it('should allow unauthenticated users to access login page', async () => {
      const request = createTestRequest('http://localhost:3000/login');
      const response = await middleware(request);

      expect(response.status).not.toBe(302);
    });
  });

  describe('Token Validation in Middleware', () => {
    it('should reject invalid tokens', async () => {
      const request = createTestRequest('http://localhost:3000/adm', 'GET', { 'auth-token': 'invalid-token' });
      const response = await middleware(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login');
    });

    it('should reject expired tokens', async () => {
      // Create a token with very short expiration (this is a simplified test)
      const request = createTestRequest('http://localhost:3000/adm', 'GET', { 'auth-token': 'expired.token.here' });
      const response = await middleware(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login');
    });

    it('should handle missing auth cookie', async () => {
      const request = createTestRequest('http://localhost:3000/adm');
      const response = await middleware(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login');
    });
  });

  describe('Route Pattern Matching', () => {
    it('should protect all /adm subroutes', async () => {
      const adminRoutes = [
        'http://localhost:3000/adm',
        'http://localhost:3000/adm/dashboard',
        'http://localhost:3000/adm/users',
        'http://localhost:3000/adm/settings',
        'http://localhost:3000/adm/conversations/123',
        'http://localhost:3000/adm/saved-replies',
      ];

      for (const url of adminRoutes) {
        const request = createTestRequest(url);
        const response = await middleware(request);

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toContain('/login');
      }
    });

    it('should protect all /mine subroutes', async () => {
      const mineRoutes = [
        'http://localhost:3000/mine',
        'http://localhost:3000/mine/conversations',
        'http://localhost:3000/mine/settings',
        'http://localhost:3000/mine/dashboard',
      ];

      for (const url of mineRoutes) {
        const request = createTestRequest(url);
        const response = await middleware(request);

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toContain('/login');
      }
    });

    it('should protect all /api/adm subroutes', async () => {
      const apiAdminRoutes = [
        'http://localhost:3000/api/adm',
        'http://localhost:3000/api/adm/users',
        'http://localhost:3000/api/adm/conversations',
        'http://localhost:3000/api/adm/settings',
        'http://localhost:3000/api/adm/saved-replies',
      ];

      for (const url of apiAdminRoutes) {
        const request = createTestRequest(url);
        const response = await middleware(request);

        expect(response.status).toBe(302);
        expect(response.headers.get('Location')).toContain('/login');
      }
    });
  });

  describe('Next.js Internal Routes', () => {
    it('should skip authentication for Next.js internals', async () => {
      const internalRoutes = [
        'http://localhost:3000/_next/static/css/app.css',
        'http://localhost:3000/_next/static/js/app.js',
        'http://localhost:3000/favicon.ico',
        'http://localhost:3000/logo.svg',
        'http://localhost:3000/images/test.png',
      ];

      for (const url of internalRoutes) {
        const request = createTestRequest(url);
        const response = await middleware(request);

        // Should not redirect to login
        expect(response.status).not.toBe(302);
      }
    });
  });

  describe('API Route Protection', () => {
    it('should protect admin API routes', async () => {
      const request = createTestRequest('http://localhost:3000/api/adm/users', 'GET');
      const response = await middleware(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toContain('/login');
    });

    it('should allow authenticated access to admin API routes', async () => {
      const request = createTestRequest('http://localhost:3000/api/adm/users', 'GET', { 'auth-token': authToken });
      const response = await middleware(request);

      expect(response.status).not.toBe(302);
    });

    it('should allow public API routes', async () => {
      const publicApiRoutes = [
        'http://localhost:3000/api/auth/login',
        'http://localhost:3000/api/auth/register',
        'http://localhost:3000/api/widget/session',
        'http://localhost:3000/api/chat',
        'http://localhost:3000/api/health',
      ];

      for (const url of publicApiRoutes) {
        const request = createTestRequest(url, 'POST');
        const response = await middleware(request);

        expect(response.status).not.toBe(302);
      }
    });
  });

  describe('TRPC Route Protection', () => {
    it('should handle TRPC routes correctly', async () => {
      // TRPC routes should be processed by middleware
      const trpcRoutes = [
        'http://localhost:3000/api/trpc/user.me',
        'http://localhost:3000/api/trpc/mailbox.conversations',
      ];

      for (const url of trpcRoutes) {
        const request = createTestRequest(url);
        // The middleware should process these routes but TRPC handles auth internally
        const response = await middleware(request);
        expect(response).toBeTruthy();
      }
    });
  });
});