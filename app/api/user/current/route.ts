import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema/users";
import { withAuth, createApiResponse, createErrorResponse, AuthenticatedRequest } from "@/lib/api/middleware";

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    if (!req.user) {
      return createErrorResponse("User not authenticated", 401);
    }

    const userId = req.user.id;

    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        permissions: usersTable.permissions,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      return createErrorResponse("User not found", 404);
    }

    return createApiResponse(user);
  } catch (error) {
    console.error("Current user error:", error);
    return createErrorResponse("Internal server error", 500);
  }
});