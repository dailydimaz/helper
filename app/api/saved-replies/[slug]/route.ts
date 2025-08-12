import { NextRequest } from "next/server";
import DOMPurify from "isomorphic-dompurify";
import { and, eq, sql } from "drizzle-orm";
import { updateSavedReplySchema } from "@/lib/validation/schema";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { savedRepliesTable } from "@/db/schema";
import { takeUniqueOrThrow } from "@/components/utils/arrays";

const sanitizeContent = (content: string): string => {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "ol", "ul", "li", "blockquote", "a"],
    ALLOWED_ATTR: ["href", "target", "rel"],
    KEEP_CONTENT: true,
  });
};

// Helper to get saved reply by slug
async function getSavedReplyBySlug(slug: string) {
  const savedReply = await db.query.savedReplies.findFirst({
    where: eq(savedReplies.slug, slug),
  });
  
  if (!savedReply) {
    throw new Error("Saved reply not found");
  }
  
  return savedReply;
}

// GET /api/saved-replies/[slug] - Get specific saved reply
async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const savedReply = await getSavedReplyBySlug(params.slug);

    return apiSuccess({ data: savedReply });
  } catch (error) {
    console.error("Get saved reply error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
      if (error.message === "Saved reply not found") {
        return apiError("Saved reply not found", 404);
      }
    }
    return apiError("Failed to get saved reply", 500);
  }
}

// PUT /api/saved-replies/[slug] - Update saved reply
async function PUT(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    // Check if saved reply exists
    const existingSavedReply = await getSavedReplyBySlug(params.slug);
    
    const validation = await validateRequest(request, updateSavedReplySchema);
    if ("error" in validation) {
      return validation.error;
    }

    const updateData = validation.data;

    // Sanitize content if being updated
    const sanitizedUpdateData = {
      ...updateData,
      ...(updateData.content && { content: sanitizeContent(updateData.content) }),
      updatedAt: new Date(),
    };

    const updatedSavedReply = await db
      .update(savedReplies)
      .set(sanitizedUpdateData)
      .where(eq(savedReplies.slug, params.slug))
      .returning()
      .then(takeUniqueOrThrow);

    return apiSuccess({ data: updatedSavedReply }, "Saved reply updated successfully");
  } catch (error) {
    console.error("Update saved reply error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
      if (error.message === "Saved reply not found") {
        return apiError("Saved reply not found", 404);
      }
    }
    return apiError("Failed to update saved reply", 500);
  }
}

// DELETE /api/saved-replies/[slug] - Delete saved reply
async function DELETE(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    // Check if saved reply exists
    const existingSavedReply = await getSavedReplyBySlug(params.slug);

    await db.delete(savedReplies).where(eq(savedReplies.slug, params.slug));

    return apiSuccess(null, "Saved reply deleted successfully");
  } catch (error) {
    console.error("Delete saved reply error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
      if (error.message === "Saved reply not found") {
        return apiError("Saved reply not found", 404);
      }
    }
    return apiError("Failed to delete saved reply", 500);
  }
}

// POST /api/saved-replies/[slug]/increment-usage - Increment usage count
async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    // Verify saved reply exists and is active before incrementing
    const savedReply = await db.query.savedReplies.findFirst({
      where: and(eq(savedReplies.slug, params.slug), eq(savedReplies.isActive, true)),
    });

    if (!savedReply) {
      return apiError("Saved reply not found or access denied", 404);
    }

    await db
      .update(savedReplies)
      .set({
        usageCount: sql`${savedReplies.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(savedReplies.slug, params.slug));

    return apiSuccess(null, "Usage count incremented successfully");
  } catch (error) {
    console.error("Increment saved reply usage error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to increment usage count", 500);
  }
}

export const { GET: handleGET, PUT: handlePUT, DELETE: handleDELETE, POST: handlePOST } = createMethodHandler({ GET, PUT, DELETE, POST });
export { handleGET as GET, handlePUT as PUT, handleDELETE as DELETE, handlePOST as POST };