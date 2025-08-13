import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { notesTable } from "@/db/schema/notes";
import { conversationsTable } from "@/db/schema/conversations";

const createNoteSchema = z.object({
  conversationSlug: z.string().min(1),
  content: z.string().min(1),
});

// POST /api/mailbox/conversations/notes - Add note to conversation
async function POST(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const validation = await validateRequest(request, createNoteSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { conversationSlug, content } = validation.data;

    // First get the conversation
    const [conversation] = await db
      .select({ id: conversationsTable.id })
      .from(conversationsTable)
      .where(and(
        eq(conversationsTable.slug, conversationSlug),
        isNull(conversationsTable.mergedIntoId)
      ));

    if (!conversation) {
      return apiError("Conversation not found", 404);
    }

    const [note] = await db
      .insert(notesTable)
      .values({
        conversationId: conversation.id,
        content,
        createdByUserId: user.id,
      })
      .returning();

    return apiSuccess({ data: note });
  } catch (error) {
    console.error("Add note error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to add note", 500);
  }
}

export const { POST: handlePOST } = createMethodHandler({ POST });
export { handlePOST as POST };