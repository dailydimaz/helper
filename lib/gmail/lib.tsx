import { render } from "@react-email/render";
import { and, desc, isNotNull, isNull } from "drizzle-orm";
import { htmlToText } from "html-to-text";
import MailComposer from "nodemailer/lib/mail-composer";
import { db } from "@/db/client";
import { conversationMessagesTable, conversationsTable, filesTable } from "@/db/schema";
import { getFirstName } from "@/lib/auth/authUtils";
import { downloadFile } from "@/lib/data/files";
import { getBasicProfileById } from "@/lib/data/user";
import AIReplyEmail from "@/lib/emails/aiReply";

export const convertConversationMessageToRaw = async (
  email: typeof conversationMessagesTable.$inferSelect & {
    conversation: typeof conversationsTable.$inferSelect & {
      emailFrom: string;
    };
    files: (typeof filesTable.$inferSelect)[];
  },
  emailFrom: string,
  composerOptions?: ConstructorParameters<typeof MailComposer>[0],
) => {
  const attachments = await Promise.all(
    email.files
      .filter((file) => !file.isInline)
      .map(async (file) => {
        return {
          filename: file.name,
          content: Buffer.from(await downloadFile(file)),
          contentType: file.mimetype,
        };
      }),
  );

  const lastEmailWithMessageId = await db.query.conversationMessagesTable.findFirst({
    where: and(isNull(conversationMessagesTable.deletedAt), isNotNull(conversationMessagesTable.messageId)),
    orderBy: desc(conversationMessagesTable.id),
  });

  let html;
  let text;

  if (email.role === "ai_assistant") {
    const reactEmail = <AIReplyEmail content={email.body ?? ""} />;
    html = await render(reactEmail);
    text = await render(reactEmail, { plainText: true });
  } else {
    html = email.body ?? undefined;
    const user = email.userId ? await getBasicProfileById(email.userId) : null;

    if (html && user?.displayName) {
      html += `<p>Best,<br />${getFirstName(user)}</p>`;
    }
    text = html ? htmlToText(html) : undefined;
  }

  const message = new MailComposer({
    from: emailFrom,
    to: email.conversation.emailFrom,
    subject: email.conversation.subject ?? undefined,
    cc: email.emailCc ?? [],
    bcc: email.emailBcc ?? [],
    inReplyTo: lastEmailWithMessageId?.messageId ?? undefined,
    references: lastEmailWithMessageId?.references ?? undefined,
    html,
    text,
    attachments,
    textEncoding: "base64",
    ...composerOptions,
  });

  const msg = await new Promise<Buffer>((resolve, reject) => {
    message.compile().build((err, msg) => {
      if (err) reject(err);
      else resolve(msg);
    });
  });

  return Buffer.from(msg).toString("base64url");
};
