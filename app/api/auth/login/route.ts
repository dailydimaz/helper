import { NextRequest } from "next/server";
import { z } from "zod";
import { setAuthCookie } from "@/lib/auth";
import { apiError, createMethodHandler, validateRequest } from "@/lib/api";
import { authenticateUserSecure, createSecureSession } from "@/lib/security/authEnhanced";
import { validateCSRFWithOrigin, initializeCSRF } from "@/lib/security/csrf";
import { applyCORSHeaders, CORS_CONFIGS } from "@/lib/security/cors";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

async function POST(request: NextRequest) {
  // Validate CSRF and origin
  const csrfValidation = await validateCSRFWithOrigin(request);
  if (!csrfValidation.valid) {
    return apiError(csrfValidation.error || "CSRF validation failed", 403);
  }

  const validation = await validateRequest(request, loginSchema);
  
  if ("error" in validation) {
    return validation.error;
  }

  const { email, password } = validation.data;

  try {
    // Use enhanced authentication with security checks
    const authResult = await authenticateUserSecure(email, password, request);
    
    if (!authResult.success) {
      if (authResult.rateLimited) {
        return apiError(authResult.error || "Rate limited", 429, undefined, {
          retryAfter: authResult.retryAfter,
        });
      }
      return apiError(authResult.error || "Invalid email or password", 401);
    }

    const user = authResult.user!;
    
    // Create secure session
    const { token, sessionId } = await createSecureSession(user.id, request);
    const response = setAuthCookie(token);
    
    // Initialize CSRF protection
    await initializeCSRF(request, response, sessionId, user.id);
    
    // Return user data without sensitive information
    const { password: _, ...userData } = user;
    
    // Apply CORS headers
    const corsResponse = applyCORSHeaders(request, response, CORS_CONFIGS.AUTH);
    
    // Modify the response to include user data and success message
    const responseBody = await corsResponse.json();
    return new Response(JSON.stringify({
      ...responseBody,
      data: userData,
      message: "Login successful"
    }), {
      status: 200,
      headers: corsResponse.headers,
    });
  } catch (error) {
    console.error("Login error:", error);
    return apiError("Login failed", 500);
  }
}

export const { POST: handler } = createMethodHandler({ POST });