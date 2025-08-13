import { relations } from "drizzle-orm";
import { bigint, boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { conversationsTable } from "./conversations";
import { usersTable } from "./users";
import { conversationFollowersTable } from "./conversationFollowers";

export type FollowerNotificationType = 
  | "new_message" 
  | "status_change" 
  | "assignment_change" 
  | "new_note";

export type FollowerNotificationStatus = "pending" | "sent" | "failed";

export const followerNotificationsTable = pgTable(
  "follower_notifications",
  {
    id: uuid().defaultRandom().primaryKey(),
    followerId: uuid("follower_id")
      .notNull()
      .references(() => conversationFollowersTable.id, { onDelete: "cascade" }),
    conversationId: bigint("conversation_id", { mode: "number" })
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: text().$type<FollowerNotificationType>().notNull(),
    status: text().$type<FollowerNotificationStatus>().notNull().default("pending"),
    title: text().notNull(),
    message: text().notNull(),
    metadata: jsonb().$type<Record<string, any>>().default({}),
    emailSent: boolean("email_sent").notNull().default(false),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("follower_notifications_follower_id_idx").on(table.followerId),
    index("follower_notifications_conversation_id_idx").on(table.conversationId),
    index("follower_notifications_user_id_idx").on(table.userId),
    index("follower_notifications_status_idx").on(table.status),
    index("follower_notifications_type_idx").on(table.type),
    index("follower_notifications_created_at_idx").on(table.createdAt.desc()),
  ]
);

export const followerNotificationsTableRelations = relations(
  followerNotificationsTable,
  ({ one }) => ({
    follower: one(conversationFollowersTable, {
      fields: [followerNotificationsTable.followerId],
      references: [conversationFollowersTable.id],
    }),
    conversation: one(conversationsTable, {
      fields: [followerNotificationsTable.conversationId],
      references: [conversationsTable.id],
    }),
    user: one(usersTable, {
      fields: [followerNotificationsTable.userId],
      references: [usersTable.id],
    }),
  })
);

export type FollowerNotification = typeof followerNotificationsTable.$inferSelect;
export type NewFollowerNotification = typeof followerNotificationsTable.$inferInsert;

// Backwards compatibility export
export const followerNotifications = followerNotificationsTable;