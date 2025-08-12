import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { savedRepliesTable } from "@/db/schema";
import { requireAuth, requirePermission } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { updateSavedReplySchema } from "@/lib/validation/schema";
import { eq } from "drizzle-orm";

async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const savedReplyId = parseInt(params.id);

    const [savedReply] = await db
      .select()
      .from(savedRepliesTable)
      .where(eq(savedRepliesTable.id, savedReplyId))
      .limit(1);

    if (!savedReply) {
      return apiError("Saved reply not found", 404);
    }

    return apiSuccess({ data: savedReply });
  } catch (error: any) {
    console.error("Get saved reply error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to get saved reply", 500);
  }
}

async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const savedReplyId = parseInt(params.id);

    const validation = await validateRequest(request, updateSavedReplySchema);
    if ("error" in validation) {
      return validation.error;
    }

    const updateData = validation.data;

    // Check if saved reply exists
    const [existingSavedReply] = await db
      .select()
      .from(savedRepliesTable)
      .where(eq(savedRepliesTable.id, savedReplyId))
      .limit(1);

    if (!existingSavedReply) {
      return apiError("Saved reply not found", 404);
    }

    // Update saved reply
    const [updatedSavedReply] = await db
      .update(savedRepliesTable)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(savedRepliesTable.id, savedReplyId))
      .returning();

    return apiSuccess({
      data: updatedSavedReply,
      message: "Saved reply updated successfully",
    });
  } catch (error: any) {
    console.error("Update saved reply error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to update saved reply", 500);
  }
}

async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const savedReplyId = parseInt(params.id);

    // Check if saved reply exists
    const [existingSavedReply] = await db
      .select()
      .from(savedRepliesTable)
      .where(eq(savedRepliesTable.id, savedReplyId))
      .limit(1);

    if (!existingSavedReply) {
      return apiError("Saved reply not found", 404);
    }

    // Delete saved reply
    await db
      .delete(savedRepliesTable)
      .where(eq(savedRepliesTable.id, savedReplyId));

    return apiSuccess({
      message: "Saved reply deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete saved reply error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to delete saved reply", 500);
  }
}

export const GET = createMethodHandler({ GET }).GET;
export const PUT = createMethodHandler({ PUT }).PUT;
export const DELETE = createMethodHandler({ DELETE }).DELETE;