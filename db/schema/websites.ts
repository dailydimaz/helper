import { relations } from "drizzle-orm";
import { bigint, index, jsonb, pgTable, text, timestamp, varchar, vector } from "drizzle-orm/pg-core";
import { withTimestamps } from "../lib/with-timestamps";
import { mailboxesTable } from "./mailboxes";

export interface CrawlMetadata {
  crawlIdentifier?: string;
  firecrawlJobId?: string;
  webhookSecret?: string;
  pageCount?: number;
  creditsUsed?: number;
}

export const websitesTable = pgTable(
  "website_docs",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    unused_mailboxId: bigint("mailbox_id", { mode: "number" })
      .notNull()
      .$defaultFn(() => 0),
    name: varchar("name", { length: 255 }).notNull(),
    url: text("url").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("websites_created_at_idx").on(table.createdAt),
    index("websites_mailbox_id_idx").on(table.unused_mailboxId),
    index("websites_url_idx").on(table.url),
  ],
).enableRLS();

export const websitePagesTable = pgTable(
  "website_docs_pages",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    websiteId: bigint({ mode: "number" }).notNull(),
    websiteCrawlId: bigint({ mode: "number" }).notNull(),
    url: text("url").notNull(),
    rawHtml: text("raw_html").notNull(),
    markdown: text("markdown").notNull(),
    pageTitle: text("page_title").notNull(),
    metadata: jsonb("metadata"),
    embedding: vector({ dimensions: 1536 }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("website_pages_created_at_idx").on(table.createdAt),
    index("website_pages_website_id_idx").on(table.websiteId),
    index("website_pages_website_crawl_id_idx").on(table.websiteCrawlId),
    index("website_pages_url_idx").on(table.url),
    index("website_pages_embedding_index").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
  ],
).enableRLS();

export const websiteCrawlsTable = pgTable(
  "website_docs_crawls",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    websiteId: bigint({ mode: "number" }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    metadata: jsonb("metadata").$type<CrawlMetadata>(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("website_crawls_created_at_idx").on(table.createdAt),
    index("website_crawls_website_id_idx").on(table.websiteId),
    index("website_crawls_status_idx").on(table.status),
  ],
).enableRLS();

export const websitesTableRelations = relations(websitesTable, ({ one, many }) => ({
  mailbox: one(mailboxesTable, {
    fields: [websitesTable.unused_mailboxId],
    references: [mailboxesTable.id],
  }),
  pages: many(websitePagesTable),
  crawls: many(websiteCrawlsTable),
}));

export const websitePagesTableRelations = relations(websitePagesTable, ({ one }) => ({
  website: one(websitesTable, {
    fields: [websitePagesTable.websiteId],
    references: [websitesTable.id],
  }),
  crawl: one(websiteCrawlsTable, {
    fields: [websitePagesTable.websiteCrawlId],
    references: [websiteCrawlsTable.id],
  }),
}));

export const websiteCrawlsTableRelations = relations(websiteCrawlsTable, ({ one }) => ({
  website: one(websitesTable, {
    fields: [websiteCrawlsTable.websiteId],
    references: [websitesTable.id],
  }),
}));

// Backwards compatibility exports
export const websites = websitesTable;
export const websitePages = websitePagesTable;
export const websiteCrawls = websiteCrawlsTable;
