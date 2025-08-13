import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { db } from "@/db/client";
import { gmailSupportEmailsTable } from "@/db/schema/gmailSupportEmails";
import { mailboxesTable } from "@/db/schema/mailboxes";

export const runtime = "edge";

// GET /api/gmail-support-email - Get Gmail support email config
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();

    if (!mailbox.gmailSupportEmailId) {
      return apiSuccess({ 
        data: { 
          supportAccount: null, 
          enabled: false 
        } 
      });
    }

    const [supportEmail] = await db
      .select()
      .from(gmailSupportEmailsTable)
      .where(eq(gmailSupportEmailsTable.id, mailbox.gmailSupportEmailId));

    if (!supportEmail) {
      return apiSuccess({ 
        data: { 
          supportAccount: null, 
          enabled: false 
        } 
      });
    }

    return apiSuccess({ 
      data: { 
        supportAccount: {
          id: supportEmail.id,
          email: supportEmail.email,
          name: supportEmail.name,
        },
        enabled: true 
      } 
    });
  } catch (error) {
    console.error("Get Gmail support email error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to get Gmail support email", 500);
  }
}

// DELETE /api/gmail-support-email - Delete Gmail support email config
async function DELETE(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();

    if (!mailbox.gmailSupportEmailId) {
      return apiError("No Gmail support email configured", 404);
    }

    // Remove the Gmail support email from the mailbox
    await db
      .update(mailboxesTable)
      .set({
        gmailSupportEmailId: null,
        updatedAt: new Date(),
      })
      .where(eq(mailboxesTable.id, mailbox.id));

    // Delete the Gmail support email record
    await db
      .delete(gmailSupportEmailsTable)
      .where(eq(gmailSupportEmailsTable.id, mailbox.gmailSupportEmailId));

    return apiSuccess({ message: "Gmail support email disconnected successfully" });
  } catch (error) {
    console.error("Delete Gmail support email error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to delete Gmail support email", 500);
  }
}

export const { GET: handleGET, DELETE: handleDELETE } = createMethodHandler({ GET, DELETE });
export { handleGET as GET, handleDELETE as DELETE };