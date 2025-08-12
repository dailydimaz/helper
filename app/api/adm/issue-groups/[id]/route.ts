import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { issueGroupsTable } from "@/db/schema";
import { requireAuth, requirePermission } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { eq } from "drizzle-orm";
import z from "zod";

const updateIssueGroupSchema = z.object({
  title: z.string().min(1, "Title is required").max(255).optional(),
  description: z.string().optional(),
});

async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const issueGroupId = parseInt(params.id);

    const [issueGroup] = await db
      .select()
      .from(issueGroupsTable)
      .where(eq(issueGroupsTable.id, issueGroupId))
      .limit(1);

    if (!issueGroup) {
      return apiError("Issue group not found", 404);
    }

    return apiSuccess({ data: issueGroup });
  } catch (error: any) {
    console.error("Get issue group error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to get issue group", 500);
  }
}

async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const issueGroupId = parseInt(params.id);

    const validation = await validateRequest(request, updateIssueGroupSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const updateData = validation.data;

    // Check if issue group exists
    const [existingIssueGroup] = await db
      .select()
      .from(issueGroupsTable)
      .where(eq(issueGroupsTable.id, issueGroupId))
      .limit(1);

    if (!existingIssueGroup) {
      return apiError("Issue group not found", 404);
    }

    // Update issue group
    const [updatedIssueGroup] = await db
      .update(issueGroupsTable)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(issueGroupsTable.id, issueGroupId))
      .returning();

    return apiSuccess({
      data: updatedIssueGroup,
      message: "Issue group updated successfully",
    });
  } catch (error: any) {
    console.error("Update issue group error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to update issue group", 500);
  }
}

async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const issueGroupId = parseInt(params.id);

    // Check if issue group exists
    const [existingIssueGroup] = await db
      .select()
      .from(issueGroupsTable)
      .where(eq(issueGroupsTable.id, issueGroupId))
      .limit(1);

    if (!existingIssueGroup) {
      return apiError("Issue group not found", 404);
    }

    // Delete issue group
    await db
      .delete(issueGroupsTable)
      .where(eq(issueGroupsTable.id, issueGroupId));

    return apiSuccess({
      message: "Issue group deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete issue group error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to delete issue group", 500);
  }
}

export const GET = createMethodHandler({ GET }).GET;
export const PUT = createMethodHandler({ PUT }).PUT;
export const DELETE = createMethodHandler({ DELETE }).DELETE;