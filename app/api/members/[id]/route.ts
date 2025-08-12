import { NextRequest } from "next/server";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { banUser, getProfile, isAdmin } from "@/lib/data/user";
import { captureExceptionAndLog } from "@/lib/shared/sentry";

// DELETE /api/members/[id] - Remove team member
async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const userProfile = await getProfile(user.id);

    if (!isAdmin(userProfile)) {
      return apiError("You do not have permission to remove team members.", 403);
    }

    if (user.id === params.id) {
      return apiError("You cannot remove yourself from the team.", 400);
    }

    try {
      await banUser(params.id);
      return apiSuccess(null, "Team member removed successfully");
    } catch (error) {
      captureExceptionAndLog(error, {
        tags: { route: "members.delete" },
        extra: {
          targetUserId: params.id,
          mailboxId: mailbox.id,
        },
      });
      return apiError("Failed to remove team member.", 500);
    }
  } catch (error) {
    console.error("Delete member error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to remove team member", 500);
  }
}

export const { DELETE: handleDELETE } = createMethodHandler({ DELETE });
export { handleDELETE as DELETE };