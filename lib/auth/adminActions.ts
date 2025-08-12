import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema/users";
import { hashPassword } from "./authService";

/**
 * Admin functions to replace Supabase admin client functionality
 * These functions perform direct database operations for user management
 */

export const createUserAdmin = async (params: {
  email: string;
  displayName: string;
  permissions?: string;
  inviterUserId?: string;
}) => {
  const { email, displayName, permissions = "member", inviterUserId } = params;

  // Generate a temporary password that the user will need to reset
  const tempPassword = Math.random().toString(36).slice(-12);
  const hashedPassword = await hashPassword(tempPassword);

  const [newUser] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase(),
      password: hashedPassword,
      displayName,
      permissions,
      isActive: true,
      access: { role: "afk", keywords: [] },
      // Store metadata about invitation
      metadata: {
        inviterUserId,
        needsPasswordReset: true,
        tempPassword, // In real implementation, send this via email instead
      },
    })
    .returning();

  return { user: newUser, tempPassword };
};

export const deleteUserAdmin = async (userId: string) => {
  // Soft delete by setting deletedAt timestamp
  await db
    .update(usersTable)
    .set({
      deletedAt: new Date(),
      isActive: false,
    })
    .where(eq(usersTable.id, userId));
};

export const updateUserAdmin = async (
  userId: string,
  updates: {
    email?: string;
    displayName?: string;
    permissions?: string;
    isActive?: boolean;
  }
) => {
  const [updatedUser] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, userId))
    .returning();

  return updatedUser;
};