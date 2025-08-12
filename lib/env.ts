import { createEnv } from "@t3-oss/env-nextjs";
import { vercel } from "@t3-oss/env-nextjs/presets";
import { z } from "zod";

const defaultUnlessDeployed = <V extends z.ZodString | z.ZodOptional<z.ZodString>>(value: V, testingDefault: string) =>
  ["preview", "production"].includes(process.env.VERCEL_ENV ?? "") ? value : value.default(testingDefault);

const defaultRootUrl =
  process.env.VERCEL_ENV === "production"
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : `https://${process.env.VERCEL_URL ?? "helperai.dev"}`;

// `next dev` forces NODE_ENV to "development" so we need to use a different environment variable
export const isAIMockingEnabled = process.env.IS_TEST_ENV === "1";

export const env = createEnv({
  extends: [vercel()],
  shared: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    CI: z
      .enum(["true", "false", "1", "0"])
      .default("false")
      .transform((v) => v === "true" || v === "1"),
    DISABLE_STRICT_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  },
  /**
   * Specify your server-side environment variables schema here.
   * This way you can ensure the app isn't built with invalid env vars.
   */
  server: {
    // Set this for both local development and when deploying
    OPENAI_API_KEY: isAIMockingEnabled ? z.string().min(1).default("mock-openai-api-key") : z.string().min(1), // API key from https://platform.openai.com for AI models

    // Set this before deploying
    ENCRYPT_COLUMN_SECRET: defaultUnlessDeployed(
      z.string().regex(/^[a-f0-9]{32}$/, "must be a random 32-character hex string"),
      "1234567890abcdef1234567890abcdef",
    ),

    // Set these before or after deploying for email sending and receiving
    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_FROM_ADDRESS: z.string().min(1).optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(), // Google OAuth client credentials from https://console.cloud.google.com for Gmail sync
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_PUBSUB_TOPIC_NAME: z.string().min(1).optional(), // Google PubSub for Gmail sync
    GOOGLE_PUBSUB_CLAIM_EMAIL: z.string().email().min(1).optional(),

    // Database configuration for direct PostgreSQL connection
    DATABASE_URL: defaultUnlessDeployed(
      z.string().url(),
      `postgresql://postgres:postgres@127.0.0.1:5432/helperai_db`,
    ),
    
    // JWT Authentication
    JWT_SECRET: defaultUnlessDeployed(
      z.string().min(32, "JWT secret must be at least 32 characters"),
      "your-super-secure-development-jwt-secret-key-at-least-32-characters-long",
    ),
    JWT_EXPIRES_IN: z.string().default("7d"),
    NEXT_RUNTIME: z.enum(["nodejs", "edge"]).default("nodejs"),

    // Other optional integrations

    // Slack OAuth client credentials from https://api.slack.com/apps
    SLACK_CLIENT_ID: z.string().min(1).optional(),
    SLACK_CLIENT_SECRET: z.string().min(1).optional(),
    SLACK_SIGNING_SECRET: z.string().min(1).optional(),
    // GitHub app credentials from https://github.com/apps
    GITHUB_APP_SLUG: z.string().min(1).optional(),
    GITHUB_APP_ID: z.string().min(1).optional(),
    GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
    GITHUB_PRIVATE_KEY: z.string().min(1).optional(),
    // Token from https://jina.ai for the widget to read the current page
    JINA_API_TOKEN: z.string().min(1).optional(),
    // API key from https://www.firecrawl.dev to import help docs from a website
    FIRECRAWL_API_KEY: z.string().min(1).optional(),
    // Proxy assets when rendering email content
    PROXY_URL: z.string().url().optional(),
    PROXY_SECRET_KEY: z.string().min(1).optional(),
    // Sign in with Apple credentials for integration with the desktop app
    APPLE_APP_ID: z.string().min(1).optional(),
    APPLE_TEAM_ID: z.string().min(1).optional(),
    APPLE_PRIVATE_KEY: z.string().min(1).optional(),
    APPLE_PRIVATE_KEY_IDENTIFIER: z.string().min(1).optional(),

    // Optional configuration

    // Allow automatic signups from specific domains (e.g. your company's email domain)
    EMAIL_SIGNUP_DOMAINS: z
      .string()
      .default("")
      .transform((v) => (v ? v.split(",").map((d) => d.trim()) : [])),

    // Use a separate key for the search index. Defaults to ENCRYPT_COLUMN_SECRET if not set.
    HASH_WORDS_SECRET: z.string().optional(),

    // Log SQL queries to the console
    DRIZZLE_LOGGING: z.string().optional(),

    // For running database seeds
    INITIAL_USER_EMAILS: z
      .string()
      .default("support@gumroad.com")
      .transform((v) => v.split(",")),
  },

  /**
   * Specify your client-side environment variables schema here.
   * For them to be exposed to the client, prefix them with `NEXT_PUBLIC_`.
   */
  client: {
    // Application URLs
    NEXT_PUBLIC_APP_URL: z.string().url().default(defaultRootUrl),
    NEXT_PUBLIC_API_URL: z.string().url().default(`${defaultRootUrl}/api`),

    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(), // Sentry DSN for error tracking

    // Helper host URL configuration - overrides automatic detection in e2e tests
    NEXT_PUBLIC_DEV_HOST: z.string().url().optional().default("https://helperai.dev"),
  },
  /**
   * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
   */
  experimental__runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    CI: process.env.CI,
    DISABLE_STRICT_MODE: process.env.DISABLE_STRICT_MODE,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_DEV_HOST: process.env.NEXT_PUBLIC_DEV_HOST,
  },
  skipValidation: process.env.npm_lifecycle_event === "lint" || process.env.NODE_ENV === "test",
});
