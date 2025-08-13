import { NextRequest } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { faqsTable } from "@/db/schema/faqs";

const updateFaqSchema = z.object({
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
  category: z.string().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  isPublic: z.boolean().optional(),
});

// GET /api/mailbox/faqs/[id] - Get FAQ by ID
async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const { id } = await params;
    const faqId = parseInt(id);
    
    if (isNaN(faqId)) {
      return apiError("Invalid FAQ ID", 400);
    }

    const [faq] = await db
      .select()
      .from(faqsTable)
      .where(and(
        eq(faqsTable.id, faqId),
        eq(faqsTable.unused_mailboxId, mailbox.id)
      ));

    if (!faq) {
      return apiError("FAQ not found", 404);
    }

    return apiSuccess({ data: faq });
  } catch (error) {
    console.error("Get FAQ error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to get FAQ", 500);
  }
}

// PUT /api/mailbox/faqs/[id] - Update FAQ
async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const { id } = await params;
    const faqId = parseInt(id);
    
    if (isNaN(faqId)) {
      return apiError("Invalid FAQ ID", 400);
    }

    const validation = await validateRequest(request, updateFaqSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const updateData = validation.data;

    const [updatedFaq] = await db
      .update(faqsTable)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(and(
        eq(faqsTable.id, faqId),
        eq(faqsTable.unused_mailboxId, mailbox.id)
      ))
      .returning();

    if (!updatedFaq) {
      return apiError("FAQ not found", 404);
    }

    return apiSuccess({ data: updatedFaq });
  } catch (error) {
    console.error("Update FAQ error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to update FAQ", 500);
  }
}

// DELETE /api/mailbox/faqs/[id] - Delete FAQ
async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const { id } = await params;
    const faqId = parseInt(id);
    
    if (isNaN(faqId)) {
      return apiError("Invalid FAQ ID", 400);
    }

    const [deletedFaq] = await db
      .delete(faqsTable)
      .where(and(
        eq(faqsTable.id, faqId),
        eq(faqsTable.unused_mailboxId, mailbox.id)
      ))
      .returning();

    if (!deletedFaq) {
      return apiError("FAQ not found", 404);
    }

    return apiSuccess({ message: "FAQ deleted successfully" });
  } catch (error) {
    console.error("Delete FAQ error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to delete FAQ", 500);
  }
}

export const { GET: handleGET, PUT: handlePUT, DELETE: handleDELETE } = createMethodHandler({ GET, PUT, DELETE });
export { handleGET as GET, handlePUT as PUT, handleDELETE as DELETE };