import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { db } from "@/db/client";
import { websitesTable } from "@/db/schema/websites";

// DELETE /api/mailbox/websites/[id] - Delete website
async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const { id } = await params;
    const websiteId = parseInt(id);
    
    if (isNaN(websiteId)) {
      return apiError("Invalid website ID", 400);
    }

    const [deletedWebsite] = await db
      .delete(websitesTable)
      .where(and(
        eq(websitesTable.id, websiteId),
        eq(websitesTable.unused_mailboxId, mailbox.id)
      ))
      .returning();

    if (!deletedWebsite) {
      return apiError("Website not found", 404);
    }

    return apiSuccess({ message: "Website deleted successfully" });
  } catch (error) {
    console.error("Delete website error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to delete website", 500);
  }
}

export const { DELETE: handleDELETE } = createMethodHandler({ DELETE });
export { handleDELETE as DELETE };