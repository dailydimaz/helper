import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema";
import { requireAuth, requirePermission } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { updateUserSchema } from "@/lib/validation/schema";
import { eq } from "drizzle-orm";

async function getUser(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const [targetUser] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        permissions: usersTable.permissions,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      })
      .from(usersTable)
      .where(eq(usersTable.id, params.id))
      .limit(1);

    if (!targetUser) {
      return apiError("User not found", 404);
    }

    return apiSuccess({ data: targetUser });
  } catch (error: any) {
    console.error("Get user error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to get user", 500);
  }
}

async function updateUser(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const validation = await validateRequest(request, updateUserSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const updateData = validation.data;

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.id))
      .limit(1);

    if (!existingUser) {
      return apiError("User not found", 404);
    }

    // If email is being updated, check for conflicts
    if (updateData.email && updateData.email !== existingUser.email) {
      const [emailConflict] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, updateData.email))
        .limit(1);

      if (emailConflict) {
        return apiError("User with this email already exists", 400);
      }
    }

    // Update user
    const [updatedUser] = await db
      .update(usersTable)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, params.id))
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
      data: updatedUser,
      message: "User updated successfully",
    });
  } catch (error: any) {
    console.error("Update user error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to update user", 500);
  }
}

async function deleteUser(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    // Prevent self-deletion
    if (user.id === params.id) {
      return apiError("Cannot delete your own account", 400);
    }

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.id))
      .limit(1);

    if (!existingUser) {
      return apiError("User not found", 404);
    }

    // Soft delete by setting deletedAt
    await db
      .update(usersTable)
      .set({
        deletedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, params.id));

    return apiSuccess({
      message: "User deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete user error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to delete user", 500);
  }
}

const handlers = createMethodHandler({ GET: getUser, PUT: updateUser, DELETE: deleteUser });
export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;