import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema/users";
import { createUser, createJWT } from "@/lib/auth/simpleAuth";
import { setAuthToken } from "@/lib/cookie";
import { createApiResponse, createErrorResponse } from "@/lib/api/middleware";

const onboardSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = onboardSchema.parse(body);

    // Check if mailbox already exists
    const existingMailbox = await db.query.mailboxes.findFirst({
      columns: { id: true },
    });

    if (existingMailbox) {
      return createErrorResponse(
        "A mailbox already exists. Please use the login form instead.",
        409
      );
    }

    // Create admin user with JWT auth
    const authUser = await createUser(input.email, input.password, input.displayName);
    
    if (!authUser) {
      return createErrorResponse("Failed to create user", 500);
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

    return createApiResponse({ success: true });
  } catch (error) {
    console.error("Onboard error:", error);
    
    if (error instanceof z.ZodError) {
      return createErrorResponse("Invalid input data", 400);
    }
    
    return createErrorResponse("Internal server error", 500);
  }
}