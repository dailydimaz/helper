import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { usersTable, conversationsTable, savedRepliesTable, issueGroupsTable } from "@/db/schema";
import { requireAuth, requirePermission } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { count, eq } from "drizzle-orm";

async function getStats(request: NextRequest) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    // Get user statistics
    const [totalUsersResult] = await db
      .select({ count: count() })
      .from(usersTable);

    // Get conversation statistics
    const [totalConversationsResult] = await db
      .select({ count: count() })
      .from(conversationsTable);

    const [openConversationsResult] = await db
      .select({ count: count() })
      .from(conversationsTable)
      .where(eq(conversationsTable.status, "open"));

    const [closedConversationsResult] = await db
      .select({ count: count() })
      .from(conversationsTable)
      .where(eq(conversationsTable.status, "closed"));

    // Get saved replies statistics
    const [savedRepliesResult] = await db
      .select({ count: count() })
      .from(savedRepliesTable);

    // Get issue groups statistics
    const [issueGroupsResult] = await db
      .select({ count: count() })
      .from(issueGroupsTable);

    const stats = {
      totalUsers: totalUsersResult.count,
      totalConversations: totalConversationsResult.count,
      openConversations: openConversationsResult.count,
      closedConversations: closedConversationsResult.count,
      savedReplies: savedRepliesResult.count,
      issueGroups: issueGroupsResult.count,
    };

    return apiSuccess({ data: stats });
  } catch (error: any) {
    console.error("Get admin stats error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to get admin stats", 500);
  }
}

const handlers = createMethodHandler({ GET: getStats });
export const GET = handlers.GET;