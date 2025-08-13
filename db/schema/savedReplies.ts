import { relations } from "drizzle-orm";
import { bigint, boolean, index, integer, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { mailboxesTable } from "@/db/schema/mailboxes";
import { randomSlugField } from "../lib/random-slug-field";
import { withTimestamps } from "../lib/with-timestamps";

export const savedRepliesTable = pgTable(
  "saved_replies",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    slug: randomSlugField("slug"),
    name: varchar({ length: 100 }).notNull(),
    content: text().notNull(),
    unused_mailboxId: bigint("mailbox_id", { mode: "number" })
      .notNull()
      .references(() => mailboxesTable.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id"),
    isActive: boolean().notNull().default(true),
    usageCount: integer().notNull().default(0),
  },
  (table) => [
    index("saved_replies_mailbox_id_idx").on(table.unused_mailboxId),
    index("saved_replies_created_by_user_idx").on(table.createdByUserId),
    index("saved_replies_slug_idx").on(table.slug),
    uniqueIndex("saved_replies_slug_mailbox_unique").on(table.slug, table.unused_mailboxId),
  ],
).enableRLS();

export const savedRepliesTableRelations = relations(savedRepliesTable, ({ one }) => ({
  mailbox: one(mailboxesTable, {
    fields: [savedRepliesTable.unused_mailboxId],
    references: [mailboxesTable.id],
  }),
}));

// Backwards compatibility export
export const savedReplies = savedRepliesTable;
