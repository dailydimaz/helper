import { jobQueue } from "./queue";

export class JobScheduler {
  private static instance: JobScheduler;
  private scheduledTimeouts: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): JobScheduler {
    if (!JobScheduler.instance) {
      JobScheduler.instance = new JobScheduler();
    }
    return JobScheduler.instance;
  }

  /**
   * Schedule a job to run at a specific time
   */
  scheduleJob(
    jobType: string,
    payload: any,
    scheduledFor: Date,
    jobId?: string
  ): string {
    const id = jobId || `${jobType}_${Date.now()}_${Math.random()}`;
    const delay = Math.max(0, scheduledFor.getTime() - Date.now());

    const timeout = setTimeout(async () => {
      try {
        await jobQueue.addJob(jobType, payload, scheduledFor);
        this.scheduledTimeouts.delete(id);
      } catch (error) {
        console.error(`Failed to schedule job ${jobType}:`, error);
        this.scheduledTimeouts.delete(id);
      }
    }, delay);

    this.scheduledTimeouts.set(id, timeout);
    return id;
  }

  /**
   * Schedule a job to run after a delay (in milliseconds)
   */
  scheduleJobAfter(
    jobType: string,
    payload: any,
    delayMs: number,
    jobId?: string
  ): string {
    const scheduledFor = new Date(Date.now() + delayMs);
    return this.scheduleJob(jobType, payload, scheduledFor, jobId);
  }

  /**
   * Schedule recurring jobs using cron-like patterns
   */
  scheduleRecurringJob(
    jobType: string,
    payload: any,
    cronPattern: string,
    jobId?: string
  ): string {
    const id = jobId || `recurring_${jobType}_${Date.now()}`;
    
    const scheduleNext = () => {
      const nextRun = this.getNextRunTime(cronPattern);
      if (nextRun) {
        const timeout = setTimeout(async () => {
          try {
            await jobQueue.addJob(jobType, payload, nextRun);
            // Schedule the next occurrence
            scheduleNext();
          } catch (error) {
            console.error(`Failed to schedule recurring job ${jobType}:`, error);
          }
        }, Math.max(0, nextRun.getTime() - Date.now()));
        
        this.scheduledTimeouts.set(id, timeout);
      }
    };

    scheduleNext();
    return id;
  }

  /**
   * Cancel a scheduled job
   */
  cancelJob(jobId: string): boolean {
    const timeout = this.scheduledTimeouts.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledTimeouts.delete(jobId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all scheduled jobs
   */
  cancelAllJobs(): void {
    this.scheduledTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.scheduledTimeouts.clear();
  }

  /**
   * Get the number of scheduled jobs
   */
  getScheduledJobCount(): number {
    return this.scheduledTimeouts.size;
  }

  /**
   * Simple cron parser for basic patterns
   * Supports: "0 * * * *" (hourly), "0 0 * * *" (daily), etc.
   */
  private getNextRunTime(cronPattern: string): Date | null {
    const parts = cronPattern.split(' ');
    if (parts.length !== 5) {
      console.error('Invalid cron pattern:', cronPattern);
      return null;
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const now = new Date();
    const next = new Date(now);

    // Simple implementation for common patterns
    if (cronPattern === "0 * * * *") {
      // Every hour at minute 0
      next.setMinutes(0, 0, 0);
      if (next <= now) {
        next.setHours(next.getHours() + 1);
      }
    } else if (cronPattern === "0 0 * * *") {
      // Daily at midnight
      next.setHours(0, 0, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    } else if (cronPattern === "0 0 * * 0") {
      // Weekly on Sunday at midnight
      next.setHours(0, 0, 0, 0);
      const daysUntilSunday = (7 - next.getDay()) % 7;
      if (daysUntilSunday === 0 && next <= now) {
        next.setDate(next.getDate() + 7);
      } else {
        next.setDate(next.getDate() + daysUntilSunday);
      }
    } else if (cronPattern.startsWith("0 ") && cronPattern.endsWith(" * * *")) {
      // Daily at specific hour
      const hourMatch = cronPattern.match(/0 (\d+) \* \* \*/);
      if (hourMatch) {
        const targetHour = parseInt(hourMatch[1]);
        next.setHours(targetHour, 0, 0, 0);
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
      }
    } else {
      // For more complex patterns, default to next hour
      console.warn('Complex cron pattern not fully supported:', cronPattern);
      next.setMinutes(0, 0, 0);
      next.setHours(next.getHours() + 1);
    }

    return next;
  }
}

// Export singleton instance
export const jobScheduler = JobScheduler.getInstance();

// Helper functions for common scheduling patterns
export const scheduleHelpers = {
  /**
   * Schedule a job to run in X minutes
   */
  inMinutes: (jobType: string, payload: any, minutes: number, jobId?: string) => {
    return jobScheduler.scheduleJobAfter(jobType, payload, minutes * 60 * 1000, jobId);
  },

  /**
   * Schedule a job to run in X hours
   */
  inHours: (jobType: string, payload: any, hours: number, jobId?: string) => {
    return jobScheduler.scheduleJobAfter(jobType, payload, hours * 60 * 60 * 1000, jobId);
  },

  /**
   * Schedule a job to run daily at a specific hour
   */
  daily: (jobType: string, payload: any, hour: number, jobId?: string) => {
    return jobScheduler.scheduleRecurringJob(jobType, payload, `0 ${hour} * * *`, jobId);
  },

  /**
   * Schedule a job to run hourly
   */
  hourly: (jobType: string, payload: any, jobId?: string) => {
    return jobScheduler.scheduleRecurringJob(jobType, payload, "0 * * * *", jobId);
  },

  /**
   * Schedule a job to run weekly on a specific day and hour
   */
  weekly: (jobType: string, payload: any, dayOfWeek: number, hour: number, jobId?: string) => {
    return jobScheduler.scheduleRecurringJob(jobType, payload, `0 ${hour} * * ${dayOfWeek}`, jobId);
  },
};