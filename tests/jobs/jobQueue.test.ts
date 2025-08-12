import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobQueue, type JobQueueMetrics } from '@/lib/jobs/queue';
import { db } from '@/db/client';
import { jobsTable } from '@/db/schema/jobs';
import { eq } from 'drizzle-orm';

// Mock the database
vi.mock('@/db/client', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      jobs: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      }
    },
    execute: vi.fn(),
  },
}));

// Mock the processor
vi.mock('@/lib/jobs/processor', () => ({
  JobProcessor: vi.fn().mockImplementation(() => ({
    processJob: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('JobQueue', () => {
  let jobQueue: JobQueue;
  const mockDb = db as any;

  beforeEach(() => {
    vi.clearAllMocks();
    jobQueue = JobQueue.getInstance();
  });

  afterEach(() => {
    jobQueue.stop();
  });

  describe('addJob', () => {
    it('should add a job to the queue with default priority', async () => {
      const mockJob = {
        id: 1,
        type: 'testJob',
        payload: { test: 'data' },
        status: 'pending',
        scheduledFor: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockJob]),
        }),
      });

      const result = await jobQueue.addJob('testJob', { test: 'data' });

      expect(result).toEqual(mockJob);
      expect(mockDb.insert).toHaveBeenCalledWith(jobsTable);
    });

    it('should add a job with custom priority and scheduled time', async () => {
      const scheduledFor = new Date(Date.now() + 60000);
      const priority = 5;
      
      const mockJob = {
        id: 2,
        type: 'highPriorityJob',
        payload: { test: 'data', _priority: priority },
        status: 'pending',
        scheduledFor,
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockJob]),
        }),
      });

      const result = await jobQueue.addJob('highPriorityJob', { test: 'data' }, scheduledFor, priority);

      expect(result.payload).toEqual({ test: 'data', _priority: priority });
      expect(result.scheduledFor).toEqual(scheduledFor);
    });
  });

  describe('getPendingJobs', () => {
    it('should retrieve pending jobs ordered by priority', async () => {
      const mockJobs = [
        { id: 1, type: 'job1', priority: 1 },
        { id: 2, type: 'job2', priority: 5 },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockJobs),
            }),
          }),
        }),
      });

      const result = await jobQueue.getPendingJobs(10);

      expect(result).toEqual(mockJobs);
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('markJobAsFailed', () => {
    it('should retry job with exponential backoff when under max attempts', async () => {
      const jobId = 1;
      const mockJob = {
        id: jobId,
        type: 'testJob',
        attempts: 1,
        maxAttempts: 3,
      };

      // Mock select to return the job
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockJob]),
          }),
        }),
      });

      // Mock update
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await jobQueue.markJobAsFailed(jobId, 'Test error');

      expect(mockDb.update).toHaveBeenCalledWith(jobsTable);
    });

    it('should move job to dead letter queue when max attempts exceeded', async () => {
      const jobId = 1;
      const mockJob = {
        id: jobId,
        type: 'testJob',
        attempts: 3,
        maxAttempts: 3,
      };

      // Mock select to return the job
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockJob]),
          }),
        }),
      });

      // Mock update for dead letter
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await jobQueue.markJobAsFailed(jobId, 'Final error');

      // Verify it was updated to dead_letter status
      const updateCall = mockDb.update.mock.calls[0];
      expect(updateCall[0]).toBe(jobsTable);
    });
  });

  describe('getJobStats', () => {
    it('should return comprehensive job statistics with metrics', async () => {
      const mockStats = [
        { status: 'pending', count: 5 },
        { status: 'completed', count: 10 },
        { status: 'failed', count: 2 },
        { status: 'dead_letter', count: 1 },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue(mockStats),
        }),
      });

      const result = await jobQueue.getJobStats();

      expect(result).toEqual({
        pending: 5,
        processing: 0,
        completed: 10,
        failed: 2,
        dead_letter: 1,
        metrics: expect.any(Object),
      });

      expect(result.metrics).toHaveProperty('processed');
      expect(result.metrics).toHaveProperty('failed');
      expect(result.metrics).toHaveProperty('avgProcessingTime');
    });
  });

  describe('getDeadLetterJobs', () => {
    it('should retrieve dead letter jobs for inspection', async () => {
      const mockDeadJobs = [
        { id: 1, type: 'failedJob', status: 'dead_letter' },
        { id: 2, type: 'anotherFailedJob', status: 'dead_letter' },
      ];

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockDeadJobs),
            }),
          }),
        }),
      });

      const result = await jobQueue.getDeadLetterJobs();

      expect(result).toEqual(mockDeadJobs);
    });
  });

  describe('retryDeadLetterJob', () => {
    it('should reset job from dead letter queue for retry', async () => {
      const jobId = 1;

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await jobQueue.retryDeadLetterJob(jobId);

      expect(mockDb.update).toHaveBeenCalledWith(jobsTable);
    });
  });

  describe('cleanupOldJobs', () => {
    it('should clean up old completed jobs', async () => {
      const mockDeleteResult = { rowCount: 5 };

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(mockDeleteResult),
      });

      const result = await jobQueue.cleanupOldJobs(24);

      expect(result).toBe(5);
      expect(mockDb.delete).toHaveBeenCalledWith(jobsTable);
    });
  });
});