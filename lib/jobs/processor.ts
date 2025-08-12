import { Job } from "@/db/schema/jobs";
import { lightweightJobs } from "@/jobs/lightweight";

export class JobProcessor {
  /**
   * Process a job based on its type
   */
  async processJob(job: Job): Promise<void> {
    const handler = lightweightJobs[job.type as keyof typeof lightweightJobs];
    
    if (!handler) {
      throw new Error(`No handler found for job type: ${job.type}`);
    }

    // Execute the job handler with the payload
    await handler(job.payload || {});
  }
}

export const jobProcessor = new JobProcessor();