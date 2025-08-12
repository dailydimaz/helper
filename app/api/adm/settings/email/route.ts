import { NextRequest } from "next/server";
import { requireAuth, requirePermission } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import z from "zod";

const emailSettingsSchema = z.object({
  smtpHost: z.string().min(1, "SMTP host is required"),
  smtpPort: z.number().min(1).max(65535),
  smtpUser: z.string().min(1, "SMTP user is required"),
  smtpPassword: z.string().optional(),
  smtpSecurity: z.enum(["none", "tls", "ssl"]),
  fromEmail: z.string().email(),
  fromName: z.string().min(1, "From name is required"),
});

async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const validation = await validateRequest(request, emailSettingsSchema);
    if ("error" in validation) {
      return validation.error;
    }

    // In production, save to database and potentially test SMTP connection
    console.log("Updated email settings:", validation.data);

    return apiSuccess({
      message: "Email settings updated successfully",
      data: validation.data,
    });
  } catch (error: any) {
    console.error("Update email settings error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to update email settings", 500);
  }
}

export const PUT = createMethodHandler({ PUT }).PUT;