import { describe, it, expect } from 'vitest';
import { GET as getMessagesHandler } from '@/app/api/messages/route';
import { GET as getMessageHandler, PUT as putMessageHandler, DELETE as deleteMessageHandler } from '@/app/api/messages/[id]/route';
import { createTestRequest } from '../comprehensive-api.test';

export async function testMessages(authToken: string) {
  describe('Message API Tests', () => {
    let testMessageId: number;

    it('should get messages list', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/messages?page=1&perPage=10',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getMessagesHandler(request);
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
        expect(Array.isArray(result.data)).toBe(true);
      } catch (error) {
        console.error('Get messages test failed:', error);
        throw error;
      }
    });

    it('should search messages', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/messages?q=test&page=1&perPage=5',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getMessagesHandler(request);
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
      } catch (error) {
        console.error('Search messages test failed:', error);
        throw error;
      }
    });

    it('should get message count', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/messages?countOnly=true',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getMessagesHandler(request);
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
        expect(typeof result.total).toBe('number');
      } catch (error) {
        console.error('Get message count test failed:', error);
        throw error;
      }
    });

    it('should filter by conversation', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/messages?conversationId=1',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getMessagesHandler(request);
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
      } catch (error) {
        console.error('Filter messages by conversation test failed:', error);
        throw error;
      }
    });

    it('should get single message', async () => {
      // First get a list to find a valid message ID
      const listRequest = createTestRequest(
        'GET',
        'http://localhost:3000/api/messages?perPage=1',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const listResponse = await getMessagesHandler(listRequest);
        const listResult = await listResponse.json();

        if (listResult.data && listResult.data.length > 0) {
          testMessageId = listResult.data[0].id;

          const request = createTestRequest(
            'GET',
            `http://localhost:3000/api/messages/${testMessageId}`,
            undefined,
            { Authorization: `Bearer ${authToken}` }
          );

          const response = await getMessageHandler(request, { params: { id: testMessageId.toString() } });
          const result = await response.json();

          expect(response.ok).toBe(true);
          expect(result.success).toBe(true);
          expect(result.data).toBeTruthy();
          expect(result.data.id).toBe(testMessageId);
        }
      } catch (error) {
        console.error('Get single message test failed:', error);
        throw error;
      }
    });

    it('should handle invalid message ID', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/messages/invalid',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getMessageHandler(request, { params: { id: 'invalid' } });

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
      } catch (error) {
        console.error('Invalid message ID test failed:', error);
        throw error;
      }
    });

    it('should handle message not found', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/messages/999999',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getMessageHandler(request, { params: { id: '999999' } });

        expect(response.ok).toBe(false);
        expect(response.status).toBe(404);
      } catch (error) {
        console.error('Message not found test failed:', error);
        throw error;
      }
    });

    it('should update message (admin only)', async () => {
      if (!testMessageId) {
        console.log('Skipping update test - no valid message ID');
        return;
      }

      const request = createTestRequest(
        'PUT',
        `http://localhost:3000/api/messages/${testMessageId}`,
        {
          body: 'Updated message body',
          subject: 'Updated subject'
        },
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await putMessageHandler(request, { params: { id: testMessageId.toString() } });

        // This might fail if user is not admin, which is expected
        if (response.ok) {
          const result = await response.json();
          expect(result.success).toBe(true);
          expect(result.data).toBeTruthy();
        } else {
          // Should be 403 if not admin
          expect([403, 401]).toContain(response.status);
        }
      } catch (error) {
        console.error('Update message test failed:', error);
        throw error;
      }
    });

    it('should validate update data', async () => {
      if (!testMessageId) {
        console.log('Skipping validation test - no valid message ID');
        return;
      }

      const request = createTestRequest(
        'PUT',
        `http://localhost:3000/api/messages/${testMessageId}`,
        {
          body: '', // Invalid: empty body
        },
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await putMessageHandler(request, { params: { id: testMessageId.toString() } });

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
      } catch (error) {
        console.error('Validate update data test failed:', error);
        throw error;
      }
    });

    it('should require authentication for protected routes', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/messages'
      );

      try {
        const response = await getMessagesHandler(request);

        expect(response.ok).toBe(false);
        expect(response.status).toBe(401);
      } catch (error) {
        console.error('Authentication test failed:', error);
        throw error;
      }
    });
  });
}

export default testMessages;