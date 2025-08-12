import { NextRequest } from "next/server";
import { z } from "zod";
import DOMPurify from "isomorphic-dompurify";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { createSavedReplySchema, savedRepliesSearchSchema } from "@/lib/validation/schema";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest, validateQueryParams } from "@/lib/api";
import { db } from "@/db/client";
import { savedRepliesTable } from "@/db/schema";
import { users } from "@/db/schema";
import { takeUniqueOrThrow } from "@/components/utils/arrays";

const sanitizeContent = (content: string): string => {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "ol", "ul", "li", "blockquote", "a"],
    ALLOWED_ATTR: ["href", "target", "rel"],
    KEEP_CONTENT: true,
  });
};

// GET /api/saved-replies - List saved replies with search
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const queryValidation = validateQueryParams(request, savedRepliesSearchSchema);
    if ("error" in queryValidation) {
      return queryValidation.error;
    }
    
    const { onlyActive, search } = queryValidation.data;

    const conditions = [];

    if (onlyActive) {
      conditions.push(eq(savedReplies.isActive, true));
    }

    if (search) {
      const searchConditions = [
        ilike(savedReplies.name, `%${search}%`),
        ilike(savedReplies.content, `%${search}%`),
      ];
      conditions.push(or(...searchConditions));
    }

    const result = await db.query.savedReplies.findMany({
      where: and(...conditions),
      orderBy: [desc(savedReplies.usageCount), desc(savedReplies.updatedAt)],
    });

    const userIds = [...new Set(result.map((m) => m.createdByUserId).filter(Boolean))];
    const userDisplayNames =
      userIds.length > 0
        ? await db.query.users.findMany({
            where: inArray(users.id, userIds as string[]),
            columns: { id: true, email: true },
          })
        : [];

    const userMap = new Map(userDisplayNames.map((u) => [u.id, u.email]));

    const data = result.map((savedReply) => ({
      ...savedReply,
      createdByDisplayName: savedReply.createdByUserId
        ? userMap.get(savedReply.createdByUserId) || "Unknown"
        : "Admin",
      mailboxName: mailbox.name,
    }));

    return apiSuccess({ data });
  } catch (error) {
    console.error("Get saved replies error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to get saved replies", 500);
  }
}

// POST /api/saved-replies - Create new saved reply
async function POST(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const validation = await validateRequest(request, createSavedReplySchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { name, content } = validation.data;

    const savedReply = await db
      .insert(savedReplies)
      .values({
        name,
        content: sanitizeContent(content),
        createdByUserId: user.id,
        unused_mailboxId: mailbox.id,
      })
      .returning()
      .then(takeUniqueOrThrow);

    return apiSuccess({ data: savedReply }, "Saved reply created successfully");
  } catch (error) {
    console.error("Create saved reply error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to create saved reply", 500);
  }
}

export const { GET: handleGET, POST: handlePOST } = createMethodHandler({ GET, POST });
export { handleGET as GET, handlePOST as POST };