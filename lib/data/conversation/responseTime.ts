import { aliasedTable, and, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { conversationMessagesTable, conversationsTable, platformCustomersTable } from "@/db/schema";
import { searchConversations } from "@/lib/data/conversation/search";
import { searchSchema } from "@/lib/data/conversation/searchSchema";
import { Mailbox } from "@/lib/data/mailbox";

export const getAverageResponseTime = async (
  mailbox: Mailbox,
  startDate: Date,
  endDate: Date,
  filters?: Omit<z.infer<typeof searchSchema>, "cursor" | "limit">,
) => {
  const where = filters ? (await searchConversations(mailbox, { ...filters, limit: 1 })).where : null;

  const userMessages = aliasedTable(conversationMessagesTable, "userMessages");

  const [{ averageResponseTimeSeconds } = {}] = await db
    .select({
      averageResponseTimeSeconds:
        sql<number>`avg(EXTRACT(EPOCH FROM (${conversationMessagesTable.createdAt} - ${userMessages.createdAt})))`.mapWith(
          Number,
        ),
    })
    .from(conversationMessagesTable)
    .innerJoin(userMessages, eq(conversationMessagesTable.responseToId, userMessages.id))
    .innerJoin(conversationsTable, eq(conversationMessagesTable.conversationId, conversationsTable.id))
    .leftJoin(platformCustomersTable, eq(conversationsTable.emailFrom, platformCustomersTable.email))
    .where(
      and(
        ...Object.values(where ?? {}),
        eq(conversationMessagesTable.role, "staff"),
        gte(conversationMessagesTable.createdAt, new Date(startDate)),
        lte(conversationMessagesTable.createdAt, new Date(endDate)),
      ),
    );

  return averageResponseTimeSeconds ?? null;
};
