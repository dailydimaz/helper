import "@/app/globals.css";
import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Suspense } from "react";
import { AppSidebar } from "@/app/(dashboard)/appSidebar";
import InboxClientLayout from "@/app/(dashboard)/clientLayout";
import { StandaloneDisplayIntegration } from "@/app/(dashboard)/standaloneDisplayIntegration";
import { SentryContext } from "@/components/sentryContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { AppContextProvider } from "@/hooks/use-app";
import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  title: "Helper™ Community Edition",
  description: "AI powered assistant - derived from Gumroad, Inc. Helper™ software",
  icons: [
    {
      rel: "icon",
      type: "image/x-icon",
      url: "/favicon.ico",
    },
  ],
  itunes: {
    appId: "6739270977",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <Toaster richColors />
      <AppContextProvider basePath="">
        <TRPCReactProvider>
          <StandaloneDisplayIntegration />
          <SentryContext />
        <SidebarProvider>
          <InboxClientLayout>
            <div className="flex h-svh w-full">
              <Suspense>
                <AppSidebar />
              </Suspense>
              <main className="flex-1 min-w-0">{children}</main>
            </div>
          </InboxClientLayout>
        </SidebarProvider>
        </TRPCReactProvider>
      </AppContextProvider>
    </NuqsAdapter>
  );
}
