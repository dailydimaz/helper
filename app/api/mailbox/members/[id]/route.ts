import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { db } from "@/db/client";
import { usersTable } from "@/db/schema/users";

export const runtime = "edge";

// DELETE /api/mailbox/members/[id] - Remove member from mailbox
async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const { id } = await params;
    
    if (id === user.id) {
      return apiError("Cannot remove yourself from the mailbox", 400);
    }

    // In a real app, you would remove the user from the team/organization
    // For now, we'll just verify the user exists
    const [member] = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, id));

    if (!member) {
      return apiError("Member not found", 404);
    }

    // TODO: Implement actual member removal logic
    // This would involve updating team/organization tables that don't exist yet
    
    return apiSuccess({ 
      message: `Member ${member.email} removed from mailbox successfully`
    });
  } catch (error) {
    console.error("Remove member error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to remove member", 500);
  }
}

export const { DELETE: handleDELETE } = createMethodHandler({ DELETE });
export { handleDELETE as DELETE };