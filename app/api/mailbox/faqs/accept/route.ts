import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { faqsTable } from "@/db/schema/faqs";

const acceptFaqSchema = z.object({
  id: z.number().int().positive(),
});

// POST /api/mailbox/faqs/accept - Accept a suggested FAQ
async function POST(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const validation = await validateRequest(request, acceptFaqSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { id } = validation.data;

    const [acceptedFaq] = await db
      .update(faqsTable)
      .set({
        enabled: true,
        suggested: false,
        updatedAt: new Date(),
        // TODO: Add acceptedAt, acceptedByUserId fields to schema
      })
      .where(and(
        eq(faqsTable.id, id),
        eq(faqsTable.unused_mailboxId, mailbox.id)
      ))
      .returning();

    if (!acceptedFaq) {
      return apiError("FAQ not found", 404);
    }

    return apiSuccess({ data: acceptedFaq });
  } catch (error) {
    console.error("Accept FAQ error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to accept FAQ", 500);
  }
}

export const { POST: handlePOST } = createMethodHandler({ POST });
export { handlePOST as POST };