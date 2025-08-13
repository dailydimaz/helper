import { NextRequest } from "next/server";
import { z } from "zod";
import { createUser, createSession, setAuthCookie } from "@/lib/auth";
import { apiError, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/security/rateLimiting";
import { validateCSRFWithOrigin, initializeCSRF } from "@/lib/security/csrf";
import { applyCORSHeaders, CORS_CONFIGS } from "@/lib/security/cors";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().optional(),
});

async function POST(request: NextRequest) {
  // Check rate limiting for registration attempts
  const rateLimitResult = rateLimit(request, 'REGISTER');
  if (!rateLimitResult.allowed) {
    return apiError(
      rateLimitResult.blocked 
        ? "Too many registration attempts. Please try again later." 
        : "Registration rate limit exceeded.", 
      429, 
      undefined, 
      {
        retryAfter: rateLimitResult.retryAfter,
        resetTime: rateLimitResult.resetTime,
      }
    );
  }

  // Validate CSRF and origin
  const csrfValidation = await validateCSRFWithOrigin(request);
  if (!csrfValidation.valid) {
    return apiError(csrfValidation.error || "CSRF validation failed", 403);
  }

  const validation = await validateRequest(request, registerSchema);
  
  if ("error" in validation) {
    return validation.error;
  }

  const { email, password, displayName } = validation.data;

  try {
    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existingUser) {
      return apiError("User with this email already exists", 400);
    }

    const user = await createUser(email, password, displayName);
    if (!user) {
      return apiError("Failed to create user", 500);
    }
    
    const token = await createSession(user.id, request);
    const response = setAuthCookie(token);
    
    // Initialize CSRF protection
    await initializeCSRF(request, response, token, user.id);
    
    // Return user data without sensitive information
    const { password: _, ...userData } = user;
    
    // Apply CORS headers
    const corsResponse = applyCORSHeaders(request, response, CORS_CONFIGS.AUTH);
    
    // Modify the response to include user data and success message
    const responseBody = await corsResponse.json();
    return new Response(JSON.stringify({
      ...responseBody,
      data: userData,
      message: "Registration successful"
    }), {
      status: 200,
      headers: corsResponse.headers,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return apiError("Registration failed", 500);
  }
}

export { POST };