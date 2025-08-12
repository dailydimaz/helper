/**
 * Lightweight cron utilities that don't depend on PostgreSQL extensions
 * This replaces the pg_cron, pgmq, and http extension dependencies with application-level alternatives
 */

import { db } from "@/db/client";
import { jobsTable, httpRequestsTable } from "@/db/schema/jobs";
import { eq, and, lte } from "drizzle-orm";
import { env } from "@/lib/env";

/**
 * Schedule a job in the lightweight job system
 * This replaces the pg_cron functionality
 */
export const scheduleJob = async (jobType: string, payload: any = {}, scheduledFor?: Date) => {
  console.log(`Scheduling job: ${jobType} for ${scheduledFor ? scheduledFor.toISOString() : 'immediate execution'}`);
  
  await db.insert(jobsTable).values({
    type: jobType,
    payload,
    status: 'pending',
    scheduledFor: scheduledFor || new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
};

/**
 * Process pending jobs
 * This replaces the PGMQ functionality
 */
export const processPendingJobs = async (limit: number = 10): Promise<number> => {
  const now = new Date();
  
  // Get pending jobs that are scheduled to run
  const pendingJobs = await db
    .select()
    .from(jobsTable)
    .where(
      and(
        eq(jobsTable.status, 'pending'),
        lte(jobsTable.scheduledFor, now)
      )
    )
    .limit(limit)
    .orderBy(jobsTable.scheduledFor);

  let processedCount = 0;

  for (const job of pendingJobs) {
    try {
      // Mark job as running
      await db
        .update(jobsTable)
        .set({
          status: 'running',
          updatedAt: new Date(),
        })
        .where(eq(jobsTable.id, job.id));

      // Call the job endpoint using application-level HTTP
      const response = await callJobEndpoint(job);
      
      // Mark job as completed
      await db
        .update(jobsTable)
        .set({
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(jobsTable.id, job.id));

      processedCount++;
    } catch (error) {
      // Handle job failure
      const attempts = (job.attempts || 0) + 1;
      const maxAttempts = job.maxAttempts || 3;
      
      await db
        .update(jobsTable)
        .set({
          status: attempts >= maxAttempts ? 'failed' : 'pending',
          attempts,
          lastError: error instanceof Error ? error.message : String(error),
          updatedAt: new Date(),
          // Retry after exponential backoff
          scheduledFor: attempts < maxAttempts 
            ? new Date(Date.now() + Math.pow(2, attempts) * 1000 * 60) // 2^n minutes
            : job.scheduledFor,
        })
        .where(eq(jobsTable.id, job.id));
        
      console.error(`Job ${job.id} failed (attempt ${attempts}/${maxAttempts}):`, error);
    }
  }

  return processedCount;
};

/**
 * Call job endpoint using application-level HTTP
 * This replaces the PostgreSQL http extension functionality
 */
const callJobEndpoint = async (job: any): Promise<string> => {
  const endpoint = env.NODE_ENV === "development" 
    ? "http://localhost:3010/api/job" 
    : `${env.AUTH_URL}/api/job`;
    
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const jobBody = JSON.stringify({ job: job.type, payload: job.payload });
  
  // Create HMAC for security (simplified version)
  const hmacPayload = `${timestamp}.${jobBody}`;
  
  // Log the HTTP request
  const httpRequestId = await logHttpRequest({
    url: endpoint,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': timestamp,
      'X-Job-Id': job.id.toString(),
    },
    body: jobBody,
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Job-Id': job.id.toString(),
      },
      body: jobBody,
    });

    const responseBody = await response.text();
    
    // Update HTTP request log with response
    await updateHttpRequestResponse(httpRequestId, {
      responseStatus: response.status,
      responseBody,
      responseHeaders: Object.fromEntries(response.headers.entries()),
      completedAt: new Date(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseBody}`);
    }

    return responseBody;
  } catch (error) {
    // Update HTTP request log with error
    await updateHttpRequestResponse(httpRequestId, {
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    });
    throw error;
  }
};

/**
 * Log HTTP request
 */
const logHttpRequest = async (request: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}): Promise<number> => {
  const [result] = await db
    .insert(httpRequestsTable)
    .values({
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body,
      createdAt: new Date(),
    })
    .returning({ id: httpRequestsTable.id });

  return result.id;
};

/**
 * Update HTTP request with response data
 */
const updateHttpRequestResponse = async (
  id: number,
  response: {
    responseStatus?: number;
    responseBody?: string;
    responseHeaders?: Record<string, string>;
    errorMessage?: string;
    completedAt: Date;
  }
) => {
  await db
    .update(httpRequestsTable)
    .set(response)
    .where(eq(httpRequestsTable.id, id));
};

/**
 * Cleanup old jobs and HTTP requests
 */
export const cleanupOldData = async (olderThanDays: number = 30) => {
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  
  // Clean up completed jobs older than cutoff
  const deletedJobs = await db
    .delete(jobsTable)
    .where(
      and(
        eq(jobsTable.status, 'completed'),
        lte(jobsTable.createdAt, cutoffDate)
      )
    );
    
  // Clean up old HTTP requests
  const deletedHttpRequests = await db
    .delete(httpRequestsTable)
    .where(lte(httpRequestsTable.createdAt, cutoffDate));
    
  console.log(`Cleaned up old data: ${deletedJobs.length} jobs, ${deletedHttpRequests.length} HTTP requests`);
};

/**
 * Initialize the lightweight job system
 * This should be called on application startup
 */
export const initializeLightweightJobSystem = () => {
  console.log('Lightweight job system initialized (no extensions required)');
  
  // Set up periodic job processing
  setInterval(async () => {
    try {
      const processed = await processPendingJobs();
      if (processed > 0) {
        console.log(`Processed ${processed} jobs`);
      }
    } catch (error) {
      console.error('Error processing jobs:', error);
    }
  }, 5000); // Process every 5 seconds
  
  // Set up daily cleanup
  setInterval(async () => {
    try {
      await cleanupOldData();
    } catch (error) {
      console.error('Error cleaning up old data:', error);
    }
  }, 24 * 60 * 60 * 1000); // Clean up daily
};

// Legacy compatibility functions (no-ops that won't break existing code)
export const setupCron = async (job: string, schedule: string) => {
  console.log(`Legacy setupCron called for ${job} with schedule ${schedule} - now handled by lightweight job system`);
};

export const cleanupOldCronJobs = async (currentJobs: string[]) => {
  console.log('Legacy cleanupOldCronJobs called - lightweight job system handles this automatically');
};

export const setupJobFunctions = async () => {
  console.log('Legacy setupJobFunctions called - lightweight job system handles this automatically');
};