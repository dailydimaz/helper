import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateUser, createSession, setAuthCookie } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

async function POST(request: NextRequest) {
  const validation = await validateRequest(request, loginSchema);
  
  if ("error" in validation) {
    return validation.error;
  }

  const { email, password } = validation.data;

  try {
    const user = await authenticateUser(email, password);
    
    if (!user) {
      return apiError("Invalid email or password", 401);
    }

    const token = await createSession(user.id, request);
    const response = setAuthCookie(token);
    
    // Return user data without sensitive information
    const { password: _, ...userData } = user;
    
    return apiSuccess(userData, "Login successful");
  } catch (error) {
    console.error("Login error:", error);
    return apiError("Login failed", 500);
  }
}

export const { POST: handler } = createMethodHandler({ POST });