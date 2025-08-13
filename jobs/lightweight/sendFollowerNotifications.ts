import { db } from "@/db/client";
import { followerNotifications, users } from "@/db/schema";
import { eq, and, lte, inArray } from "drizzle-orm";
import { Resend } from "resend";

// Initialize Resend if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Send pending follower notification emails
 */
export const sendPendingFollowerNotifications = async (payload: {
  batchSize?: number;
  maxAge?: number; // in minutes
}) => {
  const { batchSize = 20, maxAge = 5 } = payload;
  
  console.log(`Sending pending follower notifications: batch size ${batchSize}, max age ${maxAge} minutes`);
  
  const cutoffTime = new Date(Date.now() - maxAge * 60 * 1000);
  
  // Find pending notifications that are ready to send
  const pendingNotifications = await db.query.followerNotifications.findMany({
    where: and(
      eq(followerNotifications.status, "pending"),
      lte(followerNotifications.createdAt, cutoffTime),
      eq(followerNotifications.emailSent, false)
    ),
    with: {
      user: {
        columns: {
          id: true,
          email: true,
          displayName: true,
        },
      },
      conversation: {
        columns: {
          id: true,
          slug: true,
          subject: true,
        },
      },
    },
    limit: batchSize,
    orderBy: followerNotifications.createdAt,
  });

  if (pendingNotifications.length === 0) {
    console.log("No pending follower notifications to send");
    return { sentCount: 0, failedCount: 0 };
  }

  console.log(`Found ${pendingNotifications.length} pending follower notifications`);
  
  // Group notifications by user to send digest emails
  const notificationsByUser = new Map<string, typeof pendingNotifications>();
  
  for (const notification of pendingNotifications) {
    const userId = notification.userId;
    if (!notificationsByUser.has(userId)) {
      notificationsByUser.set(userId, []);
    }
    notificationsByUser.get(userId)!.push(notification);
  }

  let sentCount = 0;
  let failedCount = 0;

  // Send digest email for each user
  for (const [userId, userNotifications] of notificationsByUser) {
    try {
      const user = userNotifications[0].user;
      if (!user?.email) {
        console.warn(`User ${userId} has no email address`);
        continue;
      }

      // Prepare email content
      const emailContent = prepareEmailContent(user, userNotifications);

      // Send email
      if (resend) {
        await resend.emails.send({
          from: process.env.RESEND_FROM_ADDRESS || "noreply@helper.ai",
          to: user.email,
          subject: emailContent.subject,
          html: emailContent.html,
        });
      } else {
        // Simulate email sending if Resend is not configured
        console.log(`📧 Would send email to ${user.email}: ${emailContent.subject}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Mark notifications as sent
      const notificationIds = userNotifications.map(n => n.id);
      await db
        .update(followerNotifications)
        .set({ 
          status: "sent",
          emailSent: true,
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(inArray(followerNotifications.id, notificationIds));

      sentCount += userNotifications.length;
      console.log(`✓ Sent ${userNotifications.length} notifications to ${user.email}`);

    } catch (error) {
      console.error(`✗ Failed to send notifications to user ${userId}:`, error);
      
      // Mark as failed
      const notificationIds = userNotifications.map(n => n.id);
      await db
        .update(followerNotifications)
        .set({ 
          status: "failed",
          updatedAt: new Date(),
        })
        .where(inArray(followerNotifications.id, notificationIds));
        
      failedCount += userNotifications.length;
    }
  }

  console.log(`Follower notification summary: ${sentCount} sent, ${failedCount} failed`);
  
  return { sentCount, failedCount };
};

/**
 * Prepare email content for follower notifications
 */
function prepareEmailContent(
  user: { email: string; displayName: string | null },
  notifications: any[]
) {
  const displayName = user.displayName || user.email.split('@')[0];
  
  // Group notifications by type
  const byType = {
    new_message: notifications.filter(n => n.type === "new_message"),
    status_change: notifications.filter(n => n.type === "status_change"),
    assignment_change: notifications.filter(n => n.type === "assignment_change"),
    new_note: notifications.filter(n => n.type === "new_note"),
  };

  // Create subject line
  const subject = notifications.length === 1
    ? `Helper: ${notifications[0].title}`
    : `Helper: ${notifications.length} updates on conversations you follow`;

  // Create HTML content
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .notification { background: white; border: 1px solid #e0e0e0; padding: 15px; margin-bottom: 10px; border-radius: 4px; }
        .notification-title { font-weight: bold; color: #1a73e8; margin-bottom: 5px; }
        .notification-message { color: #666; }
        .conversation-link { display: inline-block; margin-top: 5px; color: #1a73e8; text-decoration: none; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Hi ${displayName},</h2>
          <p>Here are updates on conversations you're following:</p>
        </div>
        
        ${notifications.map(n => `
          <div class="notification">
            <div class="notification-title">${getNotificationIcon(n.type)} ${n.title}</div>
            <div class="notification-message">${n.message}</div>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/conversations/${n.conversation?.slug}" class="conversation-link">
              View conversation →
            </a>
          </div>
        `).join('')}
        
        <div class="footer">
          <p>You're receiving this email because you're following these conversations.</p>
          <p>To stop following a conversation, click the heart icon in the conversation view.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}

/**
 * Get emoji icon for notification type
 */
function getNotificationIcon(type: string): string {
  switch (type) {
    case "new_message": return "💬";
    case "status_change": return "🔄";
    case "assignment_change": return "👤";
    case "new_note": return "📝";
    default: return "🔔";
  }
}

/**
 * Clean up old follower notification records
 */
export const cleanupOldFollowerNotifications = async (payload: {
  olderThanDays?: number;
}) => {
  const { olderThanDays = 30 } = payload;
  
  console.log(`Cleaning up follower notifications older than ${olderThanDays} days`);
  
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  
  const result = await db
    .delete(followerNotifications)
    .where(
      and(
        eq(followerNotifications.status, "sent"),
        lte(followerNotifications.sentAt, cutoff)
      )
    )
    .returning({ id: followerNotifications.id });
  
  console.log(`Cleaned up ${result.length} old follower notifications`);
  
  return { deletedCount: result.length };
};