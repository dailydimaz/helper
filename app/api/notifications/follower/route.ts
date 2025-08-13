import { NextRequest } from "next/server";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess } from "@/lib/api";
import { getPendingNotificationsForUser } from "@/lib/follower-notifications";

// GET /api/notifications/follower - Get pending follower notifications for current user
async function GET(request: NextRequest) {
  try {
    const { user } = await requireMailboxAccess();
    
    const notifications = await getPendingNotificationsForUser(user.id);
    
    const formattedNotifications = notifications.map(notification => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt,
      conversation: notification.conversation ? {
        id: notification.conversation.id,
        slug: notification.conversation.slug,
        subject: notification.conversation.subject || "(no subject)",
      } : null,
    }));

    return apiSuccess({
      data: formattedNotifications,
    });
  } catch (error) {
    console.error("Get follower notifications error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to get notifications", 500);
  }
}

export { GET };