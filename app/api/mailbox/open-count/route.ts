import { NextRequest } from "next/server";
import { and, count, eq, isNotNull, isNull, SQL } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { db } from "@/db/client";
import { conversationsTable } from "@/db/schema";

// GET /api/mailbox/open-count - Get open conversations count
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const countOpenStatus = async (where?: SQL) => {
      const result = await db
        .select({ count: count() })
        .from(conversationsTable)
        .where(and(eq(conversationsTable.status, "open"), isNull(conversationsTable.mergedIntoId), where));
      return result[0]?.count ?? 0;
    };

    const [all, mine, assigned] = await Promise.all([
      countOpenStatus(),
      countOpenStatus(eq(conversationsTable.assignedToId, user.id)),
      countOpenStatus(isNotNull(conversationsTable.assignedToId)),
    ]);

    const data = {
      all,
      mine,
      assigned,
      unassigned: all - assigned,
    };

    return apiSuccess({ data });
  } catch (error) {
    console.error("Get open count error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to get open count", 500);
  }
}

export const { GET: handleGET } = createMethodHandler({ GET });
export { handleGET as GET };