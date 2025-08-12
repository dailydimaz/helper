# Lightweight Job System

A simplified, database-based job queue system that replaces the complex PGMQ + PostgreSQL cron setup with setTimeout-based scheduling.

## Overview

The lightweight job system consists of:

1. **Database Table** (`jobs`): Simple table to track job state
2. **Job Queue**: In-memory queue processor using setTimeout
3. **Job Scheduler**: setTimeout-based recurring job scheduling
4. **Event Trigger System**: Same API as the original system

## Architecture

```
Event Triggered → Job Queue → Job Processor → Lightweight Job Handler
     ↓               ↓             ↓              ↓
 Original API    Database      setTimeout    Simplified Logic
```

## Key Files

- `db/schema/jobs.ts` - Database schema for the jobs table
- `lib/jobs/queue.ts` - Job queue manager
- `lib/jobs/processor.ts` - Job processing logic
- `lib/jobs/scheduler.ts` - setTimeout-based scheduling
- `lib/jobs/trigger.ts` - Event triggering (same API as original)
- `lib/jobs/startup.ts` - System initialization and recurring jobs
- `jobs/lightweight/` - Simplified job implementations

## Usage

### Triggering Events (Same API as before)

```typescript
import { triggerEvent } from "@/lib/jobs";

// Trigger an event (creates multiple jobs automatically)
await triggerEvent("conversations/message.created", { messageId: 123 });

// Trigger with delay
await triggerEvent("files/preview.generate", { fileId: 456 }, { sleepSeconds: 30 });
```

### Adding Jobs Directly

```typescript
import { jobQueue } from "@/lib/jobs";

// Add immediate job
await jobQueue.addJob("generateFilePreview", { fileId: 123 });

// Add scheduled job
const scheduledFor = new Date(Date.now() + 60000); // 1 minute from now
await jobQueue.addJob("embeddingFaq", { faqId: 456 }, scheduledFor);
```

### Scheduling Recurring Jobs

```typescript
import { scheduleHelpers } from "@/lib/jobs";

// Schedule daily at 2 PM
scheduleHelpers.daily("generateDailyReports", {}, 14, "daily-reports");

// Schedule hourly
scheduleHelpers.hourly("cleanupDanglingFiles", {}, "cleanup-hourly");

// Schedule weekly on Monday at 9 AM
scheduleHelpers.weekly("generateWeeklyReports", {}, 1, 9, "weekly-reports");
```

## Job Types

All job types from the original system are supported:

### Event Jobs
- `generateFilePreview`
- `embeddingFaq`
- `embeddingConversation`
- `handleAutoResponse`
- `postEmailToGmail`
- `indexConversationMessage`
- And many more...

### Scheduled Jobs
- `bulkEmbeddingClosedConversations` - Daily at 7 PM
- `cleanupDanglingFiles` - Hourly
- `closeInactiveConversations` - Hourly
- `renewMailboxWatches` - Daily at midnight
- And more...

## API Endpoint

### GET /api/jobs
Get job system statistics:

```bash
curl http://localhost:3010/api/jobs
```

Response:
```json
{
  "queue": {
    "pending": 5,
    "processing": 2,
    "completed": 150,
    "failed": 3
  },
  "scheduledJobs": 12
}
```

### POST /api/jobs
Add a job manually:

```bash
curl -X POST http://localhost:3010/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generateFilePreview",
    "payload": { "fileId": 123 },
    "scheduledFor": "2024-01-01T12:00:00Z"
  }'
```

## Initialization

The job system is automatically initialized when the application starts via `instrumentation.ts`. No manual setup required.

For manual initialization (e.g., in scripts):

```typescript
import { initializeJobSystem, shutdownJobSystem } from "@/lib/jobs";

// Start the system
initializeJobSystem();

// Graceful shutdown
process.on('SIGINT', () => {
  shutdownJobSystem();
  process.exit(0);
});
```

## Migration from Old System

The new system maintains the same trigger API, so existing code should work without changes:

```typescript
// This still works exactly the same
await triggerEvent("conversations/message.created", { messageId: 123 });
```

### Key Differences

1. **No PGMQ**: Uses simple database table instead
2. **No PostgreSQL cron**: Uses setTimeout for scheduling
3. **Simplified jobs**: Lightweight implementations in `jobs/lightweight/`
4. **In-process**: Jobs run in the same process (suitable for development)

### Benefits

1. **Simpler**: No external dependencies or complex database functions
2. **Easier debugging**: Jobs run in the same process
3. **Faster development**: No database setup or migrations for job system
4. **Same API**: Drop-in replacement for existing code

### Limitations

1. **Single process**: Jobs stop if the application stops
2. **Memory-based**: Scheduled jobs are lost on restart
3. **No distributed processing**: Runs on single instance only

## Development

### Running the Demo

```bash
pnpm tsx lib/jobs/demo.ts
```

### Adding New Jobs

1. Create job handler in `jobs/lightweight/`
2. Add to exports in `jobs/lightweight/index.ts`
3. Add event mapping in `lib/jobs/trigger.ts` if needed

### Job Handler Template

```typescript
export const myNewJob = async (payload: { id: number }) => {
  const { id } = payload;
  
  try {
    // Your job logic here
    console.log(`Processing job for ID: ${id}`);
    
    // Job completed successfully
  } catch (error) {
    // Job failed - error will be logged automatically
    throw error;
  }
};
```