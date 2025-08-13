import { NextRequest } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { getLogin } from "@/lib/cookie";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema/users";

export const runtime = "edge";

// GET /api/organization/members - Get organization members
async function GET(request: NextRequest) {
  try {
    const user = await getLogin();
    if (!user) {
      return apiError("Authentication required", 401);
    }

    // Get all users in the organization
    // For now, get all active users - in a real app you'd have organization/team structure
    const members = await db
      .select()
      .from(usersTable)
      .where(ne(usersTable.id, user.id)) // Exclude current user
      .orderBy(usersTable.displayName);

    // Transform the results to match the expected format
    const formattedMembers = members.map(member => ({
      id: member.id,
      email: member.email,
      displayName: member.displayName,
      permissions: member.permissions,
      createdAt: member.createdAt,
    }));

    return apiSuccess({ data: formattedMembers });
  } catch (error) {
    console.error("Get organization members error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
    }
    return apiError("Failed to get organization members", 500);
  }
}

export const { GET: handleGET } = createMethodHandler({ GET });
export { handleGET as GET };