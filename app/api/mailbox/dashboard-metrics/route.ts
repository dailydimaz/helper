import { NextRequest } from "next/server";
import { and, count, eq, gte, isNull, sql } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { db } from "@/db/client";
import { conversationsTable, conversationMessagesTable } from "@/db/schema";
import type { DashboardMetrics } from "@/lib/swr/realtime-hooks";

// GET /api/mailbox/dashboard-metrics - Get dashboard metrics
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    // Get total conversations count
    const totalConversationsResult = await db
      .select({ count: count() })
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.unused_mailboxId, mailbox.id),
          isNull(conversationsTable.mergedIntoId)
        )
      );
    
    // Get open conversations count
    const openConversationsResult = await db
      .select({ count: count() })
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.unused_mailboxId, mailbox.id),
          eq(conversationsTable.status, "open"),
          isNull(conversationsTable.mergedIntoId)
        )
      );
    
    // Get conversations resolved today
    const resolvedTodayResult = await db
      .select({ count: count() })
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.unused_mailboxId, mailbox.id),
          eq(conversationsTable.status, "closed"),
          gte(conversationsTable.closedAt, startOfDay),
          isNull(conversationsTable.mergedIntoId)
        )
      );
    
    // Calculate average response time (simplified - using message creation time difference)
    // This is a basic implementation - you may want to enhance this based on your specific needs
    const avgResponseTimeResult = await db
      .select({
        avgDiff: sql<number>`AVG(EXTRACT(EPOCH FROM (${conversationMessagesTable.createdAt} - ${conversationsTable.createdAt}))) / 3600`
      })
      .from(conversationMessagesTable)
      .innerJoin(conversationsTable, eq(conversationMessagesTable.conversationId, conversationsTable.id))
      .where(
        and(
          eq(conversationsTable.unused_mailboxId, mailbox.id),
          eq(conversationMessagesTable.role, "staff"),
          gte(conversationMessagesTable.createdAt, startOfDay)
        )
      );
    
    const metrics: DashboardMetrics = {
      totalConversations: totalConversationsResult[0]?.count || 0,
      openConversations: openConversationsResult[0]?.count || 0,
      resolvedToday: resolvedTodayResult[0]?.count || 0,
      averageResponseTime: avgResponseTimeResult[0]?.avgDiff || 0,
      satisfaction: 85, // TODO: implement satisfaction calculation based on reactions/feedback
    };

    return apiSuccess(metrics);
  } catch (error) {
    console.error("Get dashboard metrics error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to get dashboard metrics", 500);
  }
}

export const { GET: handleGET } = createMethodHandler({ GET });
export { handleGET as GET };