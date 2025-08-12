import { describe, it, expect } from 'vitest';
import { GET as getUsersHandler, POST as createUserHandler } from '@/app/api/adm/users/route';
import { createTestRequest } from '../comprehensive-api.test';

export async function testUsers(authToken: string) {
  describe('User Management API Tests', () => {
    let testUserId: string;

    it('should get users list', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/users?page=1&perPage=10',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getUsersHandler(request);
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
        expect(Array.isArray(result.data)).toBe(true);
      } catch (error) {
        console.error('Get users test failed:', error);
        throw error;
      }
    });

    it('should search users', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/users?q=test&page=1&perPage=5',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getUsersHandler(request);
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
      } catch (error) {
        console.error('Search users test failed:', error);
        throw error;
      }
    });

    it('should get user count', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/users?countOnly=true',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getUsersHandler(request);
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
        expect(typeof result.total).toBe('number');
      } catch (error) {
        console.error('Get user count test failed:', error);
        throw error;
      }
    });

    it('should create new user', async () => {
      const userData = {
        email: `test-user-${Date.now()}@example.com`,
        password: 'testpassword123',
        displayName: 'Test User',
        permissions: 'member'
      };

      const request = createTestRequest(
        'POST',
        'http://localhost:3000/api/adm/users',
        userData,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await createUserHandler(request);

        if (response.ok) {
          const result = await response.json();
          expect(result.success).toBe(true);
          expect(result.data).toBeTruthy();
          expect(result.data.email).toBe(userData.email);
          expect(result.data.displayName).toBe(userData.displayName);
          expect(result.data.permissions).toBe(userData.permissions);
          // Password should not be in response
          expect(result.data).not.toHaveProperty('password');
          
          testUserId = result.data.id;
        } else {
          // Should be 403 if not admin
          expect([403, 401]).toContain(response.status);
        }
      } catch (error) {
        console.error('Create user test failed:', error);
        throw error;
      }
    });

    it('should validate user creation data', async () => {
      const invalidUserData = {
        email: 'invalid-email', // Invalid email format
        password: '123', // Too short
        displayName: '',
        permissions: 'invalid-role' // Invalid permission
      };

      const request = createTestRequest(
        'POST',
        'http://localhost:3000/api/adm/users',
        invalidUserData,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await createUserHandler(request);

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        
        const result = await response.json();
        expect(result.error).toBeTruthy();
        expect(result.errors).toBeTruthy(); // Should have validation errors
      } catch (error) {
        console.error('Validate user creation test failed:', error);
        throw error;
      }
    });

    it('should prevent duplicate email addresses', async () => {
      const email = `duplicate-${Date.now()}@example.com`;
      
      const userData = {
        email,
        password: 'testpassword123',
        displayName: 'First User',
        permissions: 'member'
      };

      // Create first user
      const firstRequest = createTestRequest(
        'POST',
        'http://localhost:3000/api/adm/users',
        userData,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const firstResponse = await createUserHandler(firstRequest);

        if (firstResponse.ok) {
          // Try to create second user with same email
          const secondRequest = createTestRequest(
            'POST',
            'http://localhost:3000/api/adm/users',
            { ...userData, displayName: 'Second User' },
            { Authorization: `Bearer ${authToken}` }
          );

          const secondResponse = await createUserHandler(secondRequest);

          expect(secondResponse.ok).toBe(false);
          expect(secondResponse.status).toBe(400);
          
          const result = await secondResponse.json();
          expect(result.error).toContain('already exists');
        }
      } catch (error) {
        console.error('Duplicate email test failed:', error);
        throw error;
      }
    });

    it('should exclude password from user responses', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/users?perPage=1',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getUsersHandler(request);
        
        if (response.ok) {
          const result = await response.json();
          expect(result.success).toBe(true);
          
          if (result.data && result.data.length > 0) {
            const user = result.data[0];
            expect(user).not.toHaveProperty('password');
            expect(user).toHaveProperty('email');
            expect(user).toHaveProperty('displayName');
            expect(user).toHaveProperty('permissions');
          }
        }
      } catch (error) {
        console.error('Exclude password test failed:', error);
        throw error;
      }
    });

    it('should require admin permissions', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/users'
      );

      try {
        const response = await getUsersHandler(request);

        expect(response.ok).toBe(false);
        expect([401, 403]).toContain(response.status);
      } catch (error) {
        console.error('Admin permissions test failed:', error);
        throw error;
      }
    });
  });
}

export default testUsers;