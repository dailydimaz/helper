import { type TRPCRouterRecord } from "@trpc/server";
import { isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema/users";
import { addUser } from "@/lib/data/user";
import { protectedProcedure } from "../trpc";

export const organizationRouter = {
  getMembers: protectedProcedure.query(async () => {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        permissions: usersTable.permissions,
        access: usersTable.access,
        deletedAt: usersTable.deletedAt,
      })
      .from(usersTable)
      .where(isNull(usersTable.deletedAt));

    return users.map((user) => ({
      id: user.id,
      displayName: user.displayName || "",
      email: user.email || "",
      permissions: user.permissions,
      access: user.access || { role: "afk", keywords: [] },
    }));
  }),
  addMember: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        displayName: z.string(),
        permissions: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await addUser(ctx.user.id, input.email, input.displayName, input.permissions);
    }),
} satisfies TRPCRouterRecord;
