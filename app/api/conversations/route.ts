import { NextRequest } from "next/server";
import { z } from "zod";
import { searchConversations, countSearchResults } from "@/lib/data/conversation/search";
import { createConversationSchema } from "@/lib/validation/schema";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest, validateQueryParams, parsePagination } from "@/lib/api";
import { toRes } from "@/lib/response";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { takeUniqueOrThrow } from "@/components/utils/arrays";
import { createReply } from "@/lib/data/conversationMessage";

const conversationQuerySchema = z.object({
  page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1),
  perPage: z.string().optional().transform((val) => val ? parseInt(val, 10) : 10),
  q: z.string().optional(),
  countOnly: z.string().optional().transform((val) => val === "true"),
});

// GET /api/conversations - List conversations with search and pagination
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const queryValidation = validateQueryParams(request, conversationQuerySchema);
    if ("error" in queryValidation) {
      return queryValidation.error;
    }
    
    const { page, perPage, q, countOnly } = queryValidation.data;
    
    // Build search input from query params
    const searchInput = {
      limit: perPage,
      cursor: page > 1 ? (page - 1) * perPage : undefined,
      search: q,
    };

    if (countOnly) {
      const { where } = await searchConversations(mailbox, searchInput, user.id);
      const total = await countSearchResults(where);
      return toRes({ total });
    }

    const { list } = await searchConversations(mailbox, searchInput, user.id);
    const { results, nextCursor } = await list;

    return apiSuccess({
      data: results,
      pagination: {
        page,
        perPage,
        total: results.length, // This would need to be calculated separately for accurate pagination
        totalPages: Math.ceil(results.length / perPage),
      },
      nextCursor,
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to fetch conversations", 500);
  }
}

// POST /api/conversations - Create new conversation
async function POST(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const validation = await validateRequest(request, createConversationSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { conversation } = validation.data;

    const { id: conversationId } = await db
      .insert(conversations)
      .values({
        slug: conversation.conversation_slug,
        subject: conversation.subject,
        subjectPlaintext: conversation.subject,
        emailFrom: conversation.to_email_address,
        conversationProvider: "gmail",
      })
      .returning({ id: conversations.id })
      .then(takeUniqueOrThrow);

    await createReply({
      conversationId,
      user,
      message: conversation.message?.trim() || null,
      fileSlugs: conversation.file_slugs,
      cc: conversation.cc,
      bcc: conversation.bcc,
    });

    return apiSuccess({ id: conversationId }, "Conversation created successfully");
  } catch (error) {
    console.error("Create conversation error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to create conversation", 500);
  }
}

export const { GET: handleGET, POST: handlePOST } = createMethodHandler({ GET, POST });
export { handleGET as GET, handlePOST as POST };