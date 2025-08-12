-- Migration to remove PostgreSQL extension dependencies
-- This migration removes extension-dependent features and replaces them with lightweight alternatives

-- Remove cron jobs first
DO $$
BEGIN
    -- Remove cron jobs if the extension exists
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname IS NOT NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if pg_cron extension doesn't exist
    NULL;
END $$;

-- Drop functions that depend on extensions
DROP FUNCTION IF EXISTS call_job_endpoint(text, text);
DROP FUNCTION IF EXISTS process_jobs();

-- Remove PGMQ queue if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgmq') THEN
        PERFORM pgmq.drop_queue('jobs');
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if pgmq extension doesn't exist
    NULL;
END $$;

-- Create a simple jobs table for the lightweight job system
-- This replaces the PGMQ functionality
CREATE TABLE IF NOT EXISTS "jobs" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "type" varchar(255) NOT NULL,
    "payload" jsonb,
    "status" varchar(50) NOT NULL DEFAULT 'pending',
    "scheduled_for" timestamp DEFAULT NOW(),
    "created_at" timestamp DEFAULT NOW(),
    "updated_at" timestamp DEFAULT NOW(),
    "attempts" integer DEFAULT 0,
    "max_attempts" integer DEFAULT 3,
    "last_error" text
);

-- Create index for job processing
CREATE INDEX IF NOT EXISTS "jobs_status_scheduled_idx" ON "jobs" ("status", "scheduled_for");
CREATE INDEX IF NOT EXISTS "jobs_type_idx" ON "jobs" ("type");
CREATE INDEX IF NOT EXISTS "jobs_created_at_idx" ON "jobs" ("created_at");

-- Update jobs table if it already exists
DO $$
BEGIN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'attempts') THEN
        ALTER TABLE "jobs" ADD COLUMN "attempts" integer DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'max_attempts') THEN
        ALTER TABLE "jobs" ADD COLUMN "max_attempts" integer DEFAULT 3;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'last_error') THEN
        ALTER TABLE "jobs" ADD COLUMN "last_error" text;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if table modifications fail
    NULL;
END $$;

-- Create a simple HTTP request log table to replace http extension functionality
CREATE TABLE IF NOT EXISTS "http_requests" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "url" text NOT NULL,
    "method" varchar(10) NOT NULL DEFAULT 'GET',
    "headers" jsonb,
    "body" text,
    "response_status" integer,
    "response_body" text,
    "response_headers" jsonb,
    "created_at" timestamp DEFAULT NOW(),
    "completed_at" timestamp,
    "error_message" text
);

-- Create indexes for http_requests
CREATE INDEX IF NOT EXISTS "http_requests_created_at_idx" ON "http_requests" ("created_at");
CREATE INDEX IF NOT EXISTS "http_requests_status_idx" ON "http_requests" ("response_status");

-- Replace pg_trgm index with standard B-tree index for email searches
-- This provides similar functionality without requiring the pg_trgm extension
DO $$
BEGIN
    -- Drop the old pg_trgm index if it exists
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'mailboxes_platformcustomer_email_ilike') THEN
        DROP INDEX CONCURRENTLY IF EXISTS "mailboxes_platformcustomer_email_ilike";
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if the index doesn't exist or can't be dropped
    NULL;
END $$;

-- Create replacement B-tree index for email searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS "mailboxes_platformcustomer_email_idx" 
    ON "mailboxes_platformcustomer" ("email");

COMMIT;