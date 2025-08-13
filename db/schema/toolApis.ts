import { relations } from "drizzle-orm";
import { bigint, index, pgTable, text } from "drizzle-orm/pg-core";
import { encryptedField } from "../lib/encryptedField";
import { withTimestamps } from "../lib/with-timestamps";
import { mailboxesTable } from "./mailboxes";
import { toolsTable } from "./tools";

const toolApisTable = pgTable(
  "tool_apis",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    name: text().notNull(),
    unused_mailboxId: bigint("mailbox_id", { mode: "number" })
      .notNull()
      .$defaultFn(() => 0),
    baseUrl: text(),
    schema: text(),
    authenticationToken: encryptedField("encrypted_authentication_token"),
    authenticationTokenPlaintext: text("authentication_token"),
  },
  (table) => [index("tool_apis_mailbox_id_idx").on(table.unused_mailboxId)],
).enableRLS();

export const toolApisTableRelations = relations(toolApisTable, ({ many, one }) => ({
  tools: many(toolsTable),
  mailbox: one(mailboxesTable, {
    fields: [toolApisTable.unused_mailboxId],
    references: [mailboxesTable.id],
  }),
}));

export { toolApisTable };
export type ToolApi = typeof toolApisTable.$inferSelect;

// Backwards compatibility export
export const toolApis = toolApisTable;
