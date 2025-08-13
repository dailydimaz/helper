import { NextRequest } from "next/server";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess } from "@/lib/api";
import { db } from "@/db/client";
import { conversations, conversationFollowers, users } from "@/db/schema";
import { eq } from "drizzle-orm";

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

// GET /api/conversations/[slug]/followers - Get list of followers
async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { user } = await requireMailboxAccess();
    const conversation = await getConversationBySlug(params.slug);
    
    const followers = await db.query.conversationFollowers.findMany({
      where: eq(conversationFollowers.conversationId, conversation.id),
      with: {
        user: {
          columns: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
      orderBy: (conversationFollowers, { desc }) => [desc(conversationFollowers.createdAt)],
    });

    const followerList = followers.map(follow => ({
      id: follow.id,
      followedAt: follow.createdAt,
      user: {
        id: follow.user.id,
        email: follow.user.email,
        displayName: follow.user.displayName || follow.user.email,
      },
    }));

    return apiSuccess({
      data: followerList,
    });
  } catch (error) {
    console.error("Get followers error:", error);
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
    return apiError("Failed to get followers", 500);
  }
}

export { GET };