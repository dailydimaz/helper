import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { faqsTable } from "@/db/schema/faqs";

const rejectFaqSchema = z.object({
  id: z.number().int().positive(),
});

// POST /api/mailbox/faqs/reject - Reject a suggested FAQ
async function POST(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const validation = await validateRequest(request, rejectFaqSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { id } = validation.data;

    const [rejectedFaq] = await db
      .update(faqsTable)
      .set({
        enabled: false,
        suggested: false,
        updatedAt: new Date(),
        // TODO: Add rejectedAt, rejectedByUserId fields to schema
      })
      .where(and(
        eq(faqsTable.id, id),
        eq(faqsTable.unused_mailboxId, mailbox.id)
      ))
      .returning();

    if (!rejectedFaq) {
      return apiError("FAQ not found", 404);
    }

    return apiSuccess({ data: rejectedFaq });
  } catch (error) {
    console.error("Reject FAQ error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to reject FAQ", 500);
  }
}

export const { POST: handlePOST } = createMethodHandler({ POST });
export { handlePOST as POST };