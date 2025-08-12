import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  SQL,
  sql,
} from "drizzle-orm";
import { memoize } from "lodash-es";
import { db } from "@/db/client";
import { decryptFieldValue } from "@/db/lib/encryptedField";
import { conversationEventsTable, conversationMessagesTable, conversationsTable, mailboxesTable, platformCustomersTable } from "@/db/schema";
import { serializeConversation } from "@/lib/data/conversation";
import { searchSchema } from "@/lib/data/conversation/searchSchema";
import { getMetadataApiByMailbox } from "@/lib/data/mailboxMetadataApi";
import {
  CLOSED_BY_AGENT_MESSAGE,
  MARKED_AS_SPAM_BY_AGENT_MESSAGE,
  REOPENED_BY_AGENT_MESSAGE,
} from "@/lib/slack/constants";
import "server-only";
import { z } from "zod";
import { searchEmailsByKeywords } from "../../emailSearchService/searchEmailsByKeywords";

export const searchConversations = async (
  mailbox: typeof mailboxesTable.$inferSelect,
  filters: z.infer<typeof searchSchema>,
  currentUserId?: string,
) => {
  if (filters.category && !filters.search && !filters.status?.length) {
    filters.status = ["open"];
  }
  if (filters.category === "mine" && currentUserId) {
    filters.assignee = [currentUserId];
  }
  if (filters.category === "unassigned") {
    filters.isAssigned = false;
  }
  if (filters.category === "assigned") {
    filters.isAssigned = true;
  }

  // Filters on conversations and messages that we can pass to searchEmailsByKeywords
  let where: Record<string, SQL> = {
    notMerged: isNull(conversationsTable.mergedIntoId),
    ...(filters.status?.length ? { status: inArray(conversationsTable.status, filters.status) } : {}),
    ...(filters.assignee?.length ? { assignee: inArray(conversationsTable.assignedToId, filters.assignee) } : {}),
    ...(filters.isAssigned === true ? { assignee: isNotNull(conversationsTable.assignedToId) } : {}),
    ...(filters.isAssigned === false ? { assignee: isNull(conversationsTable.assignedToId) } : {}),
    ...(filters.isPrompt !== undefined ? { isPrompt: eq(conversationsTable.isPrompt, filters.isPrompt) } : {}),
    ...(filters.createdAfter ? { createdAfter: gt(conversationsTable.createdAt, new Date(filters.createdAfter)) } : {}),
    ...(filters.createdBefore ? { createdBefore: lt(conversationsTable.createdAt, new Date(filters.createdBefore)) } : {}),
    ...(filters.repliedBy?.length || filters.repliedAfter || filters.repliedBefore
      ? {
          reply: exists(
            db
              .select()
              .from(conversationMessagesTable)
              .where(
                and(
                  eq(conversationMessagesTable.conversationId, conversationsTable.id),
                  eq(conversationMessagesTable.role, "staff"),
                  filters.repliedBy?.length ? inArray(conversationMessagesTable.userId, filters.repliedBy) : undefined,
                  filters.repliedAfter ? gt(conversationMessagesTable.createdAt, new Date(filters.repliedAfter)) : undefined,
                  filters.repliedBefore
                    ? lt(conversationMessagesTable.createdAt, new Date(filters.repliedBefore))
                    : undefined,
                ),
              ),
          ),
        }
      : {}),
    ...(filters.customer?.length ? { customer: inArray(conversationsTable.emailFrom, filters.customer) } : {}),
    ...(filters.anonymousSessionId
      ? { anonymousSessionId: eq(conversationsTable.anonymousSessionId, filters.anonymousSessionId) }
      : {}),
    ...(filters.reactionType
      ? {
          reaction: exists(
            db
              .select()
              .from(conversationMessagesTable)
              .where(
                and(
                  eq(conversationMessagesTable.conversationId, conversationsTable.id),
                  eq(conversationMessagesTable.reactionType, filters.reactionType),
                  isNull(conversationMessagesTable.deletedAt),
                  filters.reactionAfter
                    ? gte(conversationMessagesTable.reactionCreatedAt, new Date(filters.reactionAfter))
                    : undefined,
                  filters.reactionBefore
                    ? lte(conversationMessagesTable.reactionCreatedAt, new Date(filters.reactionBefore))
                    : undefined,
                ),
              ),
          ),
        }
      : {}),
    ...(filters.events?.length ? { events: hasEvent(inArray(conversationEventsTable.type, filters.events)) } : {}),
    ...(filters.closed ? { closed: hasStatusChangeEvent("closed", filters.closed, CLOSED_BY_AGENT_MESSAGE) } : {}),
    ...(filters.reopened
      ? { reopened: hasStatusChangeEvent("open", filters.reopened, REOPENED_BY_AGENT_MESSAGE) }
      : {}),
    ...(filters.markedAsSpam
      ? { markedAsSpam: hasStatusChangeEvent("spam", filters.markedAsSpam, MARKED_AS_SPAM_BY_AGENT_MESSAGE) }
      : {}),
    ...(filters.issueGroupId
      ? {
          issueGroup: eq(conversationsTable.issueGroupId, filters.issueGroupId),
        }
      : {}),
  };

  const matches = filters.search ? await searchEmailsByKeywords(filters.search, Object.values(where)) : [];

  // Additional filters we can't pass to searchEmailsByKeywords
  where = {
    ...where,
    ...(filters.isVip && mailbox.vipThreshold != null
      ? { isVip: sql`${platformCustomersTable.value} >= ${mailbox.vipThreshold * 100}` }
      : {}),
    ...(filters.minValueDollars != null
      ? { minValue: gt(platformCustomersTable.value, (filters.minValueDollars * 100).toString()) }
      : {}),
    ...(filters.maxValueDollars != null
      ? { maxValue: lt(platformCustomersTable.value, (filters.maxValueDollars * 100).toString()) }
      : {}),
    ...(filters.search
      ? {
          search: or(
            ilike(conversationsTable.emailFrom, `%${filters.search}%`),
            inArray(
              conversationsTable.id,
              matches.map((m) => m.conversationId),
            ),
          ),
        }
      : {}),
  };

  const orderByField =
    filters.status?.length === 1 && filters.status[0] === "closed"
      ? conversationsTable.closedAt
      : sql`COALESCE(${conversationsTable.lastUserEmailCreatedAt}, ${conversationsTable.createdAt})`;
  const isOpenTicketsOnly = filters.status?.length === 1 && filters.status[0] === "open";
  const orderBy = isOpenTicketsOnly
    ? [filters.sort === "newest" ? desc(orderByField) : asc(orderByField)]
    : [filters.sort === "oldest" ? asc(orderByField) : desc(orderByField)];
  const metadataEnabled = !filters.search && !!(await getMetadataApiByMailbox());
  if (metadataEnabled && (filters.sort === "highest_value" || !filters.sort) && isOpenTicketsOnly) {
    orderBy.unshift(sql`${platformCustomersTable.value} DESC NULLS LAST`);
  }

  const list = memoize(() =>
    db
      .select({
        conversations_conversation: conversationsTable,
        mailboxes_platformcustomer: platformCustomersTable,
        recent_message_cleanedUpText: sql<string | null>`recent_message.cleaned_up_text`,
        recent_message_createdAt: sql<string | null>`recent_message.created_at`,
      })
      .from(conversationsTable)
      .leftJoin(platformCustomersTable, eq(conversationsTable.emailFrom, platformCustomersTable.email))
      .leftJoin(
        sql`LATERAL (
          SELECT
            ${conversationMessagesTable.cleanedUpText} as cleaned_up_text, 
            ${conversationMessagesTable.createdAt} as created_at
          FROM ${conversationMessagesTable}
          WHERE ${and(
            eq(conversationMessagesTable.conversationId, conversationsTable.id),
            inArray(conversationMessagesTable.role, ["user", "staff"]),
          )}
          ORDER BY ${desc(conversationMessagesTable.createdAt)}
          LIMIT 1
        ) as recent_message`,
        sql`true`,
      )
      .where(and(...Object.values(where)))
      .orderBy(...orderBy)
      .limit(filters.limit + 1) // Get one extra to determine if there's a next page
      .offset(filters.cursor ? parseInt(filters.cursor) : 0)
      .then((results) => ({
        results: results
          .slice(0, filters.limit)
          .map(
            ({
              conversations_conversation,
              mailboxes_platformcustomer,
              recent_message_cleanedUpText,
              recent_message_createdAt,
            }) => ({
              ...serializeConversation(mailbox, conversations_conversation, mailboxes_platformcustomer),
              matchedMessageText:
                matches.find((m) => m.conversationId === conversations_conversation.id)?.cleanedUpText ?? null,
              recentMessageText: recent_message_cleanedUpText ? decryptFieldValue(recent_message_cleanedUpText) : null,
              recentMessageAt: recent_message_createdAt ? new Date(recent_message_createdAt) : null,
            }),
          ),
        nextCursor:
          results.length > filters.limit ? (parseInt(filters.cursor ?? "0") + filters.limit).toString() : null,
      })),
  );

  return {
    get list() {
      return list();
    },
    where,
    metadataEnabled,
  };
};

export const countSearchResults = async (where: Record<string, SQL>) => {
  const [total] = await db
    .select({ count: count() })
    .from(conversationsTable)
    .leftJoin(platformCustomersTable, eq(conversationsTable.emailFrom, platformCustomersTable.email))
    .where(and(...Object.values(where)));

  return total?.count ?? 0;
};

export const getSearchResultIds = async (where: Record<string, SQL>) => {
  const results = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .leftJoin(platformCustomersTable, eq(conversationsTable.emailFrom, platformCustomersTable.email))
    .where(and(...Object.values(where)));

  return results.map((result) => result.id);
};

const hasEvent = (where?: SQL) =>
  exists(
    db
      .select()
      .from(conversationEventsTable)
      .where(and(eq(conversationEvents.conversationId, conversations.id), where)),
  );

const hasStatusChangeEvent = (
  status: (typeof conversations.$inferSelect)["status"],
  filters: { by?: "slack_bot" | "human"; byUserId?: string[]; before?: string; after?: string },
  slackBotReason: string,
) =>
  hasEvent(
    and(
      eq(conversationEvents.conversationId, conversations.id),
      filters.by === "slack_bot"
        ? eq(conversationEvents.reason, slackBotReason)
        : isNotNull(conversationEvents.byUserId),
      filters.byUserId?.length ? inArray(conversationEvents.byUserId, filters.byUserId) : undefined,
      eq(sql`${conversationEvents.changes}->>'status'`, status),
      filters.before ? lt(conversationEvents.createdAt, new Date(filters.before)) : undefined,
      filters.after ? gt(conversationEvents.createdAt, new Date(filters.after)) : undefined,
    ),
  );
