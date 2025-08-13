import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, isNull, ne, cosineDistance, gt } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateQueryParams } from "@/lib/api";
import { db } from "@/db/client";
import { conversationsTable } from "@/db/schema";

const findSimilarSchema = z.object({
  conversationSlug: z.string().min(1),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

// GET /api/mailbox/conversations/find-similar - Find similar conversations
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const validation = validateQueryParams(request, findSimilarSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { conversationSlug, limit } = validation.data;

    // First get the target conversation and its embedding
    const [targetConversation] = await db
      .select({
        id: conversationsTable.id,
        embedding: conversationsTable.embedding,
      })
      .from(conversationsTable)
      .where(and(
        eq(conversationsTable.slug, conversationSlug),
        isNull(conversationsTable.mergedIntoId)
      ));

    if (!targetConversation || !targetConversation.embedding) {
      return apiSuccess({ data: [] });
    }

    // Find similar conversations using cosine similarity
    const similarConversations = await db
      .select({
        id: conversationsTable.id,
        slug: conversationsTable.slug,
        subject: conversationsTable.subjectPlaintext,
        emailFrom: conversationsTable.emailFrom,
        emailFromName: conversationsTable.emailFromName,
        status: conversationsTable.status,
        createdAt: conversationsTable.createdAt,
        lastUserEmailCreatedAt: conversationsTable.lastUserEmailCreatedAt,
        similarity: cosineDistance(conversationsTable.embedding, targetConversation.embedding),
      })
      .from(conversationsTable)
      .where(and(
        ne(conversationsTable.id, targetConversation.id),
        isNull(conversationsTable.mergedIntoId),
        gt(cosineDistance(conversationsTable.embedding, targetConversation.embedding), 0.1) // Minimum similarity threshold
      ))
      .orderBy(cosineDistance(conversationsTable.embedding, targetConversation.embedding))
      .limit(limit);

    return apiSuccess({ data: similarConversations });
  } catch (error) {
    console.error("Find similar conversations error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to find similar conversations", 500);
  }
}

export const { GET: handleGET } = createMethodHandler({ GET });
export { handleGET as GET };