import { NextRequest } from "next/server";
import { requireAuth, requirePermission } from "@/lib/auth";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import z from "zod";

const aiSettingsSchema = z.object({
  openaiApiKey: z.string().optional(),
  defaultModel: z.string().min(1, "Default model is required"),
  maxTokens: z.number().min(100).max(4000),
  temperature: z.number().min(0).max(2),
  enableAutoResponse: z.boolean(),
  autoResponseDelay: z.number().min(0),
});

async function updateAISettings(request: NextRequest) {
  try {
    const user = await requireAuth();
    requirePermission(user, "admin");

    const validation = await validateRequest(request, aiSettingsSchema);
    if ("error" in validation) {
      return validation.error;
    }

    // In production, save to database
    console.log("Updated AI settings:", validation.data);

    return apiSuccess({
      message: "AI settings updated successfully",
      data: validation.data,
    });
  } catch (error: any) {
    console.error("Update AI settings error:", error);
    
    if (error.message === "Authentication required") {
      return apiError("Authentication required", 401);
    }
    if (error.message === "Insufficient permissions") {
      return apiError("Insufficient permissions", 403);
    }
    
    return apiError("Failed to update AI settings", 500);
  }
}

const handlers = createMethodHandler({ PUT: updateAISettings });
export const PUT = handlers.PUT;