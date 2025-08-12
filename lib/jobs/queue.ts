import { eq, and, lte, sql, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { jobsTable, NewJob, Job } from "@/db/schema/jobs";

export interface JobQueueMetrics {
  processed: number;
  failed: number;
  retried: number;
  avgProcessingTime: number;
  lastProcessedAt: Date | null;
}

export class JobQueue {
  private static instance: JobQueue;
  private isProcessing = false;
  private processingTimeout: NodeJS.Timeout | null = null;
  private metrics: JobQueueMetrics = {
    processed: 0,
    failed: 0,
    retried: 0,
    avgProcessingTime: 0,
    lastProcessedAt: null,
  };
  private processingTimes: number[] = [];
  private concurrentLimit = 5;

  static getInstance(): JobQueue {
    if (!JobQueue.instance) {
      JobQueue.instance = new JobQueue();
    }
    return JobQueue.instance;
  }

  /**
   * Add a new job to the queue with optional priority
   */
  async addJob(type: string, payload?: any, scheduledFor?: Date, priority = 0): Promise<Job> {
    const job: NewJob = {
      type,
      payload: payload ? { ...payload, _priority: priority } : { _priority: priority },
      scheduledFor: scheduledFor || new Date(),
    };

    const [insertedJob] = await db
      .insert(jobsTable)
      .values(job)
      .returning();

    // Start processing if not already processing
    this.startProcessing();

    return insertedJob;
  }

  /**
   * Get pending jobs that are ready to be processed, ordered by priority
   */
  async getPendingJobs(limit = 10): Promise<Job[]> {
    return await db
      .select()
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.status, 'pending'),
          lte(jobsTable.scheduledFor, new Date())
        )
      )
      .orderBy(
        // Order by priority (higher first), then by scheduled time
        sql`COALESCE((payload->>'_priority')::int, 0) DESC, scheduled_for ASC`
      )
      .limit(limit);
  }

  /**
   * Mark a job as processing
   */
  async markJobAsProcessing(jobId: number): Promise<void> {
    await db
      .update(jobsTable)
      .set({ 
        status: 'processing',
        updatedAt: new Date()
      })
      .where(eq(jobsTable.id, jobId));
  }

  /**
   * Mark a job as completed
   */
  async markJobAsCompleted(jobId: number): Promise<void> {
    await db
      .update(jobsTable)
      .set({ 
        status: 'completed',
        updatedAt: new Date()
      })
      .where(eq(jobsTable.id, jobId));
  }

  /**
   * Mark a job as failed and handle retry logic
   */
  async markJobAsFailed(jobId: number, error?: string): Promise<void> {
    const [job] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, jobId))
      .limit(1);

    if (!job) return;

    const newAttempts = (job.attempts || 0) + 1;
    const maxAttempts = job.maxAttempts || 3;

    if (newAttempts < maxAttempts) {
      // Retry with exponential backoff
      const backoffMinutes = Math.pow(2, newAttempts - 1) * 5; // 5, 10, 20 minutes
      const retryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
      
      await db
        .update(jobsTable)
        .set({
          status: 'pending',
          attempts: newAttempts,
          scheduledFor: retryAt,
          lastError: error || 'Unknown error',
          updatedAt: new Date(),
        })
        .where(eq(jobsTable.id, jobId));
      
      this.metrics.retried++;
      console.log(`Job ${jobId} scheduled for retry ${newAttempts}/${maxAttempts} in ${backoffMinutes} minutes`);
    } else {
      // Move to dead letter (failed permanently)
      await db
        .update(jobsTable)
        .set({
          status: 'dead_letter',
          attempts: newAttempts,
          lastError: error || 'Unknown error',
          updatedAt: new Date(),
        })
        .where(eq(jobsTable.id, jobId));
      
      this.metrics.failed++;
      console.error(`Job ${jobId} moved to dead letter queue after ${newAttempts} attempts: ${error}`);
    }
  }

  /**
   * Start the job processing loop
   */
  private startProcessing(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.processNextBatch();
  }

  /**
   * Process the next batch of jobs with concurrency control
   */
  private async processNextBatch(): Promise<void> {
    try {
      const jobs = await this.getPendingJobs(this.concurrentLimit);
      
      if (jobs.length === 0) {
        // No jobs to process, check again in 5 seconds
        this.processingTimeout = setTimeout(() => this.processNextBatch(), 5000);
        return;
      }

      // Process jobs concurrently with error isolation
      const results = await Promise.allSettled(jobs.map(job => this.processJob(job)));
      
      // Log any unexpected rejections (individual job failures are handled in processJob)
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Unexpected error processing job ${jobs[index].id}:`, result.reason);
        }
      });

      // Continue processing immediately if there were jobs
      setImmediate(() => this.processNextBatch());
    } catch (error) {
      console.error('Error processing job batch:', error);
      // Retry after 10 seconds on error
      this.processingTimeout = setTimeout(() => this.processNextBatch(), 10000);
    }
  }

  /**
   * Process a single job with timing and error handling
   */
  private async processJob(job: Job): Promise<void> {
    const startTime = Date.now();
    try {
      await this.markJobAsProcessing(job.id);
      
      // Import the processor dynamically to avoid circular dependencies
      const { JobProcessor } = await import('./processor');
      const processor = new JobProcessor();
      
      await processor.processJob(job);
      await this.markJobAsCompleted(job.id);
      
      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, true);
      
      console.log(`Job ${job.id} (${job.type}) completed successfully in ${processingTime}ms`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.markJobAsFailed(job.id, errorMessage);
      
      // Update metrics for failure
      this.updateMetrics(Date.now() - startTime, false);
      
      console.error(`Job ${job.id} (${job.type}) failed after ${Date.now() - startTime}ms:`, error);
    }
  }

  /**
   * Stop processing (useful for graceful shutdown)
   */
  stop(): void {
    this.isProcessing = false;
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
  }

  /**
   * Update processing metrics
   */
  private updateMetrics(processingTime: number, success: boolean): void {
    this.processingTimes.push(processingTime);
    // Keep only last 100 processing times for average calculation
    if (this.processingTimes.length > 100) {
      this.processingTimes = this.processingTimes.slice(-100);
    }
    
    this.metrics.avgProcessingTime = this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
    this.metrics.lastProcessedAt = new Date();
    
    if (success) {
      this.metrics.processed++;
    }
  }

  /**
   * Get comprehensive job statistics including metrics
   */
  async getJobStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    dead_letter: number;
    metrics: JobQueueMetrics;
  }> {
    const results = await db
      .select({
        status: jobsTable.status,
        count: sql<number>`cast(count(*) as int)`
      })
      .from(jobsTable)
      .groupBy(jobsTable.status);

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      dead_letter: 0,
    };

    results.forEach(row => {
      if (row.status in stats) {
        (stats as any)[row.status] = row.count;
      }
    });

    return {
      ...stats,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Get failed jobs for inspection
   */
  async getDeadLetterJobs(limit = 50): Promise<Job[]> {
    return await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.status, 'dead_letter'))
      .orderBy(desc(jobsTable.updatedAt))
      .limit(limit);
  }

  /**
   * Retry a job from dead letter queue
   */
  async retryDeadLetterJob(jobId: number): Promise<void> {
    await db
      .update(jobsTable)
      .set({
        status: 'pending',
        scheduledFor: new Date(),
        attempts: 0,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId));
    
    this.startProcessing();
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(olderThanHours = 24 * 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    const result = await db
      .delete(jobsTable)
      .where(
        and(
          eq(jobsTable.status, 'completed'),
          lte(jobsTable.updatedAt, cutoffDate)
        )
      );
    
    return result.rowCount || 0;
  }
}

// Export singleton instance
export const jobQueue = JobQueue.getInstance();