import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { conversationsTable, conversationMessagesTable } from "@/db/schema";
import { publishToRealtime } from "@/lib/realtime/publish";
import { conversationChannelId } from "@/lib/realtime/channels";
import { notifyFollowersNewMessage } from "@/lib/follower-notifications";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

const sendMessageSchema = z.object({
  content: z.string().min(1, "Content is required"),
  type: z.enum(["user", "ai", "system"]).default("user"),
});

// POST /api/conversation/{slug}/send-message - Send a message to a conversation
async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const { slug } = await context.params;
    
    const validation = await validateRequest(request, sendMessageSchema);
    if ("error" in validation) {
      return validation.error;
    }
    
    const { content, type } = validation.data;
    
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
    
    // Map type to database role
    const role = mapMessageType(type);
    
    // Create the message
    const [newMessage] = await db
      .insert(conversationMessagesTable)
      .values({
        conversationId: conversation.id,
        bodyPlaintext: content,
        role,
        userId: user.id,
        status: "sent",
        isPerfect: false,
        isFlaggedAsBad: false,
        metadata: {},
      })
      .returning();
    
    if (!newMessage) {
      throw new Error("Failed to create message");
    }
    
    // Update conversation's last activity
    await db
      .update(conversationsTable)
      .set({ 
        lastUserEmailCreatedAt: new Date(),
        status: "open" // Ensure conversation is open when new message is sent
      })
      .where(eq(conversationsTable.id, conversation.id));
    
    // Notify followers of new message
    try {
      await notifyFollowersNewMessage(
        conversation.id,
        content,
        user.displayName || user.email,
        user.id
      );
    } catch (notificationError) {
      console.warn("Failed to notify followers:", notificationError);
      // Don't fail the request if notification fails
    }

    // Publish real-time update (for any legacy components still using real-time)
    try {
      await publishToRealtime({
        channel: conversationChannelId(conversation.slug),
        event: "message_sent",
        data: {
          id: newMessage.id,
          content,
          role,
          createdAt: newMessage.createdAt,
        },
      });
    } catch (realtimeError) {
      console.warn("Failed to publish real-time update:", realtimeError);
      // Don't fail the request if real-time publishing fails
    }
    
    return apiSuccess({
      id: newMessage.id.toString(),
      content: newMessage.bodyPlaintext || "",
      createdAt: newMessage.createdAt.toISOString(),
      updatedAt: newMessage.updatedAt.toISOString(),
      type,
      metadata: newMessage.metadata || {},
    });
  } catch (error) {
    console.error("Send message error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to send message", 500);
  }
}

// Map SWR hook message types to database roles
function mapMessageType(type: string): string {
  switch (type) {
    case 'user':
      return 'user';
    case 'ai':
      return 'ai_assistant';
    case 'system':
      return 'tool';
    default:
      return 'user';
  }
}

export const { POST: handlePOST } = createMethodHandler({ POST });
export { handlePOST as POST };