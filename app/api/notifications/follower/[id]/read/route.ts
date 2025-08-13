import { NextRequest } from "next/server";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess } from "@/lib/api";
import { db } from "@/db/client";
import { followerNotifications } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/notifications/follower/[id]/read - Mark notification as read
async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user } = await requireMailboxAccess();
    const { id } = await context.params;
    
    // Update the notification status to "sent" (which acts as "read")
    const result = await db
      .update(followerNotifications)
      .set({
        status: "sent",
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(followerNotifications.id, id),
          eq(followerNotifications.userId, user.id)
        )
      );

    return apiSuccess(null, "Notification marked as read");
  } catch (error) {
    console.error("Mark notification as read error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to mark notification as read", 500);
  }
}

export { POST };