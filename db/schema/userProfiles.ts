import { relations } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type AccessRole = "afk" | "core" | "nonCore";

// Created automatically when a user is inserted via a Postgres trigger. See db/drizzle/0101_little_arclight.sql
export const userProfilesTable = pgTable("user_profiles", {
  id: uuid()
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  displayName: text().default(""),
  permissions: text().notNull().default("member"), // "member" or "admin"
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp().defaultNow(),
  updatedAt: timestamp()
    .defaultNow()
    .$onUpdate(() => new Date()),
  access: jsonb("access")
    .$type<{
      role: AccessRole;
      keywords: string[];
    }>()
    .default({ role: "afk", keywords: [] }),
  pinnedIssueGroupIds: jsonb("pinned_issue_group_ids").$type<number[]>().default([]),
}).enableRLS();

export const userProfilesTableRelations = relations(userProfilesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userProfilesTable.id],
    references: [usersTable.id],
  }),
}));

export type BasicUserProfile = { id: string; displayName: string | null; email: string | null };
export type FullUserProfile = typeof userProfilesTable.$inferSelect & { email: string | null };
