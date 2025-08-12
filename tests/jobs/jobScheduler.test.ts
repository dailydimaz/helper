import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobScheduler, scheduleHelpers } from '@/lib/jobs/scheduler';

// Mock the job queue
const mockAddJob = vi.fn();
vi.mock('@/lib/jobs/queue', () => ({
  jobQueue: {
    addJob: mockAddJob,
  },
}));

describe('JobScheduler', () => {
  let scheduler: JobScheduler;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    scheduler = JobScheduler.getInstance();
  });

  afterEach(() => {
    scheduler.cancelAllJobs();
    vi.useRealTimers();
  });

  describe('scheduleJob', () => {
    it('should schedule a job for future execution', async () => {
      const futureTime = new Date(Date.now() + 5000); // 5 seconds from now
      mockAddJob.mockResolvedValue({ id: 1 });

      const jobId = scheduler.scheduleJob('testJob', { test: 'data' }, futureTime);

      expect(jobId).toBeTruthy();
      expect(scheduler.getScheduledJobCount()).toBe(1);

      // Fast forward time
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockAddJob).toHaveBeenCalledWith('testJob', { test: 'data' }, futureTime);
    });

    it('should handle immediate scheduling for past times', async () => {
      const pastTime = new Date(Date.now() - 1000); // 1 second ago
      mockAddJob.mockResolvedValue({ id: 1 });

      const jobId = scheduler.scheduleJob('testJob', { test: 'data' }, pastTime);

      expect(jobId).toBeTruthy();

      // Should execute immediately
      await vi.runAllTimersAsync();

      expect(mockAddJob).toHaveBeenCalledWith('testJob', { test: 'data' }, pastTime);
    });

    it('should use custom job ID when provided', () => {
      const futureTime = new Date(Date.now() + 1000);
      const customId = 'custom-job-123';

      const jobId = scheduler.scheduleJob('testJob', { test: 'data' }, futureTime, customId);

      expect(jobId).toBe(customId);
    });
  });

  describe('scheduleJobAfter', () => {
    it('should schedule job after specified delay', async () => {
      const delayMs = 3000;
      mockAddJob.mockResolvedValue({ id: 1 });

      const jobId = scheduler.scheduleJobAfter('testJob', { test: 'data' }, delayMs);

      expect(jobId).toBeTruthy();
      expect(scheduler.getScheduledJobCount()).toBe(1);

      await vi.advanceTimersByTimeAsync(delayMs);

      expect(mockAddJob).toHaveBeenCalledWith(
        'testJob',
        { test: 'data' },
        expect.any(Date)
      );
    });
  });

  describe('scheduleRecurringJob', () => {
    it('should schedule hourly recurring job', async () => {
      mockAddJob.mockResolvedValue({ id: 1 });
      
      const jobId = scheduler.scheduleRecurringJob('testJob', { test: 'data' }, '0 * * * *');

      expect(jobId).toBeTruthy();
      expect(scheduler.getScheduledJobCount()).toBe(1);

      // Fast forward to trigger first execution
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000); // 1 hour

      expect(mockAddJob).toHaveBeenCalled();
    });

    it('should schedule daily recurring job', async () => {
      mockAddJob.mockResolvedValue({ id: 1 });
      
      const jobId = scheduler.scheduleRecurringJob('testJob', { test: 'data' }, '0 0 * * *');

      expect(jobId).toBeTruthy();
      expect(scheduler.getScheduledJobCount()).toBe(1);
    });
  });

  describe('cancelJob', () => {
    it('should cancel a scheduled job', async () => {
      const futureTime = new Date(Date.now() + 5000);
      
      const jobId = scheduler.scheduleJob('testJob', { test: 'data' }, futureTime);
      
      expect(scheduler.getScheduledJobCount()).toBe(1);

      const cancelled = scheduler.cancelJob(jobId);

      expect(cancelled).toBe(true);
      expect(scheduler.getScheduledJobCount()).toBe(0);

      // Fast forward - job should not execute
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockAddJob).not.toHaveBeenCalled();
    });

    it('should return false when cancelling non-existent job', () => {
      const cancelled = scheduler.cancelJob('non-existent-job');

      expect(cancelled).toBe(false);
    });
  });

  describe('cancelAllJobs', () => {
    it('should cancel all scheduled jobs', () => {
      const futureTime = new Date(Date.now() + 5000);
      
      scheduler.scheduleJob('testJob1', {}, futureTime);
      scheduler.scheduleJob('testJob2', {}, futureTime);
      scheduler.scheduleJob('testJob3', {}, futureTime);

      expect(scheduler.getScheduledJobCount()).toBe(3);

      scheduler.cancelAllJobs();

      expect(scheduler.getScheduledJobCount()).toBe(0);
    });
  });

  describe('cron pattern parsing', () => {
    it('should handle basic hourly pattern', () => {
      const scheduler = JobScheduler.getInstance();
      const nextRun = (scheduler as any).getNextRunTime('0 * * * *');
      
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun.getMinutes()).toBe(0);
    });

    it('should handle daily pattern', () => {
      const scheduler = JobScheduler.getInstance();
      const nextRun = (scheduler as any).getNextRunTime('0 0 * * *');
      
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun.getHours()).toBe(0);
      expect(nextRun.getMinutes()).toBe(0);
    });

    it('should handle daily at specific hour', () => {
      const scheduler = JobScheduler.getInstance();
      const nextRun = (scheduler as any).getNextRunTime('0 14 * * *');
      
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun.getHours()).toBe(14);
      expect(nextRun.getMinutes()).toBe(0);
    });

    it('should return null for invalid cron patterns', () => {
      const scheduler = JobScheduler.getInstance();
      const nextRun = (scheduler as any).getNextRunTime('invalid pattern');
      
      expect(nextRun).toBeNull();
    });
  });
});

describe('scheduleHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('inMinutes', () => {
    it('should schedule job to run in specified minutes', () => {
      const minutes = 30;
      
      const jobId = scheduleHelpers.inMinutes('testJob', { test: 'data' }, minutes);
      
      expect(jobId).toBeTruthy();
    });
  });

  describe('inHours', () => {
    it('should schedule job to run in specified hours', () => {
      const hours = 2;
      
      const jobId = scheduleHelpers.inHours('testJob', { test: 'data' }, hours);
      
      expect(jobId).toBeTruthy();
    });
  });

  describe('daily', () => {
    it('should schedule daily recurring job at specified hour', () => {
      const hour = 14;
      
      const jobId = scheduleHelpers.daily('testJob', { test: 'data' }, hour);
      
      expect(jobId).toBeTruthy();
    });
  });

  describe('hourly', () => {
    it('should schedule hourly recurring job', () => {
      const jobId = scheduleHelpers.hourly('testJob', { test: 'data' });
      
      expect(jobId).toBeTruthy();
    });
  });

  describe('weekly', () => {
    it('should schedule weekly recurring job', () => {
      const dayOfWeek = 1; // Monday
      const hour = 9;
      
      const jobId = scheduleHelpers.weekly('testJob', { test: 'data' }, dayOfWeek, hour);
      
      expect(jobId).toBeTruthy();
    });
  });
});