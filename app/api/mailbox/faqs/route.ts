import { NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { faqsTable } from "@/db/schema/faqs";
import { generateEmbedding } from "@/lib/ai/embedding";

const createFaqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  category: z.string().optional(),
  priority: z.number().int().min(1).max(10).optional().default(5),
});

const updateFaqSchema = z.object({
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
  category: z.string().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  isPublic: z.boolean().optional(),
});

// GET /api/mailbox/faqs - List all FAQs
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const url = new URL(request.url);
    const includeRejected = url.searchParams.get("includeRejected") === "true";
    
    let whereCondition = and(
      eq(faqsTable.unused_mailboxId, mailbox.id),
      includeRejected ? undefined : undefined // TODO: Add rejectedAt field to schema
    );

    const faqs = await db
      .select()
      .from(faqsTable)
      .where(whereCondition)
      .orderBy(desc(faqsTable.createdAt));

    return apiSuccess({ data: faqs });
  } catch (error) {
    console.error("List FAQs error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to list FAQs", 500);
  }
}

// POST /api/mailbox/faqs - Create new FAQ
async function POST(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const validation = await validateRequest(request, createFaqSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { question, answer, category, priority } = validation.data;

    // Generate embedding for the FAQ
    const embeddingText = `${question} ${answer}`;
    // TODO: Implement embedding generation
    // const embedding = await generateEmbedding(embeddingText);

    const [faq] = await db
      .insert(faqsTable)
      .values({
        unused_mailboxId: mailbox.id,
        content: answer, // Using content field as it exists in schema
        // TODO: Add these fields to schema: question, category, priority, isPublic, createdByUserId
      })
      .returning();

    return apiSuccess({ data: faq });
  } catch (error) {
    console.error("Create FAQ error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to create FAQ", 500);
  }
}

export const { GET: handleGET, POST: handlePOST } = createMethodHandler({ GET, POST });
export { handleGET as GET, handlePOST as POST };