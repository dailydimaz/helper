import { NextRequest } from "next/server";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateQueryParams } from "@/lib/api";
import { db } from "@/db/client";
import { conversationsTable, conversationMessagesTable, platformCustomersTable } from "@/db/schema";
import type { ConversationListItem } from "@/app/types/global";

const conversationFiltersSchema = z.object({
  filters: z.string().optional().transform((val) => {
    if (!val) return {};
    try {
      return JSON.parse(decodeURIComponent(val));
    } catch {
      return {};
    }
  }),
  status: z.array(z.string()).optional(),
  category: z.string().optional(),
  assignedToId: z.string().nullable().optional(),
});

// GET /api/mailbox/conversations - Get filtered conversations
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const validation = validateQueryParams(request, conversationFiltersSchema);
    if ("error" in validation) {
      return validation.error;
    }
    
    const { filters } = validation.data;
    
    // Build where conditions based on filters
    const whereConditions = [
      eq(conversationsTable.unused_mailboxId, mailbox.id),
      isNull(conversationsTable.mergedIntoId)
    ];
    
    // Apply status filter
    if (filters.status && Array.isArray(filters.status)) {
      whereConditions.push(inArray(conversationsTable.status, filters.status));
    }
    
    // Apply assignee filter
    if (filters.assignedToId !== undefined) {
      if (filters.assignedToId === null) {
        whereConditions.push(isNull(conversationsTable.assignedToId));
      } else {
        whereConditions.push(eq(conversationsTable.assignedToId, filters.assignedToId));
      }
    }
    
    // Fetch conversations with related data
    const conversations = await db
      .select({
        id: conversationsTable.id,
        slug: conversationsTable.slug,
        subject: conversationsTable.subjectPlaintext,
        status: conversationsTable.status,
        createdAt: conversationsTable.createdAt,
        updatedAt: conversationsTable.updatedAt,
        lastUserEmailCreatedAt: conversationsTable.lastUserEmailCreatedAt,
        lastReadAt: conversationsTable.lastReadAt,
        emailFrom: conversationsTable.emailFrom,
        emailFromName: conversationsTable.emailFromName,
        assignedToId: conversationsTable.assignedToId,
        assignedToAI: conversationsTable.assignedToAI,
        isPrompt: conversationsTable.isPrompt,
        isVisitor: conversationsTable.isVisitor,
        closedAt: conversationsTable.closedAt,
        source: conversationsTable.source,
        // Get latest message info
        recentMessage: conversationMessagesTable.bodyPlaintext,
        recentMessageAt: conversationMessagesTable.createdAt,
      })
      .from(conversationsTable)
      .leftJoin(
        conversationMessagesTable,
        eq(conversationMessagesTable.conversationId, conversationsTable.id)
      )
      .where(and(...whereConditions))
      .orderBy(desc(conversationsTable.lastUserEmailCreatedAt))
      .limit(100);
    
    // Group by conversation and get the most recent message for each
    const conversationMap = new Map<number, any>();
    
    for (const conv of conversations) {
      if (!conversationMap.has(conv.id)) {
        conversationMap.set(conv.id, {
          ...conv,
          recentMessageText: conv.recentMessage,
          messages: []
        });
      } else if (conv.recentMessageAt && 
                 (!conversationMap.get(conv.id)?.recentMessageAt || 
                  conv.recentMessageAt > conversationMap.get(conv.id)?.recentMessageAt)) {
        const existing = conversationMap.get(conv.id);
        conversationMap.set(conv.id, {
          ...existing,
          recentMessageText: conv.recentMessage,
          recentMessageAt: conv.recentMessageAt,
        });
      }
    }
    
    // Get message counts for conversations
    const conversationIds = Array.from(conversationMap.keys());
    const messageCounts = await db
      .select({
        count: count(),
        conversationId: conversationMessagesTable.conversationId,
      })
      .from(conversationMessagesTable)
      .where(
        and(
          inArray(conversationMessagesTable.conversationId, conversationIds),
          inArray(conversationMessagesTable.role, ["user", "staff", "ai_assistant"]),
          isNull(conversationMessagesTable.deletedAt)
        )
      )
      .groupBy(conversationMessagesTable.conversationId);
    
    // Transform to ConversationListItem format
    const conversationList: ConversationListItem[] = Array.from(conversationMap.values()).map((conv) => {
      const messageCount = messageCounts.find(m => m.conversationId === conv.id)?.count || 0;
      
      return {
        id: conv.id,
        slug: conv.slug,
        subject: conv.subject || "(no subject)",
        status: conv.status,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        lastUserEmailCreatedAt: conv.lastUserEmailCreatedAt,
        lastReadAt: conv.lastReadAt,
        emailFrom: conv.emailFrom,
        emailFromName: conv.emailFromName,
        assignedToId: conv.assignedToId,
        assignedToAI: conv.assignedToAI || false,
        isPrompt: conv.isPrompt,
        isVisitor: conv.isVisitor,
        closedAt: conv.closedAt,
        source: conv.source,
        recentMessageText: conv.recentMessageText,
        recentMessageAt: conv.recentMessageAt,
        messageCount,
        unreadCount: 0, // TODO: implement unread count calculation
        customerInfo: null, // TODO: fetch customer info if needed
      };
    });

    return apiSuccess(conversationList);
  } catch (error) {
    console.error("Get conversations error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to get conversations", 500);
  }
}

export const { GET: handleGET } = createMethodHandler({ GET });
export { handleGET as GET };