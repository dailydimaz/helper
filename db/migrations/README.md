# Database Migration: Remove PostgreSQL Extensions

This migration removes the dependency on PostgreSQL extensions that are not available in standard PostgreSQL installations, making the application compatible with basic PostgreSQL 14+ deployments.

## Extensions Removed

### 1. pgmq (PostgreSQL Message Queue)
- **What it was used for**: Job queuing system
- **Replacement**: Lightweight job system using the `jobs` table
- **Location**: `/Users/dmzmzmd/helper/lib/jobs/`

### 2. pg_cron (PostgreSQL Cron)
- **What it was used for**: Scheduled job execution
- **Replacement**: Application-level scheduling with `setTimeout` and `setInterval`
- **Location**: `/Users/dmzmzmd/helper/lib/jobs/scheduler.ts`

### 3. http (PostgreSQL HTTP Extension)
- **What it was used for**: Making HTTP requests from PostgreSQL functions
- **Replacement**: Application-level HTTP requests with logging to `http_requests` table
- **Location**: `/Users/dmzmzmd/helper/db/lib/lightweightCronUtils.ts`

### 4. pg_trgm (Trigram Extension)
- **What it was used for**: Fuzzy text searching on email fields
- **Replacement**: Standard B-tree indexes (less powerful but universally available)
- **Impact**: Slightly reduced search performance for email fuzzy matching

## Migration Files

### 1. `0112_remove_extensions.sql`
Main migration that:
- Safely removes extension-dependent functions and structures
- Creates new tables for lightweight job system
- Replaces trigram indexes with standard B-tree indexes
- Handles cleanup gracefully if extensions don't exist

### 2. Updated Schema Files
- `db/schema/jobs.ts`: Enhanced with retry logic and HTTP request tracking
- `db/schema/platformCustomers.ts`: Replaced trigram index with standard index

### 3. New Utility Files
- `db/lib/lightweightCronUtils.ts`: Extension-free cron and HTTP utilities
- `db/setupLightweightCron.ts`: Replacement setup script
- `db/test-migration.ts`: Validation script

## Running the Migration

### Standard Migration
```bash
pnpm db:migrate
```

This now uses the lightweight setup instead of extension-dependent setup.

### Testing the Migration
```bash
pnpm tsx db/test-migration.ts
```

This validates that the migration works without extensions.

### Legacy Support
If you need to run the old extension-based setup:
```bash
pnpm db:legacy:setup-cron
```

## Architecture Changes

### Before (Extension-Dependent)
```
PostgreSQL with extensions:
├── pgmq for job queuing
├── pg_cron for scheduling
├── http for external requests
└── pg_trgm for fuzzy search
```

### After (Extension-Free)
```
Standard PostgreSQL + Application Logic:
├── jobs table for queuing
├── setTimeout/setInterval for scheduling  
├── fetch() for external requests
├── http_requests table for logging
└── B-tree indexes for search
```

## Compatibility

### Supported PostgreSQL Versions
- PostgreSQL 14+
- No extensions required
- Works on all cloud providers (AWS RDS, Google Cloud SQL, Azure Database, etc.)
- Compatible with managed PostgreSQL services

### Performance Considerations
1. **Job Processing**: Slightly higher latency (5-second polling vs real-time)
2. **Email Search**: Standard B-tree vs trigram (exact matches work the same)
3. **HTTP Logging**: New feature that improves debugging
4. **Memory Usage**: Lower (no extension overhead)

### Feature Compatibility
- ✅ All core functionality preserved
- ✅ Job scheduling works the same
- ✅ Database searches work (with minor performance difference)
- ✅ HTTP requests work with better logging
- ✅ Graceful degradation if extensions are present

## Troubleshooting

### Migration Fails
1. Check PostgreSQL version (needs 14+)
2. Ensure user has CREATE/DROP permissions
3. Run test script to identify specific issues

### Job Processing Issues
1. Verify the job system is started: `initializeJobSystem()`
2. Check job table for stuck jobs
3. Monitor HTTP requests table for failed external calls

### Search Performance Issues
1. Verify B-tree indexes are created
2. Consider adding more specific indexes for common queries
3. Use `LIKE` with leading wildcards sparingly

## Rollback

To rollback this migration (not recommended):

1. Restore extension-dependent functions
2. Recreate PGMQ queues
3. Restore pg_cron jobs
4. Switch back to `db:legacy:setup-cron`

Note: Rollback requires the extensions to be available on your PostgreSQL instance.

## Benefits of This Migration

1. **Universal Compatibility**: Works on any PostgreSQL 14+ instance
2. **Reduced Complexity**: No extension management required
3. **Better Debugging**: HTTP request logging improves troubleshooting
4. **Cloud Ready**: Compatible with all managed PostgreSQL services
5. **Maintenance Free**: No extension updates or compatibility issues

## Files Modified

- `package.json`: Updated migration scripts
- `db/schema/jobs.ts`: Enhanced job table schema
- `db/schema/platformCustomers.ts`: Replaced trigram index
- `db/lib/lightweightCronUtils.ts`: New extension-free utilities
- `db/setupLightweightCron.ts`: New setup script
- `db/migrations/0112_remove_extensions.sql`: Main migration
- `db/test-migration.ts`: Validation script

## Next Steps

After running this migration:

1. Test your application thoroughly
2. Monitor job processing performance
3. Verify email search functionality
4. Check HTTP request logs for any issues
5. Update deployment scripts to remove extension requirements

The application should now work seamlessly with standard PostgreSQL without any extensions.