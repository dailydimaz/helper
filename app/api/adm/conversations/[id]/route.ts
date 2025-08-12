import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { conversationsTable, conversationMessagesTable, usersTable } from "@/db/schema";
import { requireAuth, requirePermission } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { updateConversationSchema } from "@/lib/validation/schema";
import { eq, desc } from "drizzle-orm";

async function getConversation(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const conversationId = parseInt(params.id);

    // Get conversation with assigned user info
    const [conversation] = await db
      .select({
        id: conversationsTable.id,
        slug: conversationsTable.slug,
        subject: conversationsTable.subject,
        toEmailAddress: conversationsTable.toEmailAddress,
        fromName: conversationsTable.fromName,
        status: conversationsTable.status,
        assignedToId: conversationsTable.assignedToId,
        messageCount: conversationsTable.messageCount,
        createdAt: conversationsTable.createdAt,
        updatedAt: conversationsTable.updatedAt,
        assignedTo: {
          id: usersTable.id,
          email: usersTable.email,
          displayName: usersTable.displayName,
        },
      })
      .from(conversationsTable)
      .leftJoin(usersTable, eq(conversationsTable.assignedToId, usersTable.id))
      .where(eq(conversationsTable.id, conversationId))
      .limit(1);

    if (!conversation) {
      return apiError("Conversation not found", 404);
    }

    // Get recent messages
    const messages = await db
      .select({
        id: conversationMessagesTable.id,
        content: conversationMessagesTable.content,
        fromEmail: conversationMessagesTable.fromEmail,
        isFromCustomer: conversationMessagesTable.isFromCustomer,
        createdAt: conversationMessagesTable.createdAt,
      })
      .from(conversationMessagesTable)
      .where(eq(conversationMessagesTable.conversationId, conversationId))
      .orderBy(desc(conversationMessagesTable.createdAt))
      .limit(20);

    const result = {
      ...conversation,
      messages: messages.reverse(), // Show oldest first
    };

    return apiSuccess({ data: result });
  } catch (error: any) {
    console.error("Get conversation error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to get conversation", 500);
  }
}

async function updateConversation(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const conversationId = parseInt(params.id);

    const validation = await validateRequest(request, updateConversationSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const updateData = validation.data;

    // Check if conversation exists
    const [existingConversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .limit(1);

    if (!existingConversation) {
      return apiError("Conversation not found", 404);
    }

    // If assigning to a user, verify the user exists and is active
    if (updateData.assignedToId) {
      const [assignedUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, updateData.assignedToId))
        .limit(1);

      if (!assignedUser || !assignedUser.isActive) {
        return apiError("Assigned user not found or inactive", 400);
      }
    }

    // Update conversation
    const [updatedConversation] = await db
      .update(conversationsTable)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(conversationsTable.id, conversationId))
      .returning();

    return apiSuccess({
      data: updatedConversation,
      message: "Conversation updated successfully",
    });
  } catch (error: any) {
    console.error("Update conversation error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to update conversation", 500);
  }
}

const handlers = createMethodHandler({ GET: getConversation, PUT: updateConversation });
export const GET = handlers.GET;
export const PUT = handlers.PUT;