import { NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { websitesTable } from "@/db/schema/websites";

const createWebsiteSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

// GET /api/mailbox/websites - List websites
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();

    const websites = await db
      .select()
      .from(websitesTable)
      .where(eq(websitesTable.unused_mailboxId, mailbox.id))
      .orderBy(desc(websitesTable.createdAt));

    return apiSuccess({ data: websites });
  } catch (error) {
    console.error("List websites error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to list websites", 500);
  }
}

// POST /api/mailbox/websites - Create new website
async function POST(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const validation = await validateRequest(request, createWebsiteSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const { url, name, description } = validation.data;

    const [website] = await db
      .insert(websitesTable)
      .values({
        unused_mailboxId: mailbox.id,
        url,
        name: name || new URL(url).hostname,
        description,
      })
      .returning();

    return apiSuccess({ data: website });
  } catch (error) {
    console.error("Create website error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to create website", 500);
  }
}

export const { GET: handleGET, POST: handlePOST } = createMethodHandler({ GET, POST });
export { handleGET as GET, handlePOST as POST };