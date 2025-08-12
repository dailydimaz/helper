import { NextRequest } from "next/server";
import { z } from "zod";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { getMemberStats } from "@/lib/data/stats";
import { banUser, getProfile, getUsersWithMailboxAccess, isAdmin, updateUserMailboxData } from "@/lib/data/user";
import { subHours } from "date-fns";
import { captureExceptionAndLog } from "@/lib/shared/sentry";

const updateMemberSchema = z.object({
  userId: z.string(),
  displayName: z.string().optional(),
  role: z.enum(["core", "nonCore", "afk"]).optional(),
  keywords: z.array(z.string()).optional(),
  permissions: z.string().optional(),
});

const memberStatsSchema = z.object({
  period: z.enum(["24h", "7d", "30d", "1y"]),
  customStartDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  customEndDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
});

// GET /api/members - List team members
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const members = await getUsersWithMailboxAccess();
    const userProfile = await getProfile(user.id);
    
    return apiSuccess({
      data: {
        members,
        isAdmin: isAdmin(userProfile),
      }
    });
  } catch (error) {
    console.error("Get members error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to get team members", 500);
  }
}

// PUT /api/members - Update team member
async function PUT(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const validation = await validateRequest(request, updateMemberSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { userId, displayName, role, keywords, permissions } = validation.data;
    
    const userProfile = await getProfile(user.id);
    if (!userProfile) {
      return apiError("User profile not found", 404);
    }
    
    const isCurrentUserAdmin = isAdmin(userProfile);

    if (!isCurrentUserAdmin && user.id !== userId) {
      return apiError("You can only update your own display name.", 403);
    }

    const updatePayload: Record<string, any> = {};

    if (isCurrentUserAdmin) {
      updatePayload.displayName = displayName;
      updatePayload.role = role;
      updatePayload.keywords = keywords;
      updatePayload.permissions = permissions;
    } else {
      updatePayload.displayName = displayName;
    }

    try {
      const updatedUser = await updateUserMailboxData(userId, updatePayload);
      return apiSuccess({ data: updatedUser }, "Team member updated successfully");
    } catch (error) {
      captureExceptionAndLog(error, {
        extra: {
          userId,
          displayName,
          keywords,
          role,
          permissions,
        },
      });
      return apiError("Failed to update team member", 500);
    }
  } catch (error) {
    console.error("Update member error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to update team member", 500);
  }
}

export const { GET: handleGET, PUT: handlePUT } = createMethodHandler({ GET, PUT });
export { handleGET as GET, handlePUT as PUT };