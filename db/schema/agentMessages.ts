import { relations } from "drizzle-orm";
import { bigint, index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { withTimestamps } from "../lib/with-timestamps";
import { agentThreadsTable } from "./agentThreads";

export type AgentMessageRole = "user" | "assistant" | "tool";

export const agentMessagesTable = pgTable(
  "agent_messages",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    agentThreadId: bigint({ mode: "number" }).notNull(),
    role: text().$type<AgentMessageRole>().notNull(),
    content: text().notNull(),
    metadata: jsonb().$type<{ toolName: string; parameters: Record<string, unknown> }>(),
    slackChannel: text(),
    messageTs: text(),
  },
  (table) => [
    index("agent_messages_agent_thread_id_idx").on(table.agentThreadId),
    uniqueIndex("agent_messages_slack_unique_idx").on(table.slackChannel, table.messageTs),
  ],
).enableRLS();

export const agentMessagesTableRelations = relations(agentMessagesTable, ({ one }) => ({
  thread: one(agentThreadsTable, {
    fields: [agentMessagesTable.agentThreadId],
    references: [agentThreadsTable.id],
  }),
}));

// Backwards compatibility export
export const agentMessages = agentMessagesTable;
