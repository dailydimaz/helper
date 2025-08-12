import { describe, it, expect } from 'vitest';
import { GET as getConversationsHandler } from '@/app/api/adm/conversations/route';
import { createTestRequest } from '../comprehensive-api.test';

export async function testConversations(authToken: string) {
  describe('Conversation API Tests', () => {
    it('should get conversations list', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/conversations?page=1&perPage=10',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getConversationsHandler(request);
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
        expect(Array.isArray(result.data)).toBe(true);
      } catch (error) {
        console.error('Get conversations test failed:', error);
        throw error;
      }
    });

    it('should search conversations', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/conversations?q=test&page=1&perPage=5',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getConversationsHandler(request);
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
      } catch (error) {
        console.error('Search conversations test failed:', error);
        throw error;
      }
    });

    it('should filter by status', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/conversations?status=open',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getConversationsHandler(request);
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
      } catch (error) {
        console.error('Filter conversations by status test failed:', error);
        throw error;
      }
    });

    it('should get conversation count', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/conversations?countOnly=true',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getConversationsHandler(request);
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
        expect(typeof result.total).toBe('number');
      } catch (error) {
        console.error('Get conversation count test failed:', error);
        throw error;
      }
    });

    it('should require admin permissions', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/conversations'
      );

      try {
        const response = await getConversationsHandler(request);

        expect(response.ok).toBe(false);
        expect([401, 403]).toContain(response.status);
      } catch (error) {
        console.error('Admin permissions test failed:', error);
        throw error;
      }
    });

    it('should validate pagination parameters', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/conversations?page=invalid&perPage=invalid',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getConversationsHandler(request);
        const result = await response.json();

        // Should handle invalid pagination gracefully
        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
      } catch (error) {
        console.error('Validate pagination test failed:', error);
        throw error;
      }
    });

    it('should include assigned user information', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/conversations?perPage=1',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getConversationsHandler(request);
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
        
        if (result.data && result.data.length > 0) {
          const conversation = result.data[0];
          expect(conversation).toHaveProperty('id');
          expect(conversation).toHaveProperty('subject');
          expect(conversation).toHaveProperty('status');
          // assignedTo might be null, which is fine
          expect(conversation).toHaveProperty('assignedTo');
        }
      } catch (error) {
        console.error('Include assigned user test failed:', error);
        throw error;
      }
    });
  });
}

export default testConversations;