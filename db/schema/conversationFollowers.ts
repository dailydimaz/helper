import { relations } from "drizzle-orm";
import { bigint, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { conversationsTable } from "./conversations";
import { usersTable } from "./users";

export const conversationFollowersTable = pgTable(
  "conversation_followers",
  {
    id: uuid().defaultRandom().primaryKey(),
    conversationId: bigint("conversation_id", { mode: "number" })
      .notNull()
      .references(() => conversationsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("unique_conversation_follower").on(table.conversationId, table.userId),
  ]
);

export const conversationFollowersTableRelations = relations(
  conversationFollowersTable,
  ({ one }) => ({
    conversation: one(conversationsTable, {
      fields: [conversationFollowersTable.conversationId],
      references: [conversationsTable.id],
    }),
    user: one(usersTable, {
      fields: [conversationFollowersTable.userId],
      references: [usersTable.id],
    }),
  })
);

// Add relation to conversations table
export const conversationsTableFollowersRelations = relations(conversationsTable, ({ many }) => ({
  followers: many(conversationFollowersTable),
}));

// Add relation to users table
export const usersTableFollowersRelations = relations(usersTable, ({ many }) => ({
  followedConversations: many(conversationFollowersTable),
}));

export type ConversationFollower = typeof conversationFollowersTable.$inferSelect;
export type NewConversationFollower = typeof conversationFollowersTable.$inferInsert;

// Backwards compatibility export
export const conversationFollowers = conversationFollowersTable;