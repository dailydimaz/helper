import { createHmacSha256, createHmacSha256Base64, timingSafeEqual } from './crypto-utils';

export type HelperAuthParams = {
  email: string;
  hmacSecret?: string;
};

export class HelperAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HelperAuthError";
  }
}

/**
 * Validates email format using a regular expression
 * @param email Email address to validate
 * @returns true if email is valid, false otherwise
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generates authentication parameters required for Helper widget
 * @param params Object containing email and optional HMAC secret
 * @returns Object with email, timestamp, and HMAC hash
 * @throws HelperAuthError if HMAC secret is not provided or if input validation fails
 */
export async function generateHelperAuth({ email, hmacSecret }: HelperAuthParams) {
  if (!email) {
    throw new HelperAuthError("Email is required");
  }

  if (!isValidEmail(email)) {
    throw new HelperAuthError("Invalid email format");
  }

  const finalHmacSecret = hmacSecret || (typeof process !== 'undefined' ? process.env?.HELPER_HMAC_SECRET : undefined);
  if (!finalHmacSecret) {
    throw new HelperAuthError("HMAC secret must be provided via parameter or HELPER_HMAC_SECRET environment variable");
  }

  const timestamp = Date.now();

  const hmac = await createHmacSha256(finalHmacSecret, `${email}:${timestamp}`);

  return {
    email,
    timestamp,
    emailHash: hmac,
  };
}

export async function verifyHmac(jsonBody: unknown, authorizationHeader: string | null | undefined, hmacSecret: string) {
  if (
    !jsonBody ||
    typeof jsonBody !== "object" ||
    !("requestTimestamp" in jsonBody) ||
    typeof jsonBody.requestTimestamp !== "number" ||
    !("email" in jsonBody) ||
    typeof jsonBody.email !== "string" ||
    !("parameters" in jsonBody) ||
    typeof jsonBody.parameters !== "object"
  ) {
    throw new Error("Invalid JSON body for Helper HMAC verification");
  }

  if (Math.floor(Date.now() / 1000) - jsonBody.requestTimestamp > 5 * 60) {
    throw new Error("Request timestamp is too old for Helper HMAC verification");
  }

  const hmacSignatureFromBody = await createHmacSha256Base64(hmacSecret, JSON.stringify(jsonBody));

  if (!timingSafeEqual(hmacSignatureFromBody, authorizationHeader?.split(" ")[1] ?? "")) {
    throw new Error("Invalid HMAC signature for Helper HMAC verification");
  }
}
