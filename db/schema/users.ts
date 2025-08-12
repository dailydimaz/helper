import { relations } from "drizzle-orm";
import { boolean, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid().defaultRandom().primaryKey(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: text().notNull(), // Will be hashed with argon2
  displayName: text().default(""),
  permissions: text().notNull().default("member"), // "member" or "admin"
  emailVerified: boolean("email_verified").default(false),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
  access: jsonb("access")
    .$type<{
      role: "afk" | "core" | "nonCore";
      keywords: string[];
    }>()
    .default({ role: "afk", keywords: [] }),
  pinnedIssueGroupIds: jsonb("pinned_issue_group_ids").$type<number[]>().default([]),
});

export const userSessionsTable = pgTable("user_sessions", {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  token: text().notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const userIdentitiesTable = pgTable("user_identities", {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  provider: text().notNull(), // "google", "github", "slack", etc.
  providerId: text("provider_id").notNull(),
  providerData: jsonb("provider_data").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const usersTableRelations = relations(usersTable, ({ many }) => ({
  sessions: many(userSessionsTable),
  identities: many(userIdentitiesTable),
}));

export const userSessionsTableRelations = relations(userSessionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userSessionsTable.userId],
    references: [usersTable.id],
  }),
}));

export const userIdentitiesTableRelations = relations(userIdentitiesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userIdentitiesTable.userId],
    references: [usersTable.id],
  }),
}));

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type UserSession = typeof userSessionsTable.$inferSelect;
export type UserIdentity = typeof userIdentitiesTable.$inferSelect;

export type BasicUserProfile = { 
  id: string; 
  displayName: string | null; 
  email: string | null; 
};

export type FullUserProfile = User;

// Legacy compatibility types
export type DbOrAuthUser = {
  id: string;
  email?: string | null;
  user_metadata: Record<string, any> | null;
};