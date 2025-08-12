import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { issueGroupsTable } from "@/db/schema";
import { requireAuth, requirePermission } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler, validateRequest, parsePagination } from "@/lib/api";
import { count, desc, ilike } from "drizzle-orm";
import z from "zod";

const createIssueGroupSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
});

async function getIssueGroups(request: NextRequest) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const url = new URL(request.url);
    const { page, perPage, offset } = parsePagination(request);
    const search = url.searchParams.get("q") || "";
    const countOnly = url.searchParams.get("countOnly") === "true";

    // Build where clause for search
    const whereClause = search
      ? ilike(issueGroupsTable.title, `%${search}%`)
      : undefined;

    if (countOnly) {
      const [totalResult] = await db
        .select({ count: count() })
        .from(issueGroupsTable)
        .where(whereClause);

      return apiSuccess({ total: totalResult.count });
    }

    // Get issue groups with pagination
    const issueGroups = await db.query.issueGroupsTable.findMany({
      where: whereClause,
      orderBy: desc(issueGroupsTable.createdAt),
      limit: perPage,
      offset: offset,
    });

    return apiSuccess({ data: issueGroups });
  } catch (error: any) {
    console.error("Get issue groups error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to get issue groups", 500);
  }
}

async function createIssueGroup(request: NextRequest) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const validation = await validateRequest(request, createIssueGroupSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { title, description } = validation.data;

    const [newIssueGroup] = await db
      .insert(issueGroupsTable)
      .values({
        title,
        description,
      })
      .returning();

    return apiSuccess({
      data: newIssueGroup,
      message: "Issue group created successfully",
    });
  } catch (error: any) {
    console.error("Create issue group error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to create issue group", 500);
  }
}

const handlers = createMethodHandler({ GET: getIssueGroups, POST: createIssueGroup });
export const GET = handlers.GET;
export const POST = handlers.POST;