import { relations } from "drizzle-orm";
import { bigint, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { withTimestamps } from "../lib/with-timestamps";
import { conversationMessagesTable } from "./conversationMessages";
import { conversationsTable } from "./conversations";
import { platformCustomersTable } from "./platformCustomers";

export type NotificationStatus = "pending" | "sent" | "read" | "dismissed";

export const messageNotificationsTable = pgTable(
  "message_notifications",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    messageId: bigint({ mode: "number" }).notNull(),
    conversationId: bigint({ mode: "number" }).notNull(),
    platformCustomerId: bigint({ mode: "number" }).notNull(),
    status: text().$type<NotificationStatus>().notNull().default("pending"),
    notificationText: text(),
    sentAt: timestamp({ withTimezone: true }),
    readAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("message_notifications_message_id_idx").on(table.messageId),
    index("message_notifications_conversation_id_idx").on(table.conversationId),
    index("message_notifications_platform_customer_id_idx").on(table.platformCustomerId),
    index("message_notifications_status_idx").on(table.status),
  ],
).enableRLS();

export const messageNotificationsTableRelations = relations(messageNotificationsTable, ({ one }) => ({
  message: one(conversationMessagesTable, {
    fields: [messageNotificationsTable.messageId],
    references: [conversationMessagesTable.id],
  }),
  conversation: one(conversationsTable, {
    fields: [messageNotificationsTable.conversationId],
    references: [conversationsTable.id],
  }),
  platformCustomer: one(platformCustomersTable, {
    fields: [messageNotificationsTable.platformCustomerId],
    references: [platformCustomersTable.email],
  }),
}));

// Backwards compatibility export
export const messageNotifications = messageNotificationsTable;
