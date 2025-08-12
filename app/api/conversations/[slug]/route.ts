import { NextRequest } from "next/server";
import { z } from "zod";
import { serializeConversationWithMessages, updateConversation } from "@/lib/data/conversation";
import { getLastAiGeneratedDraft, serializeResponseAiDraft } from "@/lib/data/conversationMessage";
import { updateConversationSchema } from "@/lib/validation/schema";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { authUsers } from "@/db/supabaseSchema/auth";

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

// GET /api/conversations/[slug] - Get specific conversation
async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const conversation = await getConversationBySlug(params.slug);
    
    const draft = await getLastAiGeneratedDraft(conversation.id);
    
    const serializedConversation = await serializeConversationWithMessages(mailbox, conversation);
    
    return apiSuccess({
      data: {
        ...serializedConversation,
        draft: draft ? serializeResponseAiDraft(draft, mailbox) : null,
      }
    });
  } catch (error) {
    console.error("Get conversation error:", error);
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
    return apiError("Failed to get conversation", 500);
  }
}

// PUT /api/conversations/[slug] - Update conversation
async function PUT(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const conversation = await getConversationBySlug(params.slug);
    
    const validation = await validateRequest(request, updateConversationSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { status, assignedToId, message, assignedToAI } = validation.data;

    // Validate assignee if provided
    if (assignedToId) {
      const assignee = await db.query.authUsers.findFirst({
        where: eq(authUsers.id, assignedToId),
      });
      if (!assignee) {
        return apiError("Invalid assignee", 400);
      }
    }

    await updateConversation(conversation.id, {
      set: {
        ...(status !== undefined ? { status } : {}),
        assignedToId,
        assignedToAI,
      },
      byUserId: user.id,
      message: message ?? null,
    });

    return apiSuccess(null, "Conversation updated successfully");
  } catch (error) {
    console.error("Update conversation error:", error);
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
    return apiError("Failed to update conversation", 500);
  }
}

export const { GET: handleGET, PUT: handlePUT } = createMethodHandler({ GET, PUT });
export { handleGET as GET, handlePUT as PUT };