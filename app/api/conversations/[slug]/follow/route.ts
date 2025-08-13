import { NextRequest } from "next/server";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess } from "@/lib/api";
import { db } from "@/db/client";
import { conversations, conversationFollowers } from "@/db/schema";
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

// POST /api/conversations/[slug]/follow - Follow conversation
async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { user } = await requireMailboxAccess();
    const conversation = await getConversationBySlug(params.slug);
    
    // Check if already following
    const existingFollow = await db.query.conversationFollowers.findFirst({
      where: and(
        eq(conversationFollowers.conversationId, conversation.id),
        eq(conversationFollowers.userId, user.id)
      ),
    });

    if (existingFollow) {
      return apiError("Already following this conversation", 409);
    }

    // Add follow
    await db.insert(conversationFollowers).values({
      conversationId: conversation.id,
      userId: user.id,
    });

    return apiSuccess(null, "Successfully followed conversation");
  } catch (error) {
    console.error("Follow conversation error:", error);
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
    return apiError("Failed to follow conversation", 500);
  }
}

// DELETE /api/conversations/[slug]/follow - Unfollow conversation
async function DELETE(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { user } = await requireMailboxAccess();
    const conversation = await getConversationBySlug(params.slug);
    
    // Remove follow
    const result = await db.delete(conversationFollowers)
      .where(and(
        eq(conversationFollowers.conversationId, conversation.id),
        eq(conversationFollowers.userId, user.id)
      ));

    return apiSuccess(null, "Successfully unfollowed conversation");
  } catch (error) {
    console.error("Unfollow conversation error:", error);
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
    return apiError("Failed to unfollow conversation", 500);
  }
}

export { POST, DELETE };