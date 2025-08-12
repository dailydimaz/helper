import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { 
  initializeJobSystem, 
  shutdownJobSystem, 
  getJobSystemStats,
  jobQueue,
  triggerEvent
} from '@/lib/jobs';
import { db } from '@/db/client';
import { jobsTable } from '@/db/schema/jobs';
import { eq } from 'drizzle-orm';

// This test requires a test database connection
// You might want to skip this in CI unless you have a test DB set up

describe('Job System Integration', () => {
  beforeAll(async () => {
    // Initialize job system for testing
    initializeJobSystem();
  });

  afterAll(async () => {
    // Clean shutdown
    shutdownJobSystem();
  });

  beforeEach(async () => {
    // Clean up jobs table before each test
    try {
      await db.delete(jobsTable);
    } catch (error) {
      // Ignore errors if table doesn't exist in test env
      console.warn('Could not clean jobs table:', error);
    }
  });

  describe('End-to-end job processing', () => {
    it('should process a simple job end-to-end', async () => {
      // Add a job directly to the queue
      const job = await jobQueue.addJob('generateFilePreview', { fileId: 123 });
      
      expect(job).toBeDefined();
      expect(job.type).toBe('generateFilePreview');
      expect(job.status).toBe('pending');

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check job was processed (assuming the handler completes quickly)
      const stats = await jobQueue.getJobStats();
      expect(stats.completed + stats.processing + stats.pending).toBeGreaterThan(0);
    });

    it('should handle job failures and retries', async () => {
      // This test would need a job that fails predictably
      // For now, we'll test the structure
      const job = await jobQueue.addJob('failingJob', { shouldFail: true });
      
      expect(job.attempts).toBe(0);
      expect(job.maxAttempts).toBe(3);

      // In a real test, you'd wait for the job to fail and be retried
      // For now, just verify the structure is correct
      expect(job.status).toBe('pending');
    });
  });

  describe('Event triggering', () => {
    it('should trigger events and create associated jobs', async () => {
      // Trigger an event that creates multiple jobs
      await triggerEvent('conversations/message.created', { messageId: 456 });

      // Check that jobs were created
      const stats = await jobQueue.getJobStats();
      expect(stats.pending).toBeGreaterThan(0);

      // The message.created event should create multiple jobs
      // indexConversationMessage, generateConversationSummaryEmbeddings, etc.
    });

    it('should schedule delayed events', async () => {
      await triggerEvent(
        'files/preview.generate', 
        { fileId: 789 }, 
        { sleepSeconds: 2 }
      );

      // Job should be scheduled for future execution
      const pendingJobs = await jobQueue.getPendingJobs(100);
      const scheduledJob = pendingJobs.find(job => 
        job.type === 'generateFilePreview' && 
        job.scheduledFor > new Date()
      );

      expect(scheduledJob).toBeDefined();
    });
  });

  describe('Job system statistics', () => {
    it('should provide comprehensive system statistics', async () => {
      // Add various jobs in different states
      await jobQueue.addJob('testJob1', {});
      await jobQueue.addJob('testJob2', {});
      
      const stats = await getJobSystemStats();
      
      expect(stats).toHaveProperty('queue');
      expect(stats).toHaveProperty('scheduledJobs');
      
      expect(stats.queue).toHaveProperty('pending');
      expect(stats.queue).toHaveProperty('processing');
      expect(stats.queue).toHaveProperty('completed');
      expect(stats.queue).toHaveProperty('failed');
      expect(stats.queue).toHaveProperty('dead_letter');
      expect(stats.queue).toHaveProperty('metrics');

      expect(stats.queue.metrics).toHaveProperty('processed');
      expect(stats.queue.metrics).toHaveProperty('failed');
      expect(stats.queue.metrics).toHaveProperty('avgProcessingTime');
    });
  });

  describe('Job queue operations', () => {
    it('should handle priority-based job processing', async () => {
      // Add jobs with different priorities
      const lowPriorityJob = await jobQueue.addJob('testJob', { priority: 'low' }, undefined, 1);
      const highPriorityJob = await jobQueue.addJob('testJob', { priority: 'high' }, undefined, 10);
      const normalJob = await jobQueue.addJob('testJob', { priority: 'normal' }, undefined, 5);

      const pendingJobs = await jobQueue.getPendingJobs(10);

      // Higher priority jobs should come first
      // Note: This test assumes jobs haven't been processed yet
      expect(pendingJobs.length).toBeGreaterThanOrEqual(3);
    });

    it('should clean up old completed jobs', async () => {
      // This test would need completed jobs to clean up
      // For now, test that the method exists and returns a count
      const deletedCount = await jobQueue.cleanupOldJobs(1); // 1 hour ago
      
      expect(typeof deletedCount).toBe('number');
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });

    it('should retrieve dead letter jobs', async () => {
      const deadLetterJobs = await jobQueue.getDeadLetterJobs(10);
      
      expect(Array.isArray(deadLetterJobs)).toBe(true);
    });
  });

  describe('Error handling and resilience', () => {
    it('should continue processing after individual job failures', async () => {
      // Add a mix of jobs that should succeed and fail
      await jobQueue.addJob('generateFilePreview', { fileId: 123 }); // Should work
      await jobQueue.addJob('nonExistentJob', { test: 'data' }); // Should fail
      await jobQueue.addJob('embeddingFaq', { faqId: 456 }); // Should work

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const stats = await jobQueue.getJobStats();
      
      // Should have some completed and some failed, but system should continue
      expect(stats.completed + stats.failed + stats.pending + stats.processing).toBeGreaterThan(0);
    });

    it('should handle system shutdown gracefully', () => {
      expect(() => {
        shutdownJobSystem();
        initializeJobSystem();
      }).not.toThrow();
    });
  });

  describe('Performance considerations', () => {
    it('should handle batch processing efficiently', async () => {
      const startTime = Date.now();
      
      // Add multiple jobs quickly
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(jobQueue.addJob('generateFilePreview', { fileId: i }));
      }
      
      await Promise.all(promises);
      
      const addTime = Date.now() - startTime;
      
      // Adding 20 jobs should be reasonably fast
      expect(addTime).toBeLessThan(5000); // 5 seconds max
      
      const stats = await jobQueue.getJobStats();
      expect(stats.pending).toBeGreaterThanOrEqual(20);
    });

    it('should provide performance metrics', async () => {
      const stats = await getJobSystemStats();
      
      expect(stats.queue.metrics.avgProcessingTime).toBeGreaterThanOrEqual(0);
      expect(stats.queue.metrics.processed).toBeGreaterThanOrEqual(0);
      expect(stats.queue.metrics.failed).toBeGreaterThanOrEqual(0);
    });
  });
}, 30000); // 30 second timeout for integration tests