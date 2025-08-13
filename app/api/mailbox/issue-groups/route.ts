import { NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { issueGroupsTable, conversationsTable } from "@/db/schema";

const createIssueGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
});

const updateIssueGroupSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
});

const assignConversationSchema = z.object({
  conversationSlug: z.string().min(1),
  issueGroupId: z.number().int().positive(),
});

// GET /api/mailbox/issue-groups - List all issue groups
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();

    const issueGroups = await db
      .select({
        id: issueGroupsTable.id,
        name: issueGroupsTable.name,
        description: issueGroupsTable.description,
        color: issueGroupsTable.color,
        createdAt: issueGroupsTable.createdAt,
        updatedAt: issueGroupsTable.updatedAt,
        // Count conversations assigned to this issue group
        conversationCount: count(conversationsTable.id),
      })
      .from(issueGroupsTable)
      .leftJoin(
        conversationsTable,
        and(
          eq(conversationsTable.issueGroupId, issueGroupsTable.id),
          isNull(conversationsTable.mergedIntoId)
        )
      )
      .where(eq(issueGroupsTable.mailboxId, mailbox.id))
      .groupBy(
        issueGroupsTable.id,
        issueGroupsTable.name,
        issueGroupsTable.description,
        issueGroupsTable.color,
        issueGroupsTable.createdAt,
        issueGroupsTable.updatedAt
      )
      .orderBy(desc(issueGroupsTable.createdAt));

    return apiSuccess({ data: issueGroups });
  } catch (error) {
    console.error("List issue groups error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to list issue groups", 500);
  }
}

// POST /api/mailbox/issue-groups - Create new issue group
async function POST(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const validation = await validateRequest(request, createIssueGroupSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { name, description, color } = validation.data;

    const [issueGroup] = await db
      .insert(issueGroupsTable)
      .values({
        mailboxId: mailbox.id,
        name,
        description,
        color: color || "#6366f1", // Default color
        createdByUserId: user.id,
      })
      .returning();

    return apiSuccess({ data: issueGroup });
  } catch (error) {
    console.error("Create issue group error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to create issue group", 500);
  }
}

export const { GET: handleGET, POST: handlePOST } = createMethodHandler({ GET, POST });
export { handleGET as GET, handlePOST as POST };