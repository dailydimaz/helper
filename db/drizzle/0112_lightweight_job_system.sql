-- Migration to create lightweight job system without PostgreSQL extensions
-- This replaces pgmq, pg_cron, and http extension functionality

-- Create jobs table for lightweight job queue
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"type" varchar(255) NOT NULL,
	"payload" jsonb,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"scheduled_for" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 3,
	"last_error" text
);
--> statement-breakpoint

-- Create indexes for efficient job processing
CREATE INDEX IF NOT EXISTS "jobs_status_scheduled_idx" ON "jobs" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_type_idx" ON "jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_created_at_idx" ON "jobs" USING btree ("created_at");--> statement-breakpoint

-- Create http_requests table for logging HTTP requests
CREATE TABLE IF NOT EXISTS "http_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"url" text NOT NULL,
	"method" varchar(10) DEFAULT 'GET' NOT NULL,
	"headers" jsonb,
	"body" text,
	"response_status" integer,
	"response_body" text,
	"response_headers" jsonb,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"error_message" text
);
--> statement-breakpoint

-- Create indexes for http_requests table
CREATE INDEX IF NOT EXISTS "http_requests_created_at_idx" ON "http_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "http_requests_status_idx" ON "http_requests" USING btree ("response_status");--> statement-breakpoint

-- Clean up any remaining extension dependencies
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
--> statement-breakpoint

-- Drop extension-dependent functions
DROP FUNCTION IF EXISTS call_job_endpoint(text, text);--> statement-breakpoint
DROP FUNCTION IF EXISTS process_jobs();--> statement-breakpoint

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