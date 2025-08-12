# Urgent Tasks for Lightweight Conversion & Database Migration

Based on analysis of the migration documentation files, the following critical blocking issues must be resolved to make the lightweight version functional. These tasks focus ONLY on making the application run, not enhancements.

## CRITICAL PRIORITY TASKS (Must be completed first)

### Task 1: Remove Supabase Dependencies
**Urgency:** CRITICAL  
**Subagent:** Code Analysis & Refactoring  
**Estimated Time:** 2-4 hours

**Problem:** Compilation failures due to missing Supabase packages that should be removed as part of migration.

**Claude Code Prompt:**
```
I need to completely remove all Supabase dependencies from this Helper AI codebase as part of our migration to a lightweight PostgreSQL + Drizzle ORM architecture. Based on the integration testing report, there are compilation failures due to missing Supabase packages.

Please:
1. Search for all files that import or use Supabase packages (@supabase/ssr, @supabase/supabase-js)
2. Remove or replace these files:
   - /lib/supabase/server.ts
   - /lib/supabase/client.ts  
   - /lib/supabase/middleware.ts
3. Find all components/files that import from these Supabase files
4. Replace Supabase auth calls with our JWT-based auth system
5. Update any authentication middleware to use JWT instead of Supabase
6. Remove @supabase/* packages from package.json

Focus on getting the application to compile and start successfully. The JWT auth system is already implemented - just need to wire it up where Supabase was being used.

Key files to check:
- All files in /lib/supabase/ directory
- Any middleware files
- Authentication-related components
- package.json dependencies
```

### Task 2: Complete tRPC to SWR Migration for Critical Components
**Urgency:** CRITICAL  
**Subagent:** Frontend Development  
**Estimated Time:** 4-6 hours

**Problem:** AI chat functionality and API error handling broken due to incomplete tRPC migration.

**Claude Code Prompt:**
```
The Helper AI application has partially migrated from tRPC to SWR, but critical components still have tRPC dependencies causing compilation failures. Based on the SWR migration progress report, I need to complete the migration for these essential components:

HIGH PRIORITY (blocking app functionality):
1. Message Actions (conversation/messageActions.tsx) - Critical for conversation functionality
2. AI Chat functionality (/lib/ai/chat.ts) - Replace TRPCError with custom error handling
3. Job trigger system (/jobs/trigger.ts) - Replace tRPC patterns with direct API calls

Please:
1. Remove all @trpc/server imports and dependencies
2. Replace TRPCError with custom error classes
3. Convert tRPC mutations to SWR-based API calls
4. Update error handling to use toast notifications (pattern established in other SWR components)
5. Ensure proper loading states and optimistic updates

The SWR patterns are already established in files like:
- /hooks/use-conversations.tsx
- /hooks/use-members.tsx  
- /hooks/use-settings.tsx

Follow the same patterns for consistency. Focus on getting core conversation and AI functionality working.

Files that definitely need conversion:
- /lib/ai/chat.ts (TRPCError usage)
- /jobs/trigger.ts (tRPC patterns)
- /app/(dashboard)/[category]/conversation/messageActions.tsx
- Any remaining tRPC server dependencies
```

### Task 3: Fix Missing Internal Package Dependencies
**Urgency:** CRITICAL  
**Subagent:** Dependency Management  
**Estimated Time:** 1-2 hours

**Problem:** Job trigger system and tool integrations fail due to missing @helperai/client package.

**Claude Code Prompt:**
```
The application has a missing dependency "@helperai/client" that is breaking the job trigger system and tool integrations. Based on the integration testing report, this is causing compilation failures.

Please:
1. Search the codebase for all imports of "@helperai/client"
2. Identify what functionality this package provides by examining usage patterns
3. Determine if this is:
   - An internal package that needs to be created/restored
   - An external package that needs to be installed
   - Code that should be replaced with direct implementations

Key files affected:
- /jobs/trigger.ts
- Tool integration components

If it's internal functionality, implement the missing methods directly in the codebase.
If it's an external package, install it or find an equivalent.
If it's obsolete, remove the dependency and replace with working implementations.

The goal is to get the job system and tool integrations working again.
```

## HIGH PRIORITY TASKS (After critical issues resolved)

### Task 4: Complete Database Migration Script
**Urgency:** HIGH  
**Subagent:** Database Operations  
**Estimated Time:** 2-3 hours

**Problem:** Migration cannot complete without required PostgreSQL extensions, preventing full database setup.

**Claude Code Prompt:**
```
The database migration script cannot complete because it requires PostgreSQL extensions that may not be available in all environments. Based on the integration testing report, we need missing extensions: pgmq, pg_cron, http.

Please:
1. Review the current migration scripts in /db/migrations/
2. Create alternative lightweight implementations for features that require these extensions:
   - pgmq (PostgreSQL Message Queue) - replace with simple job table
   - pg_cron (PostgreSQL Cron) - replace with application-level scheduling
   - http extension - replace with application-level HTTP requests
3. Ensure the migration can complete successfully without these extensions
4. Update /db/client.ts if needed for the changes
5. Test that pnpm db:migrate works in a basic PostgreSQL environment

The goal is to have a migration script that works with standard PostgreSQL 14+ without requiring special extensions. The lightweight job system is already partially implemented - use that approach.

Files to check:
- /db/migrations/ directory
- /db/schema.ts (for any extension-dependent features)
- /db/client.ts
```

### Task 5: Fix Schema Reference Issues
**Urgency:** HIGH  
**Subagent:** Database Schema  
**Estimated Time:** 1-2 hours

**Problem:** Schema inconsistencies causing compilation errors (e.g., issueGroups vs issueGroupsTable).

**Claude Code Prompt:**
```
There are schema reference inconsistencies throughout the codebase where some files reference old table names instead of the new naming convention (tableNameTable). The integration testing report identified "issueGroups" reference error that was fixed, but there may be more.

Please:
1. Search the entire codebase for any remaining references to old table names that don't follow the "tableNameTable" convention
2. Check these patterns specifically:
   - conversations vs conversationsTable
   - users vs usersTable  
   - messages vs messagesTable
   - Any other table references that don't end with "Table"
3. Update all imports and references to use the new naming convention from /db/schema.ts
4. Ensure all relations also use the correct TableRelations naming
5. Verify TypeScript compilation succeeds

The schema conversion was completed but application code may still reference old names. All table exports should follow the pattern: entityTable (e.g., conversationsTable, usersTable).

Focus on:
- Import statements from @/db/schema
- Database queries in API routes
- Component files that do database operations
```

### Task 6: Complete Authentication System Integration
**Urgency:** HIGH  
**Subagent:** Authentication & Security  
**Estimated Time:** 3-4 hours

**Problem:** JWT auth system exists but needs full integration testing and session management completion.

**Claude Code Prompt:**
```
The JWT authentication system has been implemented but needs complete integration and testing to replace Supabase auth. Based on the integration testing report, the basic auth service is accessible but needs full integration.

Please:
1. Test the complete authentication flow:
   - User registration
   - User login
   - JWT token generation and validation
   - Session management with database backing
   - Password hashing with Argon2
2. Ensure authentication middleware works correctly
3. Test protected route access
4. Verify HTTP-only cookie handling
5. Implement proper error handling for auth failures
6. Test session expiration and refresh

Key areas to verify:
- /lib/auth/ directory (auth service implementation)
- Authentication middleware
- Login/register API routes
- Protected API route middleware
- Frontend auth hooks and components

The system should provide equivalent functionality to what Supabase auth provided. Focus on getting basic login/logout/registration working end-to-end.
```

## MEDIUM PRIORITY TASKS (After core functionality working)

### Task 7: Complete Real-time to SWR Migration
**Urgency:** HIGH  
**Subagent:** Frontend State Management  
**Estimated Time:** 2-3 hours

**Problem:** Some components still have real-time subscriptions that need conversion to SWR polling.

**Claude Code Prompt:**
```
The migration from Supabase real-time to SWR polling is mostly complete, but according to the REALTIME_TO_SWR_MIGRATION.md document, there are still some components that need conversion:

Remaining components to convert:
1. Conversation Messages (/app/(dashboard)/[category]/conversation/conversation.tsx)
2. Widget Components (/components/widget/Conversation.tsx)
3. Any remaining useRealtimeEvent, useRealtimePresence usage

Please:
1. Search for any remaining real-time subscription usage
2. Replace with appropriate SWR polling hooks from /lib/swr/realtime-hooks.ts
3. Add manual refresh capabilities where needed
4. Implement optimistic updates for better UX
5. Remove any unused real-time related imports

The SWR real-time hooks are already created and working:
- useRealtimeDashboardEvents()
- useRealtimeMessages() 
- useRealtimeConversations()
- useRealtimePresence()

Follow the patterns established in converted components. The goal is to eliminate all Supabase real-time dependencies.
```

### Task 8: API Route Completion
**Urgency:** HIGH  
**Subagent:** Backend API Development  
**Estimated Time:** 3-4 hours

**Problem:** SWR hooks expect API endpoints that may not exist or be complete.

**Claude Code Prompt:**
```
The SWR migration requires specific API endpoints that may not be fully implemented. Based on the REALTIME_TO_SWR_MIGRATION.md document, these endpoints are needed:

Required API endpoints:
- GET /api/mailbox/latest-events - Dashboard events
- GET /api/mailbox/dashboard-metrics - Dashboard metrics
- GET /api/mailbox/conversations?filters=... - Filtered conversations  
- GET /api/conversation/{slug}/messages - Conversation messages
- GET /api/presence/{channelName} - Presence data
- POST /api/conversation/{slug}/send-message - Send message
- PATCH /api/conversation/update-status - Update conversation status

Please:
1. Check if these API routes exist in /app/api/
2. Create any missing API routes
3. Ensure they return the expected data format for the SWR hooks
4. Test that all SWR hooks in /lib/swr/realtime-hooks.ts work with the API routes
5. Verify proper error handling and status codes

Use the existing database schema and Drizzle ORM for data access. Follow the patterns established in existing API routes for consistency.
```

## NOTES

### Exclusions (DO NOT include these - they are enhancements, not critical issues):
- Performance optimizations
- Caching improvements  
- Monitoring setup
- Documentation updates
- UI/UX enhancements
- Advanced features
- Additional integrations
- Backup procedures (covered in separate docs)

### Success Criteria:
When these tasks are completed, the application should:
1. Compile successfully without dependency errors
2. Start and run without critical runtime errors  
3. Allow user authentication (login/register)
4. Display the main dashboard
5. Support basic conversation functionality
6. Have database operations working

### Order of Execution:
Tasks 1-3 must be completed before others (they prevent compilation/startup)
Tasks 4-6 are needed for core functionality
Tasks 7-8 complete the migration to working state

### Estimated Total Time: 15-25 hours of focused development work