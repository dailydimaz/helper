import { relations } from "drizzle-orm";
import { bigint, index, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { withTimestamps } from "../lib/with-timestamps";
import { conversationsTable } from "./conversations";
import { platformCustomersTable } from "./platformCustomers";

export const guideSessionStatusEnum = pgEnum("guide_session_status", [
  "started",
  "planning",
  "active",
  "completed",
  "abandoned",
  "paused",
]);

export const guideSessionEventTypeEnum = pgEnum("guide_session_event_type", [
  "session_started",
  "step_added",
  "step_completed",
  "step_updated",
  "action_performed",
  "completed",
  "abandoned",
  "paused",
  "resumed",
]);

export type GuideSessionStep = {
  description: string;
  completed: boolean;
};

export const guideSessionsTable = pgTable(
  "guide_sessions",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    uuid: uuid("uuid").notNull().defaultRandom(),
    platformCustomerId: bigint({ mode: "number" }).notNull(),
    conversationId: bigint({ mode: "number" }),
    status: guideSessionStatusEnum("status").notNull().default("started"),
    title: text().notNull(),
    instructions: text(),
    steps: jsonb().default([]).$type<GuideSessionStep[]>(),
    metadata: jsonb().default({}),
    unused_mailboxId: bigint("mailbox_id", { mode: "number" })
      .notNull()
      .$defaultFn(() => 0),
  },
  (table) => [
    index("guide_sessions_created_at_idx").on(table.createdAt),
    index("guide_sessions_platform_customer_id_idx").on(table.platformCustomerId),
    index("guide_sessions_conversation_id_idx").on(table.conversationId),
    index("guide_sessions_mailbox_id_idx").on(table.unused_mailboxId),
    index("guide_sessions_status_idx").on(table.status),
    unique("guide_sessions_uuid_unique").on(table.uuid),
  ],
).enableRLS();

export const guideSessionEventsTable = pgTable(
  "guide_session_events",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    guideSessionId: bigint({ mode: "number" }).notNull(),
    type: guideSessionEventTypeEnum("type").notNull(),
    data: jsonb().default({}),
    timestamp: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
    unused_mailboxId: bigint("mailbox_id", { mode: "number" })
      .notNull()
      .$defaultFn(() => 0),
  },
  (table) => [
    index("guide_session_events_timestamp_idx").on(table.timestamp),
    index("guide_session_events_guide_session_id_idx").on(table.guideSessionId),
    index("guide_session_events_type_idx").on(table.type),
    index("guide_session_events_mailbox_id_idx").on(table.unused_mailboxId),
  ],
).enableRLS();

export const guideSessionReplaysTable = pgTable(
  "guide_session_replays",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    guideSessionId: bigint({ mode: "number" }).notNull(),
    type: text().notNull(),
    data: text().notNull(),
    timestamp: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
    metadata: jsonb().default({}),
    unused_mailboxId: bigint("mailbox_id", { mode: "number" })
      .notNull()
      .$defaultFn(() => 0),
  },
  (table) => [
    index("guide_session_replays_guide_session_id_idx").on(table.guideSessionId),
    index("guide_session_replays_timestamp_idx").on(table.timestamp),
    index("guide_session_replays_mailbox_id_idx").on(table.unused_mailboxId),
  ],
).enableRLS();

export const guideSessionsTableRelations = relations(guideSessionsTable, ({ one, many }) => ({
  platformCustomer: one(platformCustomersTable, {
    fields: [guideSessionsTable.platformCustomerId],
    references: [platformCustomersTable.id],
  }),
  conversation: one(conversationsTable, {
    fields: [guideSessionsTable.conversationId],
    references: [conversationsTable.id],
  }),
  events: many(guideSessionEventsTable),
  replays: many(guideSessionReplaysTable),
}));

export const guideSessionEventsTableRelations = relations(guideSessionEventsTable, ({ one }) => ({
  guideSession: one(guideSessionsTable, {
    fields: [guideSessionEventsTable.guideSessionId],
    references: [guideSessionsTable.id],
  }),
}));

export const guideSessionReplaysTableRelations = relations(guideSessionReplaysTable, ({ one }) => ({
  guideSession: one(guideSessionsTable, {
    fields: [guideSessionReplaysTable.guideSessionId],
    references: [guideSessionsTable.id],
  }),
}));
