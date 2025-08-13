import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, isNull, desc, cosineDistance, gt } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { conversationsTable, conversationMessagesTable, notesTable } from "@/db/schema";

const updateConversationSchema = z.object({
  status: z.enum(["open", "closed", "spam"]).optional(),
  assignedToId: z.string().nullable().optional(),
  issueGroupId: z.number().int().nullable().optional(),
});

// GET /api/mailbox/conversations/[slug] - Get conversation details
async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const { slug } = await params;

    const [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(and(
        eq(conversationsTable.slug, slug),
        isNull(conversationsTable.mergedIntoId)
      ));

    if (!conversation) {
      return apiError("Conversation not found", 404);
    }

    // Get messages
    const messages = await db
      .select()
      .from(conversationMessagesTable)
      .where(and(
        eq(conversationMessagesTable.conversationId, conversation.id),
        isNull(conversationMessagesTable.deletedAt)
      ))
      .orderBy(conversationMessagesTable.createdAt);

    // Get notes
    const notes = await db
      .select()
      .from(notesTable)
      .where(eq(notesTable.conversationId, conversation.id))
      .orderBy(desc(notesTable.createdAt));

    return apiSuccess({ 
      data: {
        ...conversation,
        messages,
        notes
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
    }
    return apiError("Failed to get conversation", 500);
  }
}

// PATCH /api/mailbox/conversations/[slug] - Update conversation
async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const { slug } = await params;
    
    const validation = await validateRequest(request, updateConversationSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const updateData = validation.data;

    const [updatedConversation] = await db
      .update(conversationsTable)
      .set({
        ...updateData,
        updatedAt: new Date(),
        ...(updateData.status === "closed" ? { closedAt: new Date() } : {}),
      })
      .where(and(
        eq(conversationsTable.slug, slug),
        isNull(conversationsTable.mergedIntoId)
      ))
      .returning();

    if (!updatedConversation) {
      return apiError("Conversation not found", 404);
    }

    return apiSuccess({ data: updatedConversation });
  } catch (error) {
    console.error("Update conversation error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to update conversation", 500);
  }
}

export const { GET: handleGET, PATCH: handlePATCH } = createMethodHandler({ GET, PATCH });
export { handleGET as GET, handlePATCH as PATCH };