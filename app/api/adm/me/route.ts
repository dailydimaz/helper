import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";

async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return apiError("Not authenticated", 401);
    }

    // Return user data without sensitive information for admin context
    const { password: _, ...userData } = user;
    
    return apiSuccess(userData);
  } catch (error) {
    console.error("Get current admin user error:", error);
    return apiError("Failed to get user", 500);
  }
}

export const GET = createMethodHandler({ GET }).GET;