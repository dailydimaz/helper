import { redirect } from "next/navigation";
import { getAllMailboxes } from "@/lib/data/mailbox";
import { getLogin } from "@/lib/cookie";

const Page = async () => {
  const user = await getLogin();
  if (!user) return redirect("/login");

  const mailboxes = await getAllMailboxes();
  if (mailboxes.length > 0) {
    return redirect("/mine");
  }

  return redirect("/login");
};

export default Page;
