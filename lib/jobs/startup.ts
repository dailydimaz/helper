import { jobQueue } from "./queue";
import { jobScheduler, scheduleHelpers } from "./scheduler";

/**
 * Initialize the lightweight job system
 * Call this on application startup
 */
export const initializeJobSystem = () => {
  console.log("Initializing lightweight job system...");
  
  // Start the job queue processor
  // The queue will automatically start processing when jobs are added
  
  // Set up recurring cron-like jobs using setTimeout
  setupRecurringJobs();
  
  console.log("Job system initialized successfully");
};

/**
 * Set up recurring jobs to replace the cron jobs
 */
const setupRecurringJobs = () => {
  console.log("Setting up recurring jobs...");
  
  // === System Maintenance Jobs ===
  
  // Every 30 minutes - Process email queue and send notifications (using recurring jobs)
  scheduleHelpers.hourly("processEmailQueue", { batchSize: 100, maxAge: 30 }, "process-email-queue-hourly");
  scheduleHelpers.hourly("sendPendingNotifications", { batchSize: 50, maxAge: 5 }, "send-notifications-hourly");
  
  // Every hour - System cleanup and maintenance
  scheduleHelpers.hourly("cleanupDanglingFiles", { dryRun: false, olderThanDays: 1 }, "cleanup-files-hourly");
  scheduleHelpers.hourly("closeInactiveConversations", {}, "close-inactive-hourly");
  scheduleHelpers.hourly("cleanupFailedEmails", { olderThanDays: 3 }, "cleanup-failed-emails-hourly");
  scheduleHelpers.hourly("cleanupOldNotifications", { olderThanDays: 30, keepFailedDays: 7 }, "cleanup-notifications-hourly");
  
  // Daily at 3 AM - Job queue maintenance
  scheduleHelpers.daily("cleanupOldJobs", { olderThanHours: 24 * 7, batchSize: 1000 }, 3, "cleanup-old-jobs-daily");
  
  // === Business Logic Jobs ===
  
  // Daily at 7 PM (19:00)
  scheduleHelpers.daily("bulkEmbeddingClosedConversations", {}, 19, "bulk-embedding-daily");
  
  // Weekdays at 2 PM (14:00) - Monday through Friday
  for (let day = 1; day <= 5; day++) {
    scheduleHelpers.weekly("checkAssignedTicketResponseTimes", {}, day, 14, `ticket-response-check-${day}`);
    scheduleHelpers.weekly("checkVipResponseTimes", {}, day, 14, `vip-response-check-${day}`);
  }
  
  // Daily at midnight (00:00) - System maintenance
  scheduleHelpers.daily("renewMailboxWatches", {}, 0, "renew-watches-daily");
  scheduleHelpers.daily("performDatabaseMaintenance", { analyze: true, vacuum: false }, 0, "db-maintenance-daily");
  
  // Weekly on Sunday at midnight (day 0)
  scheduleHelpers.weekly("scheduledWebsiteCrawl", {}, 0, 0, "website-crawl-weekly");
  scheduleHelpers.weekly("performDatabaseMaintenance", { analyze: true, vacuum: true }, 0, 2, "db-maintenance-weekly"); // Sunday at 2 AM
  
  // === Reporting Jobs ===
  
  // Daily reports at 4 PM (16:00), but skip Mondays (day 1)
  for (let day = 0; day <= 6; day++) {
    if (day !== 1) { // Skip Monday
      scheduleHelpers.weekly("generateDailyReports", {}, day, 16, `daily-reports-${day}`);
    }
  }
  
  // Weekly reports on Monday at 4 PM (16:00)
  scheduleHelpers.weekly("generateWeeklyReports", {}, 1, 16, "weekly-reports-monday");
  
  console.log("Recurring jobs scheduled successfully");
};

/**
 * Gracefully shutdown the job system
 */
export const shutdownJobSystem = () => {
  console.log("Shutting down job system...");
  
  jobQueue.stop();
  jobScheduler.cancelAllJobs();
  
  console.log("Job system shutdown complete");
};

// Helper function to get job system statistics
export const getJobSystemStats = async () => {
  const queueStats = await jobQueue.getJobStats();
  const scheduledCount = jobScheduler.getScheduledJobCount();
  
  return {
    queue: queueStats,
    scheduledJobs: scheduledCount,
  };
};