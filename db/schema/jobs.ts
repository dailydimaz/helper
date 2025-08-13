import { integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const jobsTable = pgTable("jobs", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  type: varchar({ length: 255 }).notNull(),
  payload: jsonb("payload"),
  status: varchar({ length: 50 }).notNull().default('pending'),
  scheduledFor: timestamp("scheduled_for").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  attempts: integer().default(0),
  maxAttempts: integer("max_attempts").default(3),
  lastError: text("last_error"),
});

// HTTP requests table for lightweight HTTP functionality
export const httpRequestsTable = pgTable("http_requests", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  url: text().notNull(),
  method: varchar({ length: 10 }).notNull().default('GET'),
  headers: jsonb(),
  body: text(),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  responseHeaders: jsonb("response_headers"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
});

export type Job = typeof jobsTable.$inferSelect;
export type NewJob = typeof jobsTable.$inferInsert;

export type HttpRequest = typeof httpRequestsTable.$inferSelect;
export type NewHttpRequest = typeof httpRequestsTable.$inferInsert;

// Backwards compatibility exports
export const jobs = jobsTable;
export const httpRequests = httpRequestsTable;