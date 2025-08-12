import { NextRequest } from "next/server";
import { z } from "zod";
import { subHours } from "date-fns";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateQueryParams } from "@/lib/api";
import { getMemberStats } from "@/lib/data/stats";

const memberStatsSchema = z.object({
  period: z.enum(["24h", "7d", "30d", "1y"]),
  customStartDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  customEndDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
});

// GET /api/members/stats - Get member statistics
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const queryValidation = validateQueryParams(request, memberStatsSchema);
    if ("error" in queryValidation) {
      return queryValidation.error;
    }
    
    const { period, customStartDate, customEndDate } = queryValidation.data;

    const now = new Date();
    const periodInHours = {
      "24h": 24,
      "7d": 24 * 7,
      "30d": 24 * 30,
      "1y": 24 * 365,
    } as const;

    const startDate = customStartDate || subHours(now, periodInHours[period]);
    const endDate = customEndDate || now;
    
    const stats = await getMemberStats({ startDate, endDate });
    
    return apiSuccess({ data: stats });
  } catch (error) {
    console.error("Get member stats error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to get member stats", 500);
  }
}

export const { GET: handleGET } = createMethodHandler({ GET });
export { handleGET as GET };