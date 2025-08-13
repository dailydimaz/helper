import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { db } from "@/db/client";
import { notesTable } from "@/db/schema/notes";

// DELETE /api/mailbox/conversations/notes/[id] - Delete note
async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const { id } = await params;
    const noteId = parseInt(id);
    
    if (isNaN(noteId)) {
      return apiError("Invalid note ID", 400);
    }

    const [deletedNote] = await db
      .delete(notesTable)
      .where(and(
        eq(notesTable.id, noteId),
        eq(notesTable.createdByUserId, user.id) // Only allow deleting own notes
      ))
      .returning();

    if (!deletedNote) {
      return apiError("Note not found or you don't have permission to delete it", 404);
    }

    return apiSuccess({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("Delete note error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to delete note", 500);
  }
}

export const { DELETE: handleDELETE } = createMethodHandler({ DELETE });
export { handleDELETE as DELETE };