// Sentry removed for local development
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { gmailSupportEmails, mailboxes } from "@/db/schema";
import { getGmailService, subscribeToMailbox } from "@/lib/gmail/client";

export const renewMailboxWatches = async () => {
  const supportEmails = await db
    .select({
      accessToken: gmailSupportEmails.accessToken,
      refreshToken: gmailSupportEmails.refreshToken,
    })
    .from(mailboxes)
    .innerJoin(gmailSupportEmails, eq(mailboxes.gmailSupportEmailId, gmailSupportEmails.id));

  for (const supportEmail of supportEmails) {
    try {
      await subscribeToMailbox(getGmailService(supportEmail));
    } catch (error) {
      console.error('[Sentry Mock] Error:', error);
    }
  }
};
