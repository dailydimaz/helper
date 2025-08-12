import { NextRequest } from "next/server";
import { z } from "zod";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { conversations, conversationMessages } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// Helper to get conversation by slug
async function getConversationBySlug(slug: string) {
  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.slug, slug),
  });
  
  if (!conversation) {
    throw new Error("Conversation not found");
  }
  
  return conversation;
}

const undoSchema = z.object({
  emailId: z.number(),
});

// POST /api/conversations/[slug]/undo - Undo email send
async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const conversation = await getConversationBySlug(params.slug);
    
    const validation = await validateRequest(request, undoSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { emailId } = validation.data;

    // Find the message to undo
    const message = await db.query.conversationMessages.findFirst({
      where: and(
        eq(conversationMessages.id, emailId),
        eq(conversationMessages.conversationId, conversation.id)
      ),
    });

    if (!message) {
      return apiError("Message not found", 404);
    }

    // Check if message can be undone (only if it's in queueing status)
    if (message.status !== "queueing") {
      return apiError("Message cannot be undone - it has already been sent", 400);
    }

    // Update message status to discarded
    await db
      .update(conversationMessages)
      .set({ 
        status: "discarded",
        updatedAt: new Date(),
      })
      .where(eq(conversationMessages.id, emailId));

    return apiSuccess(null, "Message successfully unsent");
  } catch (error) {
    console.error("Undo message error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
      if (error.message === "Conversation not found") {
        return apiError("Conversation not found", 404);
      }
    }
    return apiError("Failed to undo message", 500);
  }
}

export const { POST: handlePOST } = createMethodHandler({ POST });
export { handlePOST as POST };