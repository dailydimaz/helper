import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { conversationsTable, usersTable } from "@/db/schema";
import { requireAuth, requirePermission } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler, parsePagination } from "@/lib/api";
import { count, desc, ilike, eq, and } from "drizzle-orm";

async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const url = new URL(request.url);
    const { page, perPage, offset } = parsePagination(request);
    const search = url.searchParams.get("q") || "";
    const status = url.searchParams.get("status");
    const countOnly = url.searchParams.get("countOnly") === "true";

    // Build where clauses
    const whereClauses = [];
    
    if (search) {
      whereClauses.push(
        ilike(conversationsTable.subject, `%${search}%`)
      );
    }
    
    if (status && status !== "all") {
      whereClauses.push(eq(conversationsTable.status, status as any));
    }

    const whereClause = whereClauses.length > 0 
      ? and(...whereClauses)
      : undefined;

    if (countOnly) {
      const [totalResult] = await db
        .select({ count: count() })
        .from(conversationsTable)
        .where(whereClause);

      return apiSuccess({ total: totalResult.count });
    }

    // Get conversations with assigned user info
    const conversations = await db
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
      .where(whereClause)
      .orderBy(desc(conversationsTable.updatedAt))
      .limit(perPage)
      .offset(offset);

    return apiSuccess({ data: conversations });
  } catch (error: any) {
    console.error("Get conversations error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to get conversations", 500);
  }
}

export const GET = createMethodHandler({ GET }).GET;