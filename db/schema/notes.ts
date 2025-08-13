import { relations } from "drizzle-orm";
import { bigint, index, pgTable, text } from "drizzle-orm/pg-core";
import { filesTable } from "@/db/schema/files";
import { withTimestamps } from "../lib/with-timestamps";
import { conversationsTable } from "./conversations";

export const notesTable = pgTable(
  "conversations_note",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    body: text().notNull(),
    userId: text("clerk_user_id"),
    role: text(),
    conversationId: bigint({ mode: "number" }).notNull(),
    slackMessageTs: text(),
    slackChannel: text(),
  },
  (table) => [
    index("conversatio_created_5ad461_idx").on(table.createdAt),
    index("conversations_note_conversation_id_a486ed4c").on(table.conversationId),
    index("conversations_note_clerk_user_id").on(table.userId),
  ],
).enableRLS();

export const notesTableRelations = relations(notesTable, ({ one, many }) => ({
  conversation: one(conversationsTable, {
    fields: [notesTable.conversationId],
    references: [conversationsTable.id],
  }),
  files: many(filesTable),
}));

// Backwards compatibility export
export const notes = notesTable;
