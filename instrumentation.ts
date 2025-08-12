import * as Sentry from "@sentry/nextjs";
import { registerOTel } from "@vercel/otel";
import { env } from "@/lib/env";
import { initializeJobSystem } from "@/lib/jobs/startup";
import { initializeStorage } from "@/lib/files/storage";

export async function register() {
  if (env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/sentry/server-config");
    
    // Initialize the lightweight job system in Node.js runtime only
    if (process.env.NODE_ENV !== 'test') {
      initializeJobSystem();
    }
    
    // Initialize file storage system
    await initializeStorage();
  }

  if (env.NEXT_RUNTIME === "edge") {
    await import("@/lib/sentry/edge-config");
  }

  registerOTel({
    serviceName: "helper",
  });
}

export const onRequestError = Sentry.captureRequestError;
