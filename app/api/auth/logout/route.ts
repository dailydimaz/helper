import { NextRequest } from "next/server";
import { clearAuthCookie, getCurrentUser } from "@/lib/auth";
import { apiSuccess, createMethodHandler } from "@/lib/api";
import { db } from "@/db/client";
import { userSessionsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (user) {
      // Invalidate all user sessions
      await db
        .delete(userSessionsTable)
        .where(eq(userSessionsTable.userId, user.id));
    }

    const response = clearAuthCookie();
    
    // Modify the response to include success message
    const responseBody = await response.json();
    return new Response(JSON.stringify({
      ...responseBody,
      message: "Logout successful"
    }), {
      status: 200,
      headers: response.headers,
    });
  } catch (error) {
    console.error("Logout error:", error);
    // Even if there's an error, still clear the cookie
    const response = clearAuthCookie();
    const responseBody = await response.json();
    return new Response(JSON.stringify({
      ...responseBody,
      message: "Logout successful"
    }), {
      status: 200,
      headers: response.headers,
    });
  }
}

export const { POST: handler } = createMethodHandler({ POST });