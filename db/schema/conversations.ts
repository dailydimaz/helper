import { isNull, relations } from "drizzle-orm";
import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, unique, vector } from "drizzle-orm/pg-core";
import { mailboxesTable } from "@/db/schema/mailboxes";
import { encryptedField } from "../lib/encryptedField";
import { randomSlugField } from "../lib/random-slug-field";
import { withTimestamps } from "../lib/with-timestamps";
import { conversationEventsTable } from "./conversationEvents";
import { conversationMessagesTable } from "./conversationMessages";
import { issueGroupsTable } from "./issueGroups";
import { platformCustomersTable } from "./platformCustomers";

export const conversationsTable = pgTable(
  "conversations_conversation",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    emailFrom: text(),
    subject: encryptedField("encrypted_subject"),
    subjectPlaintext: text("subject"),
    status: text().$type<"open" | "closed" | "spam">(),
    unused_mailboxId: bigint("mailbox_id", { mode: "number" })
      .notNull()
      .$defaultFn(() => 0),
    emailFromName: text(),
    slug: randomSlugField("slug"),
    lastUserEmailCreatedAt: timestamp({ withTimezone: true, mode: "date" }),
    lastReadAt: timestamp({ withTimezone: true, mode: "date" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: "date" }),
    conversationProvider: text().$type<"gmail" | "helpscout" | "chat">(),
    closedAt: timestamp({ withTimezone: true, mode: "date" }),
    assignedToId: text("assigned_to_clerk_id"),
    summary: jsonb().$type<string[]>(),
    embedding: vector({ dimensions: 1536 }),
    embeddingText: text(),
    source: text().$type<"email" | "chat" | "form">(),
    githubIssueNumber: integer(),
    githubIssueUrl: text(),
    githubRepoOwner: text(),
    githubRepoName: text(),
    isPrompt: boolean().notNull().default(false),
    isVisitor: boolean().notNull().default(false),
    assignedToAI: boolean().notNull().default(false),
    mergedIntoId: bigint({ mode: "number" }),
    anonymousSessionId: text(),
    issueGroupId: bigint("issue_group_id", { mode: "number" }),
    suggestedActions: jsonb().$type<
      (
        | { type: "close" | "spam" }
        | { type: "assign"; userId: string }
        | {
            type: "tool";
            slug: string;
            parameters: Record<string, any>;
          }
      )[]
    >(),
  },
  (table) => [
    index("conversations_conversation_assigned_to_clerk_id").on(table.assignedToId),
    index("conversations_conversation_closed_at_16474e94").on(table.closedAt),
    index("conversations_conversation_created_at_1ec48787").on(table.createdAt),
    index("conversations_conversation_email_from_aab3d292").on(table.emailFrom),
    // Drizzle doesn't generate migrations with `text_pattern_ops`; they only have `text_ops`
    index("conversations_conversation_email_from_aab3d292_like").on(table.emailFrom),
    index("conversations_conversation_last_user_email_created_at_fc6b89db").on(table.lastUserEmailCreatedAt),
    index("conversations_conversation_last_message_at_idx").on(table.lastMessageAt.desc().nullsLast()),
    index("conversations_conversation_mailbox_id_7fb25662").on(table.unused_mailboxId),
    // Drizzle doesn't generate migrations with `text_pattern_ops`; they only have `text_ops`
    index("conversations_conversation_slug_9924e9b1_like").on(table.slug),
    index("embedding_vector_index").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
    unique("conversations_conversation_slug_key").on(table.slug),
    index("conversations_anonymous_session_id_idx").on(table.anonymousSessionId),
    index("conversations_merged_into_id_idx").on(table.mergedIntoId),
    index("conversations_issue_group_id_idx").on(table.issueGroupId),
    index("conversations_conversation_status_last_user_email_created_at_idx")
      .on(table.status, table.lastUserEmailCreatedAt.desc().nullsLast())
      .where(isNull(table.mergedIntoId)),
  ],
).enableRLS();

export const conversationsTableRelations = relations(conversationsTable, ({ one, many }) => ({
  mailbox: one(mailboxesTable, {
    fields: [conversationsTable.unused_mailboxId],
    references: [mailboxesTable.id],
  }),
  messages: many(conversationMessagesTable),
  platformCustomer: one(platformCustomersTable, {
    fields: [conversationsTable.emailFrom],
    references: [platformCustomersTable.email],
  }),
  events: many(conversationEventsTable),
  issueGroup: one(issueGroupsTable, {
    fields: [conversationsTable.issueGroupId],
    references: [issueGroupsTable.id],
  }),
  mergedInto: one(conversationsTable, {
    fields: [conversationsTable.mergedIntoId],
    references: [conversationsTable.id],
  }),
  mergedConversations: many(conversationsTable, {
    relationName: "mergedConversations",
  }),
}));

// Backwards compatibility export
export const conversations = conversationsTable;
