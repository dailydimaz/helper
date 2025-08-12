import { eq, isNull } from "drizzle-orm";
import { cache } from "react";
import { takeUniqueOrThrow } from "@/components/utils/arrays";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema/users";
import { BasicUserProfile, userProfilesTable } from "@/db/schema/userProfiles";
import { createUserAdmin } from "@/lib/auth/adminActions";
import { getFirstName, getFullName } from "../auth/authUtils";
import { getSlackUser } from "../slack/client";

export const UserRoles = {
  CORE: "core",
  NON_CORE: "nonCore",
  AFK: "afk",
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];

type MailboxAccess = {
  role: UserRole;
  keywords: string[];
  updatedAt: string;
};

export type UserWithMailboxAccessData = {
  id: string;
  displayName: string;
  email: string | undefined;
  role: UserRole;
  keywords: MailboxAccess["keywords"];
  permissions: string;
};

export const getProfile = cache(
  async (userId: string) => await db.query.userProfilesTable.findFirst({ where: eq(userProfilesTable.id, userId) }),
);

export const getBasicProfileById = cache(async (userId: string) => {
  const [user] = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user ?? null;
});

export const getBasicProfileByEmail = cache(async (email: string) => {
  const [user] = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.email, email));
  return user ?? null;
});

export const isAdmin = (profile?: typeof usersTable.$inferSelect) => profile?.permissions === "admin";

export const addUser = async (
  inviterUserId: string,
  emailAddress: string,
  displayName: string,
  permission?: string,
) => {
  const result = await createUserAdmin({
    email: emailAddress,
    displayName,
    permissions: permission ?? "member",
    inviterUserId,
  });
  
  // TODO: Send email with temporary password to user
  // For now, return the temp password for manual distribution
  return result;
};

export const banUser = async (userId: string) => {
  await db
    .update(usersTable)
    .set({
      deletedAt: new Date(),
      isActive: false,
    })
    .where(eq(usersTable.id, userId));
};

export const getUsersWithMailboxAccess = async (): Promise<UserWithMailboxAccessData[]> => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      displayName: usersTable.displayName,
      permissions: usersTable.permissions,
      access: usersTable.access,
    })
    .from(usersTable)
    .where(isNull(usersTable.deletedAt));

  return users.map((user) => {
    const access = user.access ?? { role: "afk", keywords: [] };
    const permissions = user.permissions ?? "member";

    return {
      id: user.id,
      displayName: user.displayName ?? "",
      email: user.email ?? undefined,
      role: access.role,
      keywords: access?.keywords ?? [],
      permissions,
    };
  });
};

export const updateUserMailboxData = async (
  userId: string,
  updates: {
    displayName?: string;
    role?: UserRole;
    keywords?: MailboxAccess["keywords"];
    permissions?: string;
  },
): Promise<UserWithMailboxAccessData> => {
  await db
    .update(usersTable)
    .set({
      displayName: updates.displayName,
      access: {
        role: updates.role || "afk",
        keywords: updates.keywords || [],
      },
      permissions: updates.permissions,
    })
    .where(eq(usersTable.id, userId));

  const updatedProfile = await db
    .select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      access: usersTable.access,
      permissions: usersTable.permissions,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
      email: usersTable.email,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .then(takeUniqueOrThrow);

  return {
    id: updatedProfile?.id ?? userId,
    displayName: getFullName(updatedProfile),
    email: updatedProfile?.email ?? undefined,
    role: updatedProfile?.access?.role || "afk",
    keywords: updatedProfile?.access?.keywords || [],
    permissions: updatedProfile?.permissions ?? "",
  };
};

export const findUserViaSlack = cache(async (token: string, slackUserId: string): Promise<BasicUserProfile | null> => {
  const slackUser = await getSlackUser(token, slackUserId);
  const user = await getBasicProfileByEmail(slackUser?.profile?.email ?? "");
  return user ?? null;
});

export const getStaffName = async (userId: string | null) => {
  if (!userId) return null;
  const user = await getBasicProfileById(userId);
  return user ? getFirstName(user) : null;
};
