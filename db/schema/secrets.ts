import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const secretsTable = pgTable("secrets", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull().unique(),
  encryptedValue: text("encrypted_value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
});