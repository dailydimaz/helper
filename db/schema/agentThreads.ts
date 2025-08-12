import { relations } from "drizzle-orm";
import { bigint, index, pgTable, text } from "drizzle-orm/pg-core";
import { agentMessagesTable } from "@/db/schema/agentMessages";
import { withTimestamps } from "../lib/with-timestamps";
import { mailboxesTable } from "./mailboxes";

export const agentThreadsTable = pgTable(
  "agent_threads",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    unused_mailboxId: bigint("mailbox_id", { mode: "number" }).$defaultFn(() => 0),
    slackChannel: text().notNull(),
    threadTs: text().notNull(),
  },
  (table) => [
    index("agent_threads_mailbox_id_idx").on(table.unused_mailboxId),
    index("agent_threads_slack_channel_thread_ts_idx").on(table.slackChannel, table.threadTs),
  ],
).enableRLS();

export const agentThreadsTableRelations = relations(agentThreadsTable, ({ one, many }) => ({
  mailbox: one(mailboxesTable, {
    fields: [agentThreadsTable.unused_mailboxId],
    references: [mailboxesTable.id],
  }),
  messages: many(agentMessagesTable),
}));
