import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { issueGroupsTable } from "@/db/schema";

const updateIssueGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
});

// GET /api/mailbox/issue-groups/[id] - Get issue group by ID
async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const { id } = await params;
    const issueGroupId = parseInt(id);
    
    if (isNaN(issueGroupId)) {
      return apiError("Invalid issue group ID", 400);
    }

    const [issueGroup] = await db
      .select()
      .from(issueGroupsTable)
      .where(and(
        eq(issueGroupsTable.id, issueGroupId),
        eq(issueGroupsTable.mailboxId, mailbox.id)
      ));

    if (!issueGroup) {
      return apiError("Issue group not found", 404);
    }

    return apiSuccess({ data: issueGroup });
  } catch (error) {
    console.error("Get issue group error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to get issue group", 500);
  }
}

// PUT /api/mailbox/issue-groups/[id] - Update issue group
async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const { id } = await params;
    const issueGroupId = parseInt(id);
    
    if (isNaN(issueGroupId)) {
      return apiError("Invalid issue group ID", 400);
    }

    const validation = await validateRequest(request, updateIssueGroupSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const updateData = validation.data;

    const [updatedIssueGroup] = await db
      .update(issueGroupsTable)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(and(
        eq(issueGroupsTable.id, issueGroupId),
        eq(issueGroupsTable.mailboxId, mailbox.id)
      ))
      .returning();

    if (!updatedIssueGroup) {
      return apiError("Issue group not found", 404);
    }

    return apiSuccess({ data: updatedIssueGroup });
  } catch (error) {
    console.error("Update issue group error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to update issue group", 500);
  }
}

// DELETE /api/mailbox/issue-groups/[id] - Delete issue group
async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const { id } = await params;
    const issueGroupId = parseInt(id);
    
    if (isNaN(issueGroupId)) {
      return apiError("Invalid issue group ID", 400);
    }

    const [deletedIssueGroup] = await db
      .delete(issueGroupsTable)
      .where(and(
        eq(issueGroupsTable.id, issueGroupId),
        eq(issueGroupsTable.mailboxId, mailbox.id)
      ))
      .returning();

    if (!deletedIssueGroup) {
      return apiError("Issue group not found", 404);
    }

    return apiSuccess({ message: "Issue group deleted successfully" });
  } catch (error) {
    console.error("Delete issue group error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to delete issue group", 500);
  }
}

export const { GET: handleGET, PUT: handlePUT, DELETE: handleDELETE } = createMethodHandler({ GET, PUT, DELETE });
export { handleGET as GET, handlePUT as PUT, handleDELETE as DELETE };