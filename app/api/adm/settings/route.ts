import { NextRequest } from "next/server";
import { requireAuth, requirePermission } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";

// Mock settings storage - In production, this should be stored in database
let mockSettings = {
  general: {
    siteName: "Helper AI",
    siteDescription: "AI-powered customer support",
    supportEmail: "support@example.com",
    enableRegistration: true,
    enableGuestMode: false,
    defaultUserRole: "member",
  },
  email: {
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    smtpSecurity: "tls",
    fromEmail: "",
    fromName: "Helper AI Support",
  },
  ai: {
    openaiApiKey: "",
    defaultModel: "gpt-4",
    maxTokens: 1000,
    temperature: 0.7,
    enableAutoResponse: false,
    autoResponseDelay: 5,
  },
};

async function getSettings(request: NextRequest) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    // In production, fetch from database
    return apiSuccess({ data: mockSettings });
  } catch (error: any) {
    console.error("Get settings error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to get settings", 500);
  }
}

const handlers = createMethodHandler({ GET: getSettings });
export const GET = handlers.GET;