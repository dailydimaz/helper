import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { savedRepliesTable } from "@/db/schema";
import { requireAuth, requirePermission } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler, validateRequest, parsePagination } from "@/lib/api";
import { createSavedReplySchema } from "@/lib/validation/schema";
import { count, desc, ilike, eq } from "drizzle-orm";
import slugify from "slugify";
import z from "zod";

async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const url = new URL(request.url);
    const { page, perPage, offset } = parsePagination(request);
    const search = url.searchParams.get("q") || "";
    const countOnly = url.searchParams.get("countOnly") === "true";

    // Build where clause for search
    const whereClause = search
      ? ilike(savedRepliesTable.name, `%${search}%`)
      : undefined;

    if (countOnly) {
      const [totalResult] = await db
        .select({ count: count() })
        .from(savedRepliesTable)
        .where(whereClause);

      return apiSuccess({ total: totalResult.count });
    }

    // Get saved replies with pagination
    const savedReplies = await db.query.savedRepliesTable.findMany({
      where: whereClause,
      orderBy: desc(savedRepliesTable.createdAt),
      limit: perPage,
      offset: offset,
    });

    return apiSuccess({ data: savedReplies });
  } catch (error: any) {
    console.error("Get saved replies error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to get saved replies", 500);
  }
}

async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const validation = await validateRequest(request, createSavedReplySchema.extend({
      isActive: z.boolean().default(true),
    }));
    if ("error" in validation) {
      return validation.error;
    }

    const { name, content, isActive } = validation.data;

    // Generate slug from name
    const baseSlug = slugify(name, { lower: true });
    let slug = baseSlug;
    let counter = 1;

    // Ensure slug is unique
    while (true) {
      const [existing] = await db
        .select()
        .from(savedRepliesTable)
        .where(eq(savedRepliesTable.slug, slug))
        .limit(1);

      if (!existing) break;
      
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const [newSavedReply] = await db
      .insert(savedRepliesTable)
      .values({
        name,
        slug,
        content,
        isActive: isActive ?? true,
      })
      .returning();

    return apiSuccess({
      data: newSavedReply,
      message: "Saved reply created successfully",
    });
  } catch (error: any) {
    console.error("Create saved reply error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to create saved reply", 500);
  }
}

export const GET = createMethodHandler({ GET }).GET;
export const POST = createMethodHandler({ POST }).POST;