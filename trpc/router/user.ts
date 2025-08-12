import { TRPCError, TRPCRouterRecord } from "@trpc/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Resend } from "resend";
import { z } from "zod";
import { assertDefined } from "@/components/utils/assert";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema/users";
import { userProfilesTable } from "@/db/schema/userProfiles";
import { authenticateUser, createUser, createJWT } from "@/lib/auth/authService";
import { setAuthToken } from "@/lib/cookie";
import { cacheFor } from "@/lib/cache";
import OtpEmail from "@/lib/emails/otp";
import { env } from "@/lib/env";
import { captureExceptionAndLog } from "@/lib/shared/sentry";
import { protectedProcedure, publicProcedure } from "../trpc";

export const userRouter = {
  // TODO: Implement proper OTP-based authentication
  // For now, using basic email/password login
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const authUser = await authenticateUser(input.email, input.password);
      
      if (!authUser) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      const token = await createJWT(authUser);
      await setAuthToken(token);
      
      return { success: true, user: authUser };
    }),

  startSignIn: publicProcedure.input(z.object({ email: z.string() })).mutation(async ({ input }) => {
    // TODO: Implement OTP-based sign in - for now return error to force use of login endpoint
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "OTP sign-in not implemented yet. Use login with password instead.",
    });
  }),
  createUser: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        displayName: z.string().min(1),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ input }) => {
      if (!isSignupPossible(input.email)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Signup is not possible for this email domain",
        });
      }

      const authUser = await createUser(input.email, input.password, input.displayName);
      
      if (!authUser) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user",
        });
      }

      return { success: true };
    }),
  onboard: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        displayName: z.string().min(1),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existingMailbox = await db.query.mailboxes.findFirst({
        columns: { id: true },
      });

      if (existingMailbox) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A mailbox already exists. Please use the login form instead.",
        });
      }

      // Create admin user with JWT auth
      const authUser = await createUser(input.email, input.password, input.displayName);
      
      if (!authUser) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create user",
        });
      }

      // Update user to admin permissions
      await db
        .update(usersTable)
        .set({ permissions: "admin" })
        .where(eq(usersTable.id, authUser.id));

      // TODO: Setup mailbox for new user
      // await setupMailboxForNewUser(authUser);
      
      // Auto-login the new admin user
      const token = await createJWT({
        ...authUser,
        permissions: "admin",
      });
      await setAuthToken(token);

      return { success: true };
    }),

  currentUser: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const userId = ctx.user.id;

    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        permissions: usersTable.permissions,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    return user;
  }),
} satisfies TRPCRouterRecord;

const isSignupPossible = (email: string) => {
  const [_, emailDomain] = email.split("@");
  if (emailDomain && env.EMAIL_SIGNUP_DOMAINS.some((domain) => domain === emailDomain)) {
    return true;
  }
  return false;
};
