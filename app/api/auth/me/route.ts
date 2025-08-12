import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";

async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return apiError("Not authenticated", 401);
    }

    // Return user data without sensitive information
    const { password: _, ...userData } = user;
    
    return apiSuccess(userData);
  } catch (error) {
    console.error("Get current user error:", error);
    return apiError("Failed to get user", 500);
  }
}

export const { GET: handler } = createMethodHandler({ GET });