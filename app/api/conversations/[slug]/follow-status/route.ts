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

// GET /api/conversations/[slug]/follow-status - Check if user is following conversation
async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { user } = await requireMailboxAccess();
    const conversation = await getConversationBySlug(params.slug);
    
    const isFollowing = await db.query.conversationFollowers.findFirst({
      where: and(
        eq(conversationFollowers.conversationId, conversation.id),
        eq(conversationFollowers.userId, user.id)
      ),
    });

    // Get follower count
    const followerCount = await db
      .$count(conversationFollowers, eq(conversationFollowers.conversationId, conversation.id));

    return apiSuccess({
      data: {
        isFollowing: !!isFollowing,
        followerCount,
      }
    });
  } catch (error) {
    console.error("Get follow status error:", error);
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
    return apiError("Failed to get follow status", 500);
  }
}

export { GET };