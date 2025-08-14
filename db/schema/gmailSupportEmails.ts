import { relations } from "drizzle-orm";
import { bigint, index, integer, pgTable, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { encryptedField } from "@/db/lib/encryptedField";
import { mailboxesTable } from "@/db/schema/mailboxes";
import { withTimestamps } from "../lib/with-timestamps";

export const gmailSupportEmailsTable = pgTable(
  "mailboxes_gmailsupportemail",
  {
    ...withTimestamps,
    id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    email: varchar({ length: 254 }).notNull(),
    expiresAt: timestamp({ withTimezone: true, mode: "date" }),
    historyId: integer(),
    unused_accessToken: encryptedField("encrypted_access_token"),
    accessToken: text("access_token"),
    unused_refreshToken: encryptedField("encrypted_refresh_token"),
    refreshToken: text("refresh_token"),
  },
  (table) => [
    index("mailboxes_gmailsupportemail_created_at_321a00f1").on(table.createdAt),
    // Drizzle doesn't generate migrations with `text_pattern_ops`; they only have `text_ops`
    index("mailboxes_supportemail_email_99536dd8_like").on(table.email),
    unique("mailboxes_supportemail_email_key").on(table.email),
  ],
).enableRLS();

export const gmailSupportEmailsTableRelations = relations(gmailSupportEmailsTable, ({ many }) => ({
  mailboxes: many(mailboxesTable),
}));

// Backwards compatibility export
export const gmailSupportEmails = gmailSupportEmailsTable;
