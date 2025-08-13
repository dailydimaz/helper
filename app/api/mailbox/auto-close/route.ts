import { NextRequest } from "next/server";
import { and, eq, lt, isNull } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { db } from "@/db/client";
import { conversationsTable } from "@/db/schema/conversations";

export const runtime = "edge";

// POST /api/mailbox/auto-close - Run auto-close for inactive conversations
async function POST(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();

    if (!mailbox.autoCloseEnabled) {
      return apiError("Auto-close is not enabled for this mailbox", 400);
    }

    const daysOfInactivity = mailbox.autoCloseDaysOfInactivity || 14;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOfInactivity);

    // Close conversations that have been inactive for the specified days
    const closedConversations = await db
      .update(conversationsTable)
      .set({
        status: "closed",
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(conversationsTable.status, "open"),
        lt(conversationsTable.lastUserEmailCreatedAt, cutoffDate),
        isNull(conversationsTable.mergedIntoId)
      ))
      .returning({
        id: conversationsTable.id,
        slug: conversationsTable.slug,
        subject: conversationsTable.subjectPlaintext,
      });

    return apiSuccess({ 
      data: {
        closedCount: closedConversations.length,
        conversations: closedConversations
      },
      message: `Auto-closed ${closedConversations.length} inactive conversations`
    });
  } catch (error) {
    console.error("Auto-close error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to run auto-close", 500);
  }
}

export const { POST: handlePOST } = createMethodHandler({ POST });
export { handlePOST as POST };