import { relations } from "drizzle-orm";
import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { withTimestamps } from "../lib/with-timestamps";
import { faqsTable } from "./faqs";
import { gmailSupportEmailsTable } from "./gmailSupportEmails";
import { mailboxesMetadataApiTable } from "./mailboxesMetadataApi";

export const mailboxesTable = pgTable(
  "mailboxes_mailbox",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    name: text().notNull(),
    slug: varchar({ length: 50 }).notNull(),
    gmailSupportEmailId: bigint({ mode: "number" }),
    slackAlertChannel: text("slack_escalation_channel"),
    slackBotToken: text(),
    slackBotUserId: text(),
    slackTeamId: text(),
    githubInstallationId: text(),
    githubRepoOwner: text(),
    githubRepoName: text(),
    promptUpdatedAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    widgetHMACSecret: varchar({ length: 255 }).notNull(),
    widgetDisplayMode: text().$type<"always" | "revenue_based" | "off">().notNull().default("always"),
    widgetDisplayMinValue: bigint({ mode: "number" }),
    widgetHost: text(),
    vipThreshold: bigint({ mode: "number" }),
    vipChannelId: text(),
    vipExpectedResponseHours: integer(),
    isWhitelabel: boolean().notNull().default(false),
    autoCloseEnabled: boolean().notNull().default(false),
    autoCloseDaysOfInactivity: integer().notNull().default(14),
    chatIntegrationUsed: boolean().notNull().default(false),
    preferences: jsonb()
      .$type<{
        confetti?: boolean;
        autoRespondEmailToChat?: "draft" | "reply" | null;
        disableTicketResponseTimeAlerts?: boolean;
      }>()
      .default({}),
  },
  (table) => [
    index("mailboxes_mailbox_created_at_5d4ea7d0").on(table.createdAt),
    unique("mailboxes_mailbox_slug_key").on(table.slug),
    unique("mailboxes_mailbox_support_email_id_key").on(table.gmailSupportEmailId),
  ],
).enableRLS();

export const mailboxesTableRelations = relations(mailboxesTable, ({ one, many }) => ({
  mailboxesMetadataApi: one(mailboxesMetadataApiTable),
  gmailSupportEmail: one(gmailSupportEmailsTable, {
    fields: [mailboxesTable.gmailSupportEmailId],
    references: [gmailSupportEmailsTable.id],
  }),
  faqs: many(faqsTable),
}));

// Backwards compatibility export
export const mailboxes = mailboxesTable;
