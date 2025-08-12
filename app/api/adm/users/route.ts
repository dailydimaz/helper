import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema";
import { requireAuth, requirePermission, hashPassword } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler, validateRequest, parsePagination } from "@/lib/api";
import { createUserSchema } from "@/lib/validation/schema";
import { count, desc, ilike, or, eq } from "drizzle-orm";

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
      ? or(
          ilike(usersTable.email, `%${search}%`),
          ilike(usersTable.displayName, `%${search}%`)
        )
      : undefined;

    if (countOnly) {
      const [totalResult] = await db
        .select({ count: count() })
        .from(usersTable)
        .where(whereClause);

      return apiSuccess({ total: totalResult.count });
    }

    // Get users with pagination
    const users = await db.query.usersTable.findMany({
      where: whereClause,
      orderBy: desc(usersTable.createdAt),
      limit: perPage,
      offset: offset,
      columns: {
        password: false, // Exclude password from response
      },
    });

    return apiSuccess({ data: users });
  } catch (error: any) {
    console.error("Get users error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to get users", 500);
  }
}

async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const validation = await validateRequest(request, createUserSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { email, password, displayName, permissions } = validation.data;

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existingUser) {
      return apiError("User with this email already exists", 400);
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    
    const [newUser] = await db
      .insert(usersTable)
      .values({
        email,
        password: hashedPassword,
        displayName: displayName || "",
        permissions: permissions || "member",
      })
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        permissions: usersTable.permissions,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      });

    return apiSuccess({
      data: newUser,
      message: "User created successfully",
    });
  } catch (error: any) {
    console.error("Create user error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to create user", 500);
  }
}

export const GET = createMethodHandler({ GET }).GET;
export const POST = createMethodHandler({ POST }).POST;