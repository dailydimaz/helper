import { getMailbox } from "@/lib/data/mailbox";
import { getLogin } from "@/lib/cookie";

export async function requireMailboxAccess() {
  const user = await getLogin();
  if (!user) {
    throw new Error("Authentication required");
  }

  const mailbox = await getMailbox();
  if (!mailbox) {
    throw new Error("Mailbox not found");
  }

  return { user, mailbox };
}