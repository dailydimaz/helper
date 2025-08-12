import { db } from "@/db/client";
import { conversationMessages, conversations, messageNotifications } from "@/db/schema";
import { eq, and, isNull, lte, inArray, desc } from "drizzle-orm";

/**
 * Send pending notification emails
 */
export const sendPendingNotifications = async (payload: {
  batchSize?: number;
  maxAge?: number; // in minutes
}) => {
  const { batchSize = 20, maxAge = 5 } = payload;
  
  console.log(`Sending pending notifications: batch size ${batchSize}, max age ${maxAge} minutes`);
  
  const cutoffTime = new Date(Date.now() - maxAge * 60 * 1000);
  
  // Find pending notifications that are ready to send
  const pendingNotifications = await db.query.messageNotifications.findMany({
    where: and(
      eq(messageNotifications.status, "pending"),
      lte(messageNotifications.createdAt, cutoffTime)
    ),
    with: {
      conversation: true,
      platformCustomer: true,
    },
    limit: batchSize,
    orderBy: messageNotifications.createdAt,
  });

  if (pendingNotifications.length === 0) {
    console.log("No pending notifications to send");
    return { sentCount: 0 };
  }

  console.log(`Found ${pendingNotifications.length} pending notifications`);
  
  let sentCount = 0;
  let failedCount = 0;

  for (const notification of pendingNotifications) {
    try {
      // Mark as processing first
      await db
        .update(messageNotifications)
        .set({ status: "processing" })
        .where(eq(messageNotifications.id, notification.id));

      // Here you would integrate with your email service (SendGrid, SES, etc.)
      // For now, we'll simulate the email sending
      console.log(`Sending notification to ${notification.platformCustomer?.email || 'unknown'}: ${notification.notificationText}`);
      
      // Simulate email service call
      await simulateEmailSend({
        to: notification.platformCustomer?.email || '',
        subject: `New message in conversation: ${notification.conversation?.subject || 'No subject'}`,
        content: notification.notificationText,
      });

      // Mark as sent
      await db
        .update(messageNotifications)
        .set({ 
          status: "sent",
          sentAt: new Date()
        })
        .where(eq(messageNotifications.id, notification.id));

      sentCount++;
      console.log(`✓ Notification ${notification.id} sent successfully`);

    } catch (error) {
      console.error(`✗ Failed to send notification ${notification.id}:`, error);
      
      // Mark as failed
      await db
        .update(messageNotifications)
        .set({ 
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error)
        })
        .where(eq(messageNotifications.id, notification.id));
        
      failedCount++;
    }
  }

  console.log(`Notification summary: ${sentCount} sent, ${failedCount} failed`);
  
  return { sentCount, failedCount };
};

/**
 * Simulate email sending (replace with real email service integration)
 */
async function simulateEmailSend(email: {
  to: string;
  subject: string;
  content: string;
}) {
  // In a real implementation, you would call your email service here
  // For example: await sendGrid.send(email) or await ses.sendEmail(email)
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
  // Simulate occasional failures (5% failure rate)
  if (Math.random() < 0.05) {
    throw new Error("Simulated email service failure");
  }
  
  console.log(`📧 Email sent to ${email.to}: ${email.subject}`);
}

/**
 * Clean up old notification records
 */
export const cleanupOldNotifications = async (payload: {
  olderThanDays?: number;
  keepFailedDays?: number;
}) => {
  const { olderThanDays = 30, keepFailedDays = 7 } = payload;
  
  console.log(`Cleaning up notifications older than ${olderThanDays} days (failed: ${keepFailedDays} days)`);
  
  const sentCutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const failedCutoff = new Date(Date.now() - keepFailedDays * 24 * 60 * 60 * 1000);
  
  // Clean up old sent notifications
  const sentResult = await db
    .delete(messageNotifications)
    .where(
      and(
        eq(messageNotifications.status, "sent"),
        lte(messageNotifications.sentAt, sentCutoff)
      )
    )
    .returning({ id: messageNotifications.id });
  
  // Clean up old failed notifications (keep them shorter for debugging)
  const failedResult = await db
    .delete(messageNotifications)
    .where(
      and(
        eq(messageNotifications.status, "failed"),
        lte(messageNotifications.createdAt, failedCutoff)
      )
    )
    .returning({ id: messageNotifications.id });
  
  const deletedSentCount = sentResult.length;
  const deletedFailedCount = failedResult.length;
  
  console.log(`Cleaned up ${deletedSentCount} sent and ${deletedFailedCount} failed notifications`);
  
  return {
    deletedSentCount,
    deletedFailedCount,
    totalDeleted: deletedSentCount + deletedFailedCount
  };
};

/**
 * Send digest notifications for users with multiple pending notifications
 */
export const sendDigestNotifications = async (payload: {
  minNotifications?: number;
  maxAge?: number; // in hours
}) => {
  const { minNotifications = 3, maxAge = 24 } = payload;
  
  console.log(`Sending digest notifications (min: ${minNotifications}, max age: ${maxAge}h)`);
  
  // This is a more complex query that would group notifications by customer
  // and send digest emails for customers with multiple pending notifications
  
  // For now, return a placeholder
  console.log("Digest notifications feature not implemented yet");
  
  return { digestsSent: 0 };
};