import { NextRequest } from "next/server";
import { z } from "zod";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { createConversationMessage } from "@/lib/data/conversationMessage";
import { updateConversation } from "@/lib/data/conversation";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiErr } from "@/lib/handle-api-err";

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

const replySchema = z.object({
  message: z.string().min(1),
  fileSlugs: z.array(z.string()).default([]),
  cc: z.array(z.string()).default([]),
  bcc: z.array(z.string()).default([]),
  shouldAutoAssign: z.boolean(),
  shouldClose: z.boolean(),
  responseToId: z.number().nullable(),
});

// POST /api/conversations/[slug]/messages/reply - Send reply
async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const conversation = await getConversationBySlug(params.slug);
    
    const validation = await validateRequest(request, replySchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { message, fileSlugs, cc, bcc, shouldAutoAssign, shouldClose, responseToId } = validation.data;

    // Create the message
    const newMessage = await createConversationMessage({
      conversationId: conversation.id,
      responseToId,
      status: "queueing",
      body: message,
      cleanedUpText: message,
      role: "staff",
      isPerfect: false,
      isPinned: false,
      isFlaggedAsBad: false,
      metadata: {
        cc,
        bcc,
        fileSlugs,
      },
    });

    // Update conversation status if needed
    if (shouldClose || shouldAutoAssign) {
      const updates: any = {};
      if (shouldClose) {
        updates.status = "closed";
      }
      if (shouldAutoAssign && !conversation.assignedToId) {
        updates.assignedToId = user.id;
      }

      if (Object.keys(updates).length > 0) {
        await updateConversation(conversation.id, {
          set: updates,
          byUserId: user.id,
        });
      }
    }

    return apiSuccess({
      data: { id: newMessage.id },
      message: "Reply sent successfully"
    });
  } catch (error) {
    console.error("Send reply error:", error);
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
    return apiError("Failed to send reply", 500);
  }
}

export const { POST: handlePOST } = createMethodHandler({ POST });
export { handlePOST as POST };