import { NextRequest } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { db } from "@/db/client";
import { conversationsTable, conversationMessagesTable } from "@/db/schema";
import type { ConversationMessage } from "@/lib/swr/realtime-hooks";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

// GET /api/conversation/{slug}/messages - Get conversation messages
async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const { slug } = await context.params;
    
    // First, find the conversation
    const conversation = await db.query.conversationsTable.findFirst({
      where: and(
        eq(conversationsTable.slug, slug),
        eq(conversationsTable.unused_mailboxId, mailbox.id),
        isNull(conversationsTable.mergedIntoId)
      ),
    });
    
    if (!conversation) {
      return apiError("Conversation not found", 404);
    }
    
    // Fetch messages for the conversation
    const messages = await db
      .select({
        id: conversationMessagesTable.id,
        content: conversationMessagesTable.bodyPlaintext,
        createdAt: conversationMessagesTable.createdAt,
        updatedAt: conversationMessagesTable.updatedAt,
        role: conversationMessagesTable.role,
        userId: conversationMessagesTable.userId,
        metadata: conversationMessagesTable.metadata,
        status: conversationMessagesTable.status,
        isPinned: conversationMessagesTable.isPinned,
        deletedAt: conversationMessagesTable.deletedAt,
      })
      .from(conversationMessagesTable)
      .where(
        and(
          eq(conversationMessagesTable.conversationId, conversation.id),
          isNull(conversationMessagesTable.deletedAt)
        )
      )
      .orderBy(asc(conversationMessagesTable.createdAt));
    
    // Transform to ConversationMessage format
    const conversationMessages: ConversationMessage[] = messages
      .filter(msg => msg.content) // Only include messages with content
      .map((msg) => ({
        id: msg.id.toString(),
        content: msg.content || "",
        createdAt: msg.createdAt.toISOString(),
        updatedAt: msg.updatedAt.toISOString(),
        type: mapMessageRole(msg.role),
        metadata: msg.metadata || {},
      }));

    return apiSuccess(conversationMessages);
  } catch (error) {
    console.error("Get conversation messages error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to get conversation messages", 500);
  }
}

// Map database message roles to SWR hook message types
function mapMessageRole(role: string): ConversationMessage['type'] {
  switch (role) {
    case 'user':
      return 'user';
    case 'staff':
      return 'ai'; // Staff messages are treated as AI for the purposes of the chat UI
    case 'ai_assistant':
      return 'ai';
    case 'tool':
      return 'system';
    default:
      return 'system';
  }
}

export const { GET: handleGET } = createMethodHandler({ GET });
export { handleGET as GET };