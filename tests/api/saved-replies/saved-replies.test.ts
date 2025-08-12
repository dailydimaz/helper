import { describe, it, expect } from 'vitest';
import { GET as getSavedRepliesHandler, POST as createSavedReplyHandler } from '@/app/api/adm/saved-replies/route';
import { createTestRequest } from '../comprehensive-api.test';

export async function testSavedReplies(authToken: string) {
  describe('Saved Replies API Tests', () => {
    let testReplyId: string;

    it('should get saved replies list', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/saved-replies',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getSavedRepliesHandler(request);
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
        expect(Array.isArray(result.data)).toBe(true);
      } catch (error) {
        console.error('Get saved replies test failed:', error);
        throw error;
      }
    });

    it('should search saved replies', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/saved-replies?search=test',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getSavedRepliesHandler(request);
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
      } catch (error) {
        console.error('Search saved replies test failed:', error);
        throw error;
      }
    });

    it('should filter active/inactive replies', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/saved-replies?onlyActive=true',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getSavedRepliesHandler(request);
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
      } catch (error) {
        console.error('Filter active saved replies test failed:', error);
        throw error;
      }
    });

    it('should create new saved reply', async () => {
      const replyData = {
        name: `Test Reply ${Date.now()}`,
        content: 'This is a test saved reply content.',
      };

      const request = createTestRequest(
        'POST',
        'http://localhost:3000/api/adm/saved-replies',
        replyData,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await createSavedReplyHandler(request);

        if (response.ok) {
          const result = await response.json();
          expect(result.success).toBe(true);
          expect(result.data).toBeTruthy();
          expect(result.data.name).toBe(replyData.name);
          expect(result.data.content).toBe(replyData.content);
          
          testReplyId = result.data.id;
        } else {
          // Should be 403 if not admin
          expect([403, 401]).toContain(response.status);
        }
      } catch (error) {
        console.error('Create saved reply test failed:', error);
        throw error;
      }
    });

    it('should validate saved reply creation data', async () => {
      const invalidReplyData = {
        name: '', // Invalid: empty name
        content: '', // Invalid: empty content
      };

      const request = createTestRequest(
        'POST',
        'http://localhost:3000/api/adm/saved-replies',
        invalidReplyData,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await createSavedReplyHandler(request);

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        
        const result = await response.json();
        expect(result.error).toBeTruthy();
        expect(result.errors).toBeTruthy(); // Should have validation errors
      } catch (error) {
        console.error('Validate saved reply creation test failed:', error);
        throw error;
      }
    });

    it('should trim whitespace from name and content', async () => {
      const replyData = {
        name: '  Test Reply with Whitespace  ',
        content: '  This content has leading and trailing whitespace.  ',
      };

      const request = createTestRequest(
        'POST',
        'http://localhost:3000/api/adm/saved-replies',
        replyData,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await createSavedReplyHandler(request);

        if (response.ok) {
          const result = await response.json();
          expect(result.success).toBe(true);
          expect(result.data.name).toBe(replyData.name.trim());
          expect(result.data.content).toBe(replyData.content.trim());
        } else {
          // Should be 403 if not admin
          expect([403, 401]).toContain(response.status);
        }
      } catch (error) {
        console.error('Trim whitespace test failed:', error);
        throw error;
      }
    });

    it('should enforce name length limits', async () => {
      const longName = 'A'.repeat(101); // Exceeds 100 character limit
      const replyData = {
        name: longName,
        content: 'Valid content',
      };

      const request = createTestRequest(
        'POST',
        'http://localhost:3000/api/adm/saved-replies',
        replyData,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await createSavedReplyHandler(request);

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        
        const result = await response.json();
        expect(result.errors).toBeTruthy();
        expect(result.errors.name).toContain('100');
      } catch (error) {
        console.error('Name length validation test failed:', error);
        throw error;
      }
    });

    it('should handle duplicate names gracefully', async () => {
      const replyData = {
        name: `Duplicate Name ${Date.now()}`,
        content: 'First reply content',
      };

      // Create first reply
      const firstRequest = createTestRequest(
        'POST',
        'http://localhost:3000/api/adm/saved-replies',
        replyData,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const firstResponse = await createSavedReplyHandler(firstRequest);

        if (firstResponse.ok) {
          // Try to create second reply with same name
          const secondRequest = createTestRequest(
            'POST',
            'http://localhost:3000/api/adm/saved-replies',
            { ...replyData, content: 'Second reply content' },
            { Authorization: `Bearer ${authToken}` }
          );

          const secondResponse = await createSavedReplyHandler(secondRequest);

          // Depending on business logic, this might be allowed or not
          // If not allowed, should return 400
          if (!secondResponse.ok) {
            expect(secondResponse.status).toBe(400);
            const result = await secondResponse.json();
            expect(result.error).toBeTruthy();
          }
        }
      } catch (error) {
        console.error('Duplicate name test failed:', error);
        throw error;
      }
    });

    it('should require admin permissions', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/saved-replies'
      );

      try {
        const response = await getSavedRepliesHandler(request);

        expect(response.ok).toBe(false);
        expect([401, 403]).toContain(response.status);
      } catch (error) {
        console.error('Admin permissions test failed:', error);
        throw error;
      }
    });

    it('should include creation and update timestamps', async () => {
      const request = createTestRequest(
        'GET',
        'http://localhost:3000/api/adm/saved-replies?onlyActive=true',
        undefined,
        { Authorization: `Bearer ${authToken}` }
      );

      try {
        const response = await getSavedRepliesHandler(request);
        
        if (response.ok) {
          const result = await response.json();
          expect(result.success).toBe(true);
          
          if (result.data && result.data.length > 0) {
            const reply = result.data[0];
            expect(reply).toHaveProperty('createdAt');
            expect(reply).toHaveProperty('updatedAt');
            expect(reply).toHaveProperty('isActive');
          }
        }
      } catch (error) {
        console.error('Timestamps test failed:', error);
        throw error;
      }
    });
  });
}

export default testSavedReplies;