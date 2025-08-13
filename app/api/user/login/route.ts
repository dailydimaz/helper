import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateUser, createJWT } from "@/lib/auth/simpleAuth";
import { setAuthToken } from "@/lib/cookie";
import { createApiResponse, createErrorResponse } from "@/lib/api/middleware";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);

    const authUser = await authenticateUser(input.email, input.password);
    
    if (!authUser) {
      return createErrorResponse("Invalid email or password", 401);
    }

    const token = await createJWT(authUser);
    await setAuthToken(token);
    
    return createApiResponse({ success: true, user: authUser });
  } catch (error) {
    console.error("Login error:", error);
    
    if (error instanceof z.ZodError) {
      return createErrorResponse("Invalid input data", 400);
    }
    
    return createErrorResponse("Internal server error", 500);
  }
}