import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { db } from "@/db/client";
import { mailboxesTable } from "@/db/schema/mailboxes";

export const runtime = "edge";

// DELETE /api/mailbox/slack - Disconnect Slack integration
async function DELETE(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();

    // Remove Slack integration from mailbox
    const [updatedMailbox] = await db
      .update(mailboxesTable)
      .set({
        slackBotToken: null,
        slackBotUserId: null,
        slackTeamId: null,
        slackAlertChannel: null,
        updatedAt: new Date(),
      })
      .where(eq(mailboxesTable.id, mailbox.id))
      .returning();

    return apiSuccess({ 
      data: updatedMailbox,
      message: "Slack integration disconnected successfully" 
    });
  } catch (error) {
    console.error("Disconnect Slack error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to disconnect Slack", 500);
  }
}

export const { DELETE: handleDELETE } = createMethodHandler({ DELETE });
export { handleDELETE as DELETE };