import { NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { toolsTable } from "@/db/schema/tools";

const updateToolSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.any()).optional(),
});

// GET /api/mailbox/tools - List tools
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();

    const tools = await db
      .select()
      .from(toolsTable)
      .where(eq(toolsTable.unused_mailboxId, mailbox.id))
      .orderBy(desc(toolsTable.createdAt));

    return apiSuccess({ data: tools });
  } catch (error) {
    console.error("List tools error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to list tools", 500);
  }
}

export const { GET: handleGET } = createMethodHandler({ GET });
export { handleGET as GET };