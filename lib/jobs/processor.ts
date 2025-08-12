import { Job } from "@/db/schema/jobs";
import { lightweightJobs, JobType } from "@/jobs/lightweight";

export class JobProcessor {
  /**
   * Process a job based on its type with enhanced error handling and validation
   */
  async processJob(job: Job): Promise<void> {
    const startTime = Date.now();
    
    // Validate job type
    if (!this.isValidJobType(job.type)) {
      throw new Error(`Invalid job type: ${job.type}. Available types: ${Object.keys(lightweightJobs).join(', ')}`);
    }

    const handler = lightweightJobs[job.type as JobType];
    
    if (!handler) {
      throw new Error(`No handler found for job type: ${job.type}`);
    }

    // Clean payload (remove internal properties)
    const cleanPayload = this.cleanPayload(job.payload || {});
    
    try {
      // Execute the job handler with the payload and timeout protection
      await Promise.race([
        handler(cleanPayload),
        this.createTimeout(job.type, 5 * 60 * 1000) // 5 minute timeout
      ]);
      
      const duration = Date.now() - startTime;
      console.log(`✓ Job ${job.id} (${job.type}) completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`✗ Job ${job.id} (${job.type}) failed after ${duration}ms:`, error);
      
      // Enhance error message with context
      const enhancedError = new Error(`Job ${job.type} failed: ${error instanceof Error ? error.message : String(error)}`);
      enhancedError.stack = error instanceof Error ? error.stack : undefined;
      
      throw enhancedError;
    }
  }

  /**
   * Validate if job type is supported
   */
  private isValidJobType(jobType: string): jobType is JobType {
    return jobType in lightweightJobs;
  }

  /**
   * Clean payload by removing internal properties
   */
  private cleanPayload(payload: any): any {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const { _priority, _internal, ...cleanPayload } = payload;
    return cleanPayload;
  }

  /**
   * Create a timeout promise for job execution
   */
  private createTimeout(jobType: string, timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Job ${jobType} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Get available job types
   */
  getAvailableJobTypes(): JobType[] {
    return Object.keys(lightweightJobs) as JobType[];
  }

  /**
   * Check if a specific job type is available
   */
  isJobTypeAvailable(jobType: string): boolean {
    return this.isValidJobType(jobType);
  }
}

export const jobProcessor = new JobProcessor();