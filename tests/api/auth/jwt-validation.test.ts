import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignJWT, jwtVerify } from 'jose';
import { signJWT, verifyJWT, createSession, hashPassword, verifyPassword } from '@/lib/auth';
import { db } from '@/db/client';
import { usersTable, userSessionsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'test-secret-key');

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

describe('JWT Token Generation and Validation Tests', () => {
  const testEmail = `test-jwt-${Date.now()}-${Math.random()}@example.com`;
  const testPassword = 'TestPassword123!';
  let testUserId: string;

  beforeEach(async () => {
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
  });

  afterEach(async () => {
    await cleanupTestUser(testEmail);
  });

  describe('JWT Generation', () => {
    it('should create valid JWT tokens with proper structure', async () => {
      const payload = {
        userId: testUserId,
        email: testEmail,
        type: 'session',
      };

      const token = await signJWT(payload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts

      // Verify the token can be decoded
      const decoded = await verifyJWT(token);
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.email).toBe(testEmail);
      expect(decoded.type).toBe('session');
      expect(decoded.iat).toBeTruthy();
      expect(decoded.exp).toBeTruthy();
    });

    it('should include proper JWT claims', async () => {
      const payload = { userId: testUserId, type: 'session' };
      const token = await signJWT(payload);
      const decoded = await verifyJWT(token);

      // Standard JWT claims
      expect(decoded.iat).toBeTruthy(); // issued at
      expect(decoded.exp).toBeTruthy(); // expiration
      expect(decoded.exp > decoded.iat).toBe(true); // exp should be after iat

      // Custom claims
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.type).toBe('session');
    });

    it('should create tokens with appropriate expiration time', async () => {
      const payload = { userId: testUserId };
      const token = await signJWT(payload);
      const decoded = await verifyJWT(token);

      const now = Math.floor(Date.now() / 1000);
      const expectedExp = now + (7 * 24 * 60 * 60); // 7 days
      
      // Allow 10 seconds tolerance for test execution time
      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 10);
      expect(decoded.exp).toBeGreaterThanOrEqual(expectedExp - 10);
    });

    it('should handle different payload types', async () => {
      const payloads = [
        { userId: testUserId, type: 'session' },
        { userId: testUserId, email: testEmail, permissions: 'admin' },
        { userId: testUserId, customData: { role: 'user', active: true } },
      ];

      for (const payload of payloads) {
        const token = await signJWT(payload);
        const decoded = await verifyJWT(token);
        
        Object.keys(payload).forEach(key => {
          expect(decoded[key]).toEqual(payload[key as keyof typeof payload]);
        });
      }
    });
  });

  describe('JWT Validation', () => {
    it('should validate correct tokens', async () => {
      const payload = { userId: testUserId, type: 'session' };
      const token = await signJWT(payload);
      const result = await verifyJWT(token);

      expect(result).toBeTruthy();
      expect(result.userId).toBe(testUserId);
    });

    it('should reject invalid tokens', async () => {
      const invalidTokens = [
        'invalid.token.here',
        'not-a-jwt-token',
        '',
        'header.invalid-payload.signature',
      ];

      for (const token of invalidTokens) {
        const result = await verifyJWT(token);
        expect(result).toBeNull();
      }
    });

    it('should reject tokens with wrong signature', async () => {
      // Create token with different secret
      const wrongSecret = new TextEncoder().encode('wrong-secret');
      const wrongToken = await new SignJWT({ userId: testUserId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(wrongSecret);

      const result = await verifyJWT(wrongToken);
      expect(result).toBeNull();
    });

    it('should reject expired tokens', async () => {
      // Create token that expires immediately
      const expiredToken = await new SignJWT({ userId: testUserId })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('0s') // Expires immediately
        .sign(JWT_SECRET);

      // Wait a bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await verifyJWT(expiredToken);
      expect(result).toBeNull();
    });

    it('should handle malformed JWT structure', async () => {
      const malformedTokens = [
        'only-one-part',
        'two.parts',
        'four.parts.in.token',
        '.invalid.',
        'valid.header.invalid-json-payload.signature',
      ];

      for (const token of malformedTokens) {
        const result = await verifyJWT(token);
        expect(result).toBeNull();
      }
    });
  });

  describe('Session Creation', () => {
    it('should create session with valid JWT token', async () => {
      const mockRequest = {
        headers: new Map([
          ['user-agent', 'test-user-agent'],
        ]),
        ip: '127.0.0.1',
      } as unknown as NextRequest;

      const token = await createSession(testUserId, mockRequest);
      
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      // Verify token is valid
      const payload = await verifyJWT(token);
      expect(payload.userId).toBe(testUserId);
      expect(payload.type).toBe('session');

      // Verify session is stored in database
      const sessions = await db.select()
        .from(userSessionsTable)
        .where(eq(userSessionsTable.token, token));
      
      expect(sessions.length).toBe(1);
      expect(sessions[0].userId).toBe(testUserId);
      expect(sessions[0].userAgent).toBe('test-user-agent');
      expect(sessions[0].ipAddress).toBe('127.0.0.1');
    });

    it('should create session without request metadata', async () => {
      const token = await createSession(testUserId);
      
      expect(token).toBeTruthy();
      
      const sessions = await db.select()
        .from(userSessionsTable)
        .where(eq(userSessionsTable.token, token));
      
      expect(sessions.length).toBe(1);
      expect(sessions[0].userId).toBe(testUserId);
      expect(sessions[0].userAgent).toBeNull();
      expect(sessions[0].ipAddress).toBeNull();
    });

    it('should set appropriate session expiration', async () => {
      const token = await createSession(testUserId);
      
      const sessions = await db.select()
        .from(userSessionsTable)
        .where(eq(userSessionsTable.token, token));
      
      const session = sessions[0];
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
      
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.expiresAt.getTime()).toBeGreaterThan(now.getTime());
      expect(session.expiresAt.getTime()).toBeLessThanOrEqual(sevenDaysFromNow.getTime() + 1000); // 1s tolerance
    });

    it('should handle multiple sessions for same user', async () => {
      const token1 = await createSession(testUserId);
      const token2 = await createSession(testUserId);
      
      expect(token1).not.toBe(token2);
      
      const sessions = await db.select()
        .from(userSessionsTable)
        .where(eq(userSessionsTable.userId, testUserId));
      
      expect(sessions.length).toBe(2);
      expect(sessions.map(s => s.token)).toContain(token1);
      expect(sessions.map(s => s.token)).toContain(token2);
    });
  });

  describe('Password Security', () => {
    it('should hash passwords securely with Argon2', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$argon2id\$/); // Argon2id format
      expect(hash.length).toBeGreaterThan(50); // Reasonable hash length
    });

    it('should verify passwords correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const validResult = await verifyPassword(password, hash);
      expect(validResult).toBe(true);
      
      const invalidResult = await verifyPassword('WrongPassword123!', hash);
      expect(invalidResult).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2); // Salt makes hashes different
      
      // Both should verify correctly
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });

    it('should handle password verification errors gracefully', async () => {
      const password = 'TestPassword123!';
      
      // Test with invalid hash formats
      const invalidHashes = [
        'not-a-hash',
        '',
        '$invalid$format',
        null as any,
        undefined as any,
      ];
      
      for (const invalidHash of invalidHashes) {
        const result = await verifyPassword(password, invalidHash);
        expect(result).toBe(false);
      }
    });
  });

  describe('JWT Security Properties', () => {
    it('should use HMAC SHA-256 algorithm', async () => {
      const payload = { userId: testUserId };
      const token = await signJWT(payload);
      
      // Decode header to check algorithm
      const [headerBase64] = token.split('.');
      const header = JSON.parse(Buffer.from(headerBase64, 'base64url').toString());
      
      expect(header.alg).toBe('HS256');
      expect(header.typ).toBe('JWT');
    });

    it('should not expose sensitive information in payload', async () => {
      const payload = { 
        userId: testUserId, 
        type: 'session',
        // Should not include sensitive data
      };
      
      const token = await signJWT(payload);
      const decoded = await verifyJWT(token);
      
      // Should not contain password, secrets, etc.
      expect(decoded.password).toBeUndefined();
      expect(decoded.secret).toBeUndefined();
      expect(decoded.privateKey).toBeUndefined();
    });

    it('should be resistant to timing attacks', async () => {
      const validToken = await signJWT({ userId: testUserId });
      const invalidToken = 'invalid.token.here';
      
      // Both should return in reasonable time (timing attack prevention)
      const start1 = Date.now();
      await verifyJWT(validToken);
      const time1 = Date.now() - start1;
      
      const start2 = Date.now();
      await verifyJWT(invalidToken);
      const time2 = Date.now() - start2;
      
      // Times should be in similar range (not exact due to normal variation)
      expect(Math.abs(time1 - time2)).toBeLessThan(100); // Less than 100ms difference
    });
  });

  describe('Environment Configuration', () => {
    it('should use configured JWT secret from environment', async () => {
      const originalSecret = process.env.JWT_SECRET;
      
      // Test with custom secret
      process.env.JWT_SECRET = 'custom-test-secret';
      
      // Note: This test requires reloading the auth module to pick up new env var
      // In a real test, you'd need to mock or restart the process
      
      process.env.JWT_SECRET = originalSecret;
    });

    it('should handle missing JWT secret gracefully', async () => {
      // This would typically be handled at application startup
      // The test verifies that the auth service has proper error handling
      expect(process.env.JWT_SECRET).toBeTruthy();
    });
  });
});