import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { conversationMessagesTable, conversationsTable, usersTable } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateMessageSchema = z.object({
  body: z.string().min(1).max(10000).optional(),
  subject: z.string().max(255).optional(),
});

// GET /api/messages/[id] - Get single message
async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const messageId = parseInt(params.id);

    if (isNaN(messageId)) {
      return apiError("Invalid message ID", 400);
    }

    // Get message with conversation and sender info
    const [message] = await db
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
      .where(eq(conversationMessages.id, messageId))
      .limit(1);

    if (!message) {
      return apiError("Message not found", 404);
    }

    return apiSuccess({ data: message });
  } catch (error: any) {
    console.error("Get message error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    
    return apiError("Failed to get message", 500);
  }
}

// PUT /api/messages/[id] - Update message (admin only)
async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    
    // Check if user is admin (you may want to add this to auth utils)
    if (user.permissions !== 'admin') {
      return apiError("Insufficient permissions", 403);
    }

    const messageId = parseInt(params.id);

    if (isNaN(messageId)) {
      return apiError("Invalid message ID", 400);
    }

    const validation = await validateRequest(request, updateMessageSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { body, subject } = validation.data;

    // Check if message exists
    const [existingMessage] = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.id, messageId))
      .limit(1);

    if (!existingMessage) {
      return apiError("Message not found", 404);
    }

    // Update message
    const [updatedMessage] = await db
      .update(conversationMessages)
      .set({
        body: body || existingMessage.body,
        subject: subject || existingMessage.subject,
        updatedAt: new Date(),
      })
      .where(eq(conversationMessages.id, messageId))
      .returning({
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
      });

    return apiSuccess({
      data: updatedMessage,
      message: "Message updated successfully",
    });
  } catch (error: any) {
    console.error("Update message error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to update message", 500);
  }
}

// DELETE /api/messages/[id] - Delete message (admin only)
async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    
    // Check if user is admin
    if (user.permissions !== 'admin') {
      return apiError("Insufficient permissions", 403);
    }

    const messageId = parseInt(params.id);

    if (isNaN(messageId)) {
      return apiError("Invalid message ID", 400);
    }

    // Check if message exists
    const [existingMessage] = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.id, messageId))
      .limit(1);

    if (!existingMessage) {
      return apiError("Message not found", 404);
    }

    // Delete message
    await db
      .delete(conversationMessages)
      .where(eq(conversationMessages.id, messageId));

    return apiSuccess({
      message: "Message deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete message error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to delete message", 500);
  }
}

export const { GET: handleGET, PUT: handlePUT, DELETE: handleDELETE } = createMethodHandler({ 
  GET, 
  PUT, 
  DELETE 
});
export { handleGET as GET, handlePUT as PUT, handleDELETE as DELETE };