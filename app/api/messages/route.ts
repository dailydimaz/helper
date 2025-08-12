import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { conversationMessagesTable, conversationsTable, usersTable } from "@/db/schema";
import { requireAuth, requirePermission } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler, parsePagination, validateQueryParams } from "@/lib/api";
import { count, desc, ilike, eq, and, or } from "drizzle-orm";
import { z } from "zod";

const messageQuerySchema = z.object({
  page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1),
  perPage: z.string().optional().transform((val) => val ? parseInt(val, 10) : 10),
  q: z.string().optional(),
  conversationId: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
  countOnly: z.string().optional().transform((val) => val === "true"),
});

// GET /api/messages - List messages with search and pagination
async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const queryValidation = validateQueryParams(request, messageQuerySchema);
    if ("error" in queryValidation) {
      return queryValidation.error;
    }

    const { page, perPage, q, conversationId, countOnly } = queryValidation.data;
    const { offset } = parsePagination(request);

    // Build where clauses
    const whereClauses = [];
    
    if (q) {
      whereClauses.push(
        or(
          ilike(conversationMessages.body, `%${q}%`),
          ilike(conversationMessages.subject, `%${q}%`)
        )
      );
    }
    
    if (conversationId) {
      whereClauses.push(eq(conversationMessages.conversationId, conversationId));
    }

    const whereClause = whereClauses.length > 0 
      ? and(...whereClauses)
      : undefined;

    if (countOnly) {
      const [totalResult] = await db
        .select({ count: count() })
        .from(conversationMessages)
        .where(whereClause);

      return apiSuccess({ total: totalResult.count });
    }

    // Get messages with conversation and sender info
    const messages = await db
      .select({
        id: conversationMessages.id,
        body: conversationMessages.body,
        subject: conversationMessages.subject,
        fromEmail: conversationMessages.fromEmail,
        fromName: conversationMessages.fromName,
        toEmail: conversationMessages.toEmail,
        messageRole: conversationMessages.messageRole,
        conversationId: conversationMessages.conversationId,
        createdAt: conversationMessages.createdAt,
        updatedAt: conversationMessages.updatedAt,
        conversation: {
          id: conversations.id,
          slug: conversations.slug,
          subject: conversations.subject,
        },
        sender: {
          id: usersTable.id,
          email: usersTable.email,
          displayName: usersTable.displayName,
        },
      })
      .from(conversationMessages)
      .leftJoin(conversations, eq(conversationMessages.conversationId, conversations.id))
      .leftJoin(usersTable, eq(conversationMessages.fromEmail, usersTable.email))
      .where(whereClause)
      .orderBy(desc(conversationMessages.createdAt))
      .limit(perPage)
      .offset(offset);

    return apiSuccess({ data: messages });
  } catch (error: any) {
    console.error("Get messages error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to get messages", 500);
  }
}

export const { GET: handleGET } = createMethodHandler({ GET });
export { handleGET as GET };