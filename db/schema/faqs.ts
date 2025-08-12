import { relations } from "drizzle-orm";
import { bigint, boolean, index, pgTable, text, unique, vector } from "drizzle-orm/pg-core";
import { withTimestamps } from "../lib/with-timestamps";
import { conversationMessagesTable } from "./conversationMessages";
import { mailboxesTable } from "./mailboxes";

export const faqsTable = pgTable(
  "faqs",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    content: text("reply").notNull(),
    unused_mailboxId: bigint("mailbox_id", { mode: "number" })
      .notNull()
      .$defaultFn(() => 0),
    embedding: vector({ dimensions: 1536 }),
    enabled: boolean().notNull().default(true),
    suggested: boolean().notNull().default(false),
    suggestedReplacementForId: bigint({ mode: "number" }),
    messageId: bigint({ mode: "number" }),
    slackChannel: text(),
    slackMessageTs: text(),
  },
  (table) => [
    index("faqs_mailbox_created_at_idx").on(table.createdAt),
    index("faqs_mailbox_id_idx").on(table.unused_mailboxId),
    index("faqs_embedding_index").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
    unique("faqs_message_id_key").on(table.messageId),
  ],
).enableRLS();

export const faqsTableRelations = relations(faqsTable, ({ one }) => ({
  mailbox: one(mailboxesTable, {
    fields: [faqsTable.unused_mailboxId],
    references: [mailboxesTable.id],
  }),
  message: one(conversationMessagesTable, {
    fields: [faqsTable.messageId],
    references: [conversationMessagesTable.id],
  }),
}));
