import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JobProcessor } from '@/lib/jobs/processor';
import { Job } from '@/db/schema/jobs';

// Mock the lightweight jobs
const mockLightweightJobs = {
  testJob: vi.fn().mockResolvedValue(undefined),
  slowJob: vi.fn().mockImplementation(() => 
    new Promise(resolve => setTimeout(resolve, 100))
  ),
  failingJob: vi.fn().mockRejectedValue(new Error('Job failed')),
  timeoutJob: vi.fn().mockImplementation(() =>
    new Promise(resolve => setTimeout(resolve, 6000)) // 6 seconds, will timeout
  ),
};

vi.mock('@/jobs/lightweight', () => ({
  lightweightJobs: mockLightweightJobs,
  JobType: 'testJob' as const,
}));

describe('JobProcessor', () => {
  let processor: JobProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new JobProcessor();
  });

  describe('processJob', () => {
    it('should process a valid job successfully', async () => {
      const job: Job = {
        id: 1,
        type: 'testJob',
        payload: { test: 'data', _priority: 0 },
        status: 'pending',
        scheduledFor: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
      };

      await processor.processJob(job);

      expect(mockLightweightJobs.testJob).toHaveBeenCalledWith({ test: 'data' });
      expect(mockLightweightJobs.testJob).toHaveBeenCalledTimes(1);
    });

    it('should clean payload by removing internal properties', async () => {
      const job: Job = {
        id: 2,
        type: 'testJob',
        payload: { 
          test: 'data', 
          _priority: 5,
          _internal: 'secret',
          normalProp: 'keep this'
        },
        status: 'pending',
        scheduledFor: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
      };

      await processor.processJob(job);

      expect(mockLightweightJobs.testJob).toHaveBeenCalledWith({ 
        test: 'data',
        normalProp: 'keep this'
      });
    });

    it('should handle empty or null payload', async () => {
      const job: Job = {
        id: 3,
        type: 'testJob',
        payload: null,
        status: 'pending',
        scheduledFor: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
      };

      await processor.processJob(job);

      expect(mockLightweightJobs.testJob).toHaveBeenCalledWith(null);
    });

    it('should throw error for invalid job type', async () => {
      const job: Job = {
        id: 4,
        type: 'invalidJobType',
        payload: { test: 'data' },
        status: 'pending',
        scheduledFor: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
      };

      await expect(processor.processJob(job)).rejects.toThrow(
        'Invalid job type: invalidJobType'
      );
    });

    it('should handle job handler failures gracefully', async () => {
      const job: Job = {
        id: 5,
        type: 'failingJob',
        payload: { test: 'data' },
        status: 'pending',
        scheduledFor: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
      };

      await expect(processor.processJob(job)).rejects.toThrow(
        'Job failingJob failed: Job failed'
      );

      expect(mockLightweightJobs.failingJob).toHaveBeenCalledWith({ test: 'data' });
    });

    it('should timeout long-running jobs', async () => {
      const job: Job = {
        id: 6,
        type: 'timeoutJob',
        payload: { test: 'data' },
        status: 'pending',
        scheduledFor: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
      };

      // Mock a shorter timeout for testing
      vi.spyOn(processor as any, 'createTimeout').mockReturnValue(
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Job timeoutJob timed out after 100ms')), 100)
        )
      );

      await expect(processor.processJob(job)).rejects.toThrow(
        'Job timeoutJob failed: Job timeoutJob timed out after 100ms'
      );
    }, 1000); // Give the test 1 second to complete
  });

  describe('getAvailableJobTypes', () => {
    it('should return list of available job types', () => {
      const types = processor.getAvailableJobTypes();
      
      expect(types).toContain('testJob');
      expect(types).toContain('slowJob');
      expect(types).toContain('failingJob');
      expect(types).toContain('timeoutJob');
    });
  });

  describe('isJobTypeAvailable', () => {
    it('should return true for valid job types', () => {
      expect(processor.isJobTypeAvailable('testJob')).toBe(true);
    });

    it('should return false for invalid job types', () => {
      expect(processor.isJobTypeAvailable('invalidJob')).toBe(false);
    });
  });
});