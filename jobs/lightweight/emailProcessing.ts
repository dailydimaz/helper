import { db } from "@/db/client";
import { conversationMessages } from "@/db/schema";
import { eq, and, isNull, lte } from "drizzle-orm";

/**
 * Process pending email sending jobs
 */
export const processEmailQueue = async (payload: {
  batchSize?: number;
  maxAge?: number; // in minutes
}) => {
  const { batchSize = 50, maxAge = 30 } = payload;
  
  console.log(`Processing email queue: batch size ${batchSize}, max age ${maxAge} minutes`);
  
  // Find pending emails that are ready to send
  const cutoffTime = new Date(Date.now() - maxAge * 60 * 1000);
  
  const pendingEmails = await db.query.conversationMessages.findMany({
    where: and(
      eq(conversationMessages.status, "queueing"),
      isNull(conversationMessages.deletedAt),
      lte(conversationMessages.createdAt, cutoffTime)
    ),
    limit: batchSize,
    orderBy: conversationMessages.createdAt,
  });

  if (pendingEmails.length === 0) {
    console.log("No pending emails to process");
    return;
  }

  console.log(`Found ${pendingEmails.length} pending emails to process`);
  
  // Process each email by triggering the postEmailToGmail job
  const { triggerEvent } = await import("@/lib/jobs/trigger");
  
  const promises = pendingEmails.map(email => 
    triggerEvent("conversations/email.enqueued", { messageId: email.id })
  );
  
  await Promise.allSettled(promises);
  
  console.log(`Triggered email sending for ${pendingEmails.length} emails`);
};

/**
 * Clean up old failed email attempts
 */
export const cleanupFailedEmails = async (payload: {
  olderThanDays?: number;
}) => {
  const { olderThanDays = 7 } = payload;
  
  console.log(`Cleaning up failed emails older than ${olderThanDays} days`);
  
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  
  const result = await db
    .update(conversationMessages)
    .set({ status: "expired" })
    .where(
      and(
        eq(conversationMessages.status, "failed"),
        lte(conversationMessages.updatedAt, cutoffDate)
      )
    );
  
  const cleanedCount = result.rowCount || 0;
  console.log(`Marked ${cleanedCount} failed emails as expired`);
  
  return { cleanedCount };
};