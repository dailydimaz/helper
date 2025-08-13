import { env } from "@/lib/env";

export const captureExceptionAndThrowIfDevelopment = (
  error: any,
  hint?: any,
) => {
  console.error('[Sentry Mock] Error:', error, hint);
  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") throw error;
  // eslint-disable-next-line no-console
  else console.error(error, hint);
};

export const captureExceptionAndLog = (
  error: any,
  hint?: any,
) => {
  // eslint-disable-next-line no-console
  console.error(error, hint);
  console.error('[Sentry Mock] Error:', error, hint);
};
