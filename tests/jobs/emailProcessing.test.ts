import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processEmailQueue, cleanupFailedEmails } from '@/jobs/lightweight/emailProcessing';
import { db } from '@/db/client';
import { conversationMessages } from '@/db/schema';

// Mock the database
vi.mock('@/db/client', () => ({
  db: {
    query: {
      conversationMessages: {
        findMany: vi.fn(),
      },
    },
    update: vi.fn(),
  },
}));

// Mock the trigger event function
const mockTriggerEvent = vi.fn();
vi.mock('@/lib/jobs/trigger', () => ({
  triggerEvent: mockTriggerEvent,
}));

describe('Email Processing Jobs', () => {
  const mockDb = db as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processEmailQueue', () => {
    it('should process pending emails in batches', async () => {
      const mockPendingEmails = [
        { id: 1, status: 'queueing', createdAt: new Date(Date.now() - 60000) },
        { id: 2, status: 'queueing', createdAt: new Date(Date.now() - 120000) },
        { id: 3, status: 'queueing', createdAt: new Date(Date.now() - 180000) },
      ];

      mockDb.query.conversationMessages.findMany.mockResolvedValue(mockPendingEmails);
      mockTriggerEvent.mockResolvedValue(undefined);

      await processEmailQueue({ batchSize: 50, maxAge: 30 });

      expect(mockDb.query.conversationMessages.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        limit: 50,
        orderBy: expect.any(Object),
      });

      expect(mockTriggerEvent).toHaveBeenCalledTimes(3);
      expect(mockTriggerEvent).toHaveBeenCalledWith(
        'conversations/email.enqueued',
        { messageId: 1 }
      );
      expect(mockTriggerEvent).toHaveBeenCalledWith(
        'conversations/email.enqueued',
        { messageId: 2 }
      );
      expect(mockTriggerEvent).toHaveBeenCalledWith(
        'conversations/email.enqueued',
        { messageId: 3 }
      );
    });

    it('should handle empty email queue', async () => {
      mockDb.query.conversationMessages.findMany.mockResolvedValue([]);

      await processEmailQueue({ batchSize: 50, maxAge: 30 });

      expect(mockDb.query.conversationMessages.findMany).toHaveBeenCalled();
      expect(mockTriggerEvent).not.toHaveBeenCalled();
    });

    it('should use default parameters when none provided', async () => {
      mockDb.query.conversationMessages.findMany.mockResolvedValue([]);

      await processEmailQueue({});

      expect(mockDb.query.conversationMessages.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        limit: 50, // default batch size
        orderBy: expect.any(Object),
      });
    });

    it('should handle individual email triggering failures gracefully', async () => {
      const mockPendingEmails = [
        { id: 1, status: 'queueing', createdAt: new Date(Date.now() - 60000) },
        { id: 2, status: 'queueing', createdAt: new Date(Date.now() - 120000) },
      ];

      mockDb.query.conversationMessages.findMany.mockResolvedValue(mockPendingEmails);
      mockTriggerEvent
        .mockResolvedValueOnce(undefined) // First call succeeds
        .mockRejectedValueOnce(new Error('Trigger failed')); // Second call fails

      // Should not throw despite individual failure
      await expect(processEmailQueue({})).resolves.toBeUndefined();

      expect(mockTriggerEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanupFailedEmails', () => {
    it('should mark old failed emails as expired', async () => {
      const mockResult = { rowCount: 5 };
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockResult),
        }),
      });

      const result = await cleanupFailedEmails({ olderThanDays: 7 });

      expect(result).toEqual({ cleanedCount: 5 });
      expect(mockDb.update).toHaveBeenCalledWith(conversationMessages);
    });

    it('should use default parameters', async () => {
      const mockResult = { rowCount: 0 };
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockResult),
        }),
      });

      const result = await cleanupFailedEmails({});

      expect(result).toEqual({ cleanedCount: 0 });
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      await expect(cleanupFailedEmails({})).rejects.toThrow('Database error');
    });

    it('should handle null rowCount', async () => {
      const mockResult = { rowCount: null };
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockResult),
        }),
      });

      const result = await cleanupFailedEmails({});

      expect(result).toEqual({ cleanedCount: 0 });
    });
  });
});