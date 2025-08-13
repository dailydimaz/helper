import { relations } from "drizzle-orm";
import { bigint, boolean, index, integer, pgTable, text, unique } from "drizzle-orm/pg-core";
import { randomSlugField } from "../lib/random-slug-field";
import { withTimestamps } from "../lib/with-timestamps";
import { conversationMessagesTable } from "./conversationMessages";
import { notesTable } from "./notes";

export const filesTable = pgTable(
  "conversations_file",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    name: text().notNull(),
    key: text("url").notNull(),
    mimetype: text().notNull(),
    size: integer().notNull(),
    messageId: bigint("message_id", { mode: "number" }),
    noteId: bigint("note_id", { mode: "number" }),
    previewKey: text("preview_url"),
    isInline: boolean().notNull(),
    isPublic: boolean().notNull(),
    slug: randomSlugField("slug"),
  },
  (table) => [
    index("conversatio_created_9fddde_idx").on(table.createdAt),
    index("conversations_file_message_id_idx").on(table.messageId),
    index("conversations_file_note_id_idx").on(table.noteId),
    unique("conversations_file_slug_key").on(table.slug),
  ],
).enableRLS();

export const filesTableRelations = relations(filesTable, ({ one }) => ({
  message: one(conversationMessagesTable, {
    fields: [filesTable.messageId],
    references: [conversationMessagesTable.id],
  }),
  note: one(notesTable, {
    fields: [filesTable.noteId],
    references: [notesTable.id],
  }),
}));

// Backwards compatibility export
export const files = filesTable;
