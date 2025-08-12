import { NextRequest } from "next/server";
import { requireAuth, requirePermission } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import z from "zod";

const generalSettingsSchema = z.object({
  siteName: z.string().min(1, "Site name is required"),
  siteDescription: z.string().optional(),
  supportEmail: z.string().email(),
  enableRegistration: z.boolean(),
  enableGuestMode: z.boolean(),
  defaultUserRole: z.enum(["member", "admin"]),
});

async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const validation = await validateRequest(request, generalSettingsSchema);
    if ("error" in validation) {
      return validation.error;
    }

    // In production, save to database
    // For now, this is a mock implementation
    console.log("Updated general settings:", validation.data);

    return apiSuccess({
      message: "General settings updated successfully",
      data: validation.data,
    });
  } catch (error: any) {
    console.error("Update general settings error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to update general settings", 500);
  }
}

export const PUT = createMethodHandler({ PUT }).PUT;