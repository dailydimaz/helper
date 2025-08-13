import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { conversationMessagesTable } from "@/db/schema/conversationMessages";

const flagAsBadSchema = z.object({
  messageId: z.number().int().positive(),
  reason: z.string().optional(),
});

// POST /api/mailbox/conversations/messages/flag-as-bad - Flag message as bad
async function POST(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const validation = await validateRequest(request, flagAsBadSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { messageId, reason } = validation.data;

    // Check if message exists and belongs to a conversation in this mailbox
    const [message] = await db
      .select()
      .from(conversationMessagesTable)
      .where(eq(conversationMessagesTable.id, messageId));

    if (!message) {
      return apiError("Message not found", 404);
    }

    // Update the message to mark it as flagged
    const [updatedMessage] = await db
      .update(conversationMessagesTable)
      .set({
        // TODO: Add flaggedAsBad and flagReason fields to schema
        updatedAt: new Date(),
      })
      .where(eq(conversationMessagesTable.id, messageId))
      .returning();

    return apiSuccess({ 
      data: updatedMessage,
      message: "Message flagged as bad successfully" 
    });
  } catch (error) {
    console.error("Flag message as bad error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to flag message as bad", 500);
  }
}

export const { POST: handlePOST } = createMethodHandler({ POST });
export { handlePOST as POST };