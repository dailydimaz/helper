import { NextRequest } from "next/server";
import { ne } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema/users";

export const runtime = "edge";

// GET /api/mailbox/members - Get mailbox members
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();

    // Get all users who have access to this mailbox
    // For now, get all active users - in a real app you'd have team/member structure
    const members = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        permissions: usersTable.permissions,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(usersTable.displayName);

    return apiSuccess({ data: members });
  } catch (error) {
    console.error("Get mailbox members error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to get mailbox members", 500);
  }
}

export const { GET: handleGET } = createMethodHandler({ GET });
export { handleGET as GET };