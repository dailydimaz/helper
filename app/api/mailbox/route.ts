import { NextRequest } from "next/server";
import { z } from "zod";
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { getMailboxInfo } from "@/lib/data/mailbox";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler, validateRequest } from "@/lib/api";
import { db } from "@/db/client";
import { conversationsTable, mailboxesTable } from "@/db/schema";

const updateMailboxSchema = z.object({
  slackAlertChannel: z.string().nullable().optional(),
  githubRepoOwner: z.string().optional(),
  githubRepoName: z.string().optional(),
  widgetDisplayMode: z.enum(["off", "always", "revenue_based"]).optional(),
  widgetDisplayMinValue: z.number().nullable().optional(),
  widgetHost: z.string().nullable().optional(),
  vipThreshold: z.number().nullable().optional(),
  vipChannelId: z.string().nullable().optional(),
  vipExpectedResponseHours: z.number().nullable().optional(),
  autoCloseEnabled: z.boolean().optional(),
  autoCloseDaysOfInactivity: z.number().optional(),
  name: z.string().optional(),
  preferences: z
    .object({
      confetti: z.boolean().optional(),
      autoRespondEmailToChat: z.enum(["draft", "reply"]).nullable().optional(),
      disableTicketResponseTimeAlerts: z.boolean().optional(),
    })
    .optional(),
});

// GET /api/mailbox - Get mailbox info
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    const mailboxInfo = await getMailboxInfo(mailbox);

    return apiSuccess({ data: mailboxInfo });
  } catch (error) {
    console.error("Get mailbox error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to get mailbox", 500);
  }
}

// PUT /api/mailbox - Update mailbox
async function PUT(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    const validation = await validateRequest(request, updateMailboxSchema);
    if ("error" in validation) {
      return validation.error;
    }

    const updateData = validation.data;
    const preferences = { ...mailbox.preferences, ...(updateData.preferences ?? {}) };
    
    await db
      .update(mailboxesTable)
      .set({ ...updateData, preferences })
      .where(eq(mailboxesTable.id, mailbox.id));

    return apiSuccess(null, "Mailbox updated successfully");
  } catch (error) {
    console.error("Update mailbox error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to update mailbox", 500);
  }
}

export const { GET: handleGET, PUT: handlePUT } = createMethodHandler({ GET, PUT });
export { handleGET as GET, handlePUT as PUT };