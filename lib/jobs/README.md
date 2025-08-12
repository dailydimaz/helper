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

### GET /api/jobs/stats
Get comprehensive job system statistics:

```bash
curl http://localhost:3010/api/jobs/stats
```

Response:
```json
{
  "queue": {
    "pending": 5,
    "processing": 2,
    "completed": 150,
    "failed": 3,
    "dead_letter": 1,
    "metrics": {
      "processed": 153,
      "failed": 4,
      "avgProcessingTime": 245.7,
      "lastProcessedAt": "2024-01-01T12:00:00Z"
    }
  },
  "scheduledJobs": 12
}
```

### GET /api/jobs/dashboard
Get detailed performance dashboard:

```bash
curl http://localhost:3010/api/jobs/dashboard?hours=24
```

### POST /api/jobs/trigger
Add jobs and trigger events:

```bash
# Trigger an event
curl -X POST http://localhost:3010/api/jobs/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "action": "triggerEvent",
    "event": "conversations/message.created",
    "data": { "messageId": 123 }
  }'

# Add a job directly
curl -X POST http://localhost:3010/api/jobs/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "action": "addJob",
    "type": "generateFilePreview",
    "payload": { "fileId": 123 },
    "priority": 5
  }'
```

### POST /api/jobs/stats
Manage jobs and perform maintenance:

```bash
# Clean up old jobs
curl -X POST http://localhost:3010/api/jobs/stats \
  -H "Content-Type: application/json" \
  -d '{
    "action": "cleanup",
    "olderThanHours": 168
  }'

# Retry a dead letter job
curl -X POST http://localhost:3010/api/jobs/stats \
  -H "Content-Type: application/json" \
  -d '{
    "action": "retry",
    "jobId": 123
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

### Enhanced Features (Latest Updates)

### Advanced Job Queue Features
- **Priority-based processing**: Jobs with higher priority are processed first
- **Automatic retry with exponential backoff**: Failed jobs are retried with increasing delays
- **Dead letter queue**: Jobs that exceed max retry attempts are moved to a dead letter queue
- **Comprehensive metrics**: Track processing times, success rates, and job statistics
- **Job timeout protection**: Long-running jobs are terminated after 5 minutes
- **Batch processing**: Process multiple jobs concurrently with configurable limits

### New Job Types
- **Email Processing**: `processEmailQueue`, `cleanupFailedEmails`
- **Notifications**: `sendPendingNotifications`, `cleanupOldNotifications`
- **System Maintenance**: `cleanupDanglingFiles`, `cleanupOldJobs`, `performDatabaseMaintenance`

### Enhanced APIs
- **GET /api/jobs/stats**: Comprehensive statistics and metrics
- **GET /api/jobs/dashboard**: Performance dashboard with detailed analytics
- **POST /api/jobs/trigger**: Event triggering and job management
- **POST /api/jobs/stats**: Job cleanup and retry operations

### Key Differences from Old System

1. **Enhanced reliability**: Retry logic and dead letter queue for failed jobs
2. **Better monitoring**: Comprehensive metrics and performance tracking
3. **Priority support**: Important jobs are processed first
4. **Automatic maintenance**: Built-in cleanup and optimization tasks
5. **Production ready**: Robust error handling and timeout protection

### Benefits

1. **Fault tolerant**: Jobs retry automatically on failure
2. **Monitorable**: Rich metrics and dashboard for observability
3. **Scalable**: Configurable concurrency and batch processing
4. **Maintainable**: Self-cleaning with automatic old job removal
5. **Same API**: Drop-in replacement for existing code

### Production Considerations

1. **Database maintenance**: Regular ANALYZE/VACUUM operations scheduled
2. **Memory management**: Processing metrics and scheduled jobs are memory-efficient
3. **Error handling**: Comprehensive error logging and dead letter queue management
4. **Performance monitoring**: Built-in metrics for system health assessment

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