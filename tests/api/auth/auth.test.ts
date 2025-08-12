import { describe, it, expect } from 'vitest';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import { createTestRequest } from '../comprehensive-api.test';

export interface AuthLoginData {
  email: string;
  password: string;
}

export interface AuthRegisterData {
  email: string;
  password: string;
  displayName?: string;
}

export async function testAuthLogin(data: AuthLoginData) {
  try {
    const request = createTestRequest(
      'POST',
      'http://localhost:3000/api/auth/login',
      data
    );

    const response = await loginHandler(request);
    const result = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data: result.data,
      token: response.headers.get('Set-Cookie')?.match(/auth-token=([^;]+)/)?.[1],
      message: result.message,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Test failed',
      details: error,
    };
  }
}

export async function testAuthRegister(data: AuthRegisterData) {
  try {
    const request = createTestRequest(
      'POST',
      'http://localhost:3000/api/auth/register',
      data
    );

    const response = await registerHandler(request);
    const result = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data: result.data,
      message: result.message,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Test failed',
      details: error,
    };
  }
}

export async function testAuthLogout() {
  try {
    const request = createTestRequest(
      'POST',
      'http://localhost:3000/api/auth/logout'
    );

    const response = await logoutHandler(request);
    const result = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      message: result.message,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Test failed',
      details: error,
    };
  }
}

describe('Authentication API Tests', () => {
  it('should register a new user', async () => {
    const result = await testAuthRegister({
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
      displayName: 'Test User',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeTruthy();
    expect(result.data.email).toBeTruthy();
  });

  it('should login with valid credentials', async () => {
    const email = `test-${Date.now()}@example.com`;
    
    // First register
    await testAuthRegister({
      email,
      password: 'testpassword123',
      displayName: 'Test User',
    });

    // Then login
    const result = await testAuthLogin({
      email,
      password: 'testpassword123',
    });

    expect(result.success).toBe(true);
    expect(result.token).toBeTruthy();
  });

  it('should reject invalid credentials', async () => {
    const result = await testAuthLogin({
      email: 'nonexistent@example.com',
      password: 'wrongpassword',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
  });

  it('should validate email format', async () => {
    const result = await testAuthRegister({
      email: 'invalid-email',
      password: 'testpassword123',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });

  it('should validate password length', async () => {
    const result = await testAuthRegister({
      email: `test-${Date.now()}@example.com`,
      password: '123',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
  });

  it('should logout successfully', async () => {
    const result = await testAuthLogout();
    expect(result.success).toBe(true);
  });
});