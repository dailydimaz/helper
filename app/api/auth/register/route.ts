import { NextRequest } from "next/server";
import { z } from "zod";
import { createUser, createSession, setAuthCookie } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().optional(),
});

async function POST(request: NextRequest) {
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
    const token = await createSession(user.id, request);
    const response = setAuthCookie(token);
    
    // Return user data without sensitive information
    const { password: _, ...userData } = user;
    
    // Modify the response to include user data and success message
    const responseBody = await response.json();
    return new Response(JSON.stringify({
      ...responseBody,
      data: userData,
      message: "Registration successful"
    }), {
      status: 200,
      headers: response.headers,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return apiError("Registration failed", 500);
  }
}

export const { POST: handler } = createMethodHandler({ POST });