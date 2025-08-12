import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { requireMailboxAccess } from "@/lib/middleware/mailbox";
import { apiError, apiSuccess, createMethodHandler } from "@/lib/api";
import { db } from "@/db/client";
import { conversationEventsTable, conversationsTable } from "@/db/schema";
import type { DashboardEvent } from "@/lib/swr/realtime-hooks";

// GET /api/mailbox/latest-events - Get latest dashboard events
async function GET(request: NextRequest) {
  try {
    const { user, mailbox } = await requireMailboxAccess();
    
    // Fetch the latest events from conversation events
    const events = await db
      .select({
        id: conversationEventsTable.id,
        conversationSlug: conversationsTable.slug,
        timestamp: conversationEventsTable.createdAt,
        type: conversationEventsTable.eventType,
        description: conversationEventsTable.eventData,
        emailFrom: conversationsTable.emailFrom,
        subject: conversationsTable.subjectPlaintext,
      })
      .from(conversationEventsTable)
      .innerJoin(conversationsTable, eq(conversationEventsTable.conversationId, conversationsTable.id))
      .where(eq(conversationsTable.unused_mailboxId, mailbox.id))
      .orderBy(desc(conversationEventsTable.createdAt))
      .limit(50);

    // Transform events to match DashboardEvent type
    const dashboardEvents: DashboardEvent[] = events.map((event) => ({
      id: event.id.toString(),
      conversationSlug: event.conversationSlug,
      timestamp: event.timestamp.toISOString(),
      title: event.subject || "(no subject)",
      description: typeof event.description === 'string' ? event.description : undefined,
      type: mapEventType(event.type),
      emailFrom: event.emailFrom || undefined,
      isVip: false, // TODO: implement VIP detection based on customer data
      value: undefined, // TODO: implement value calculation if needed
    }));

    return apiSuccess(dashboardEvents);
  } catch (error) {
    console.error("Get latest events error:", error);
    if (error instanceof Error) {
      if (error.message === "Authentication required") {
        return apiError("Authentication required", 401);
      }
      if (error.message === "Mailbox not found") {
        return apiError("Mailbox not found", 404);
      }
    }
    return apiError("Failed to get latest events", 500);
  }
}

// Map internal event types to dashboard event types
function mapEventType(eventType: string): DashboardEvent['type'] {
  switch (eventType) {
    case 'message_received':
    case 'email_received':
      return 'email';
    case 'message_sent':
      return 'chat';
    case 'ai_response':
      return 'ai_reply';
    case 'bad_response':
      return 'bad_reply';
    case 'good_response':
      return 'good_reply';
    case 'escalated':
      return 'escalation';
    default:
      return 'chat';
  }
}

export const { GET: handleGET } = createMethodHandler({ GET });
export { handleGET as GET };