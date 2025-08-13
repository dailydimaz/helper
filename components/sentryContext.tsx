"use client";

// Sentry removed for local development
import { useEffect } from "react";
import { useSession } from "@/components/useSession";

export const SentryContext = () => {
  const { user } = useSession() ?? {};
  useEffect(() => {
    // Sentry.setUser removed for local development
    console.log('[Sentry Mock] User context:', { id: user?.id, email: user?.email ?? undefined });
  }, [user]);

  return null;
};
