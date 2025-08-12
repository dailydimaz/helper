import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { conversationsTable } from "@/db/schema";
import { publishToRealtime } from "@/lib/realtime/publish";
import { conversationsListChannelId } from "@/lib/realtime/channels";

const updateStatusSchema = z.object({
  conversationId: z.number(),
  status: z.enum(["open", "closed", "spam"]),
  assignedToId: z.string().nullable().optional(),
});

// PATCH /api/conversation/update-status - Update conversation status
async function PATCH(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const validation = await validateRequest(request, updateStatusSchema);
    if ("error" in validation) {
      return validation.error;
    }
    
    const { conversationId, status, assignedToId } = validation.data;
    
    // First, find the conversation to ensure it belongs to the mailbox
    const conversation = await db.query.conversationsTable.findFirst({
      where: and(
        eq(conversationsTable.id, conversationId),
        eq(conversationsTable.unused_mailboxId, mailbox.id),
        isNull(conversationsTable.mergedIntoId)
      ),
    });
    
    if (!conversation) {
      return apiError("Conversation not found", 404);
    }
    
    // Prepare update data
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };
    
    // Handle assignment
    if (assignedToId !== undefined) {
      updateData.assignedToId = assignedToId;
      updateData.assignedToAI = false; // Clear AI assignment when manually assigning
    }
    
    // Set closed timestamp if closing
    if (status === "closed" && conversation.status !== "closed") {
      updateData.closedAt = new Date();
    } else if (status !== "closed") {
      updateData.closedAt = null;
    }
    
    // Update the conversation
    const [updatedConversation] = await db
      .update(conversationsTable)
      .set(updateData)
      .where(eq(conversationsTable.id, conversationId))
      .returning();
    
    if (!updatedConversation) {
      throw new Error("Failed to update conversation");
    }
    
    // Publish real-time update (for any legacy components still using real-time)
    try {
      await publishToRealtime(conversationsListChannelId(mailbox.id), {
        type: "conversation_updated",
        data: {
          id: conversationId,
          status,
          assignedToId,
          closedAt: updateData.closedAt,
        },
      });
    } catch (realtimeError) {
      console.warn("Failed to publish real-time update:", realtimeError);
      // Don't fail the request if real-time publishing fails
    }
    
    return apiSuccess({
      id: updatedConversation.id,
      status: updatedConversation.status,
      assignedToId: updatedConversation.assignedToId,
      closedAt: updatedConversation.closedAt,
      updatedAt: updatedConversation.updatedAt,
    });
  } catch (error) {
    console.error("Update conversation status error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to update conversation status", 500);
  }
}

export const { PATCH: handlePATCH } = createMethodHandler({ PATCH });
export { handlePATCH as PATCH };