import { eq, and, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { jobsTable, NewJob, Job } from "@/db/schema/jobs";

export class JobQueue {
  private static instance: JobQueue;
  private isProcessing = false;
  private processingTimeout: NodeJS.Timeout | null = null;

  static getInstance(): JobQueue {
    if (!JobQueue.instance) {
      JobQueue.instance = new JobQueue();
    }
    return JobQueue.instance;
  }

  /**
   * Add a new job to the queue
   */
  async addJob(type: string, payload?: any, scheduledFor?: Date): Promise<Job> {
    const job: NewJob = {
      type,
      payload,
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
   * Get pending jobs that are ready to be processed
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
      .orderBy(jobsTable.scheduledFor)
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
   * Mark a job as failed
   */
  async markJobAsFailed(jobId: number, error?: string): Promise<void> {
    await db
      .update(jobsTable)
      .set({ 
        status: 'failed',
        payload: sql`COALESCE(payload, '{}'::jsonb) || ${JSON.stringify({ error })}::jsonb`,
        updatedAt: new Date()
      })
      .where(eq(jobsTable.id, jobId));
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
   * Process the next batch of jobs
   */
  private async processNextBatch(): Promise<void> {
    try {
      const jobs = await this.getPendingJobs(5);
      
      if (jobs.length === 0) {
        // No jobs to process, check again in 5 seconds
        this.processingTimeout = setTimeout(() => this.processNextBatch(), 5000);
        return;
      }

      // Process jobs concurrently
      await Promise.all(jobs.map(job => this.processJob(job)));

      // Continue processing immediately if there were jobs
      this.processNextBatch();
    } catch (error) {
      console.error('Error processing job batch:', error);
      // Retry after 10 seconds on error
      this.processingTimeout = setTimeout(() => this.processNextBatch(), 10000);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job): Promise<void> {
    try {
      await this.markJobAsProcessing(job.id);
      
      // Import the processor dynamically to avoid circular dependencies
      const { JobProcessor } = await import('./processor');
      const processor = new JobProcessor();
      
      await processor.processJob(job);
      await this.markJobAsCompleted(job.id);
      
      console.log(`Job ${job.id} (${job.type}) completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.markJobAsFailed(job.id, errorMessage);
      console.error(`Job ${job.id} (${job.type}) failed:`, error);
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
   * Get job statistics
   */
  async getJobStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
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
    };

    results.forEach(row => {
      if (row.status in stats) {
        (stats as any)[row.status] = row.count;
      }
    });

    return stats;
  }
}

// Export singleton instance
export const jobQueue = JobQueue.getInstance();