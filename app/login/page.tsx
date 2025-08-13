import { LoginForm } from "@/app/login/loginForm";
import { OnboardingForm } from "@/app/login/onboardingForm";
import { db } from "@/db/client";
import { mailboxes } from "@/db/schema/mailboxes";
import { AppContextProvider } from "@/hooks/use-app";

export const dynamic = "force-dynamic";

export default async function Page() {
  let mailbox: any[] = [];
  try {
    mailbox = await db.select({ id: mailboxes.id }).from(mailboxes).limit(1);
  } catch (error) {
    console.error('Database query failed:', error);
    // Continue with empty array to show onboarding form
  }

  return (
    <AppContextProvider basePath="">
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">{mailbox.length > 0 ? <LoginForm /> : <OnboardingForm />}</div>
      </div>
    </AppContextProvider>
  );
}
