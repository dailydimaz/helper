# Helper AI Lightweight Conversion - Task Plan

This task plan outlines the sequential steps to convert the current Helper AI application from Supabase-dependent to a lightweight PostgreSQL/Drizzle ORM solution following the boilerplate specifications.

## Task 1: Project Setup and Configuration
**Subagent:** backend-architect  
**Estimated Time:** 2-3 hours

**Claude Code Prompt:**
```
You are converting a Helper AI application from Supabase to a lightweight Next.js 15 + PostgreSQL + Drizzle ORM setup. The current app uses tRPC, Next.js 15, React 19, but relies heavily on Supabase for auth, database, and real-time features.

1. Update package.json to remove Supabase dependencies (@supabase/ssr, @supabase/supabase-js) and @trpc/* packages
2. Add required lightweight dependencies following boilerplate.md specs:
   - Jose for JWT authentication
   - Argon2 for password hashing
   - SWR for state management (replacing tRPC/react-query)
   - React Hook Form with Zod validation
   - ShadCN/UI components
3. Update scripts to use Bun instead of PNPM where applicable
4. Create new drizzle.config.ts for direct PostgreSQL connection (remove Supabase references)
5. Update environment variables in lib/env.ts to remove Supabase vars and add JWT_SECRET, JWT_EXPIRES_IN

Key files to modify:
- /Users/dmzmzmd/helper/package.json
- /Users/dmzmzmd/helper/lib/env.ts  
- /Users/dmzmzmd/helper/db/drizzle.config.ts

Maintain the core help desk/customer support functionality while simplifying the tech stack.
```

## Task 2: Database Schema Migration 
**Subagent:** backend-architect  
**Estimated Time:** 4-5 hours

**Claude Code Prompt:**
```
Convert the existing Helper AI database schema from Supabase to pure PostgreSQL with Drizzle ORM following boilerplate.md conventions.

Current schema files to convert (maintain data integrity):
- /Users/dmzmzmd/helper/db/schema/conversations.ts
- /Users/dmzmzmd/helper/db/schema/conversationMessages.ts
- /Users/dmzmzmd/helper/db/schema/userProfiles.ts
- /Users/dmzmzmd/helper/db/schema/savedReplies.ts
- /Users/dmzmzmd/helper/db/schema/issueGroups.ts
- /Users/dmzmzmd/helper/db/schema/files.ts
- All other schema files in /Users/dmzmzmd/helper/db/schema/

Requirements:
1. Follow boilerplate.md naming conventions (camelCase with 'Table' suffix)
2. Use proper Drizzle ORM relations syntax
3. Replace Supabase auth schema with custom usersTable (id, name, email, role, password, createdAt, updatedAt)
4. Update foreign key references to use the new usersTable
5. Maintain existing encrypted fields functionality
6. Remove Supabase-specific columns (auth.users references)
7. Update db/client.ts to remove Supabase auth schema imports

Create migration scripts to handle the transition from Supabase auth.users to custom usersTable.
```

## Task 3: Authentication System Replacement
**Subagent:** fullstack-expert  
**Estimated Time:** 6-8 hours

**Claude Code Prompt:**
```
Replace Supabase Auth with JWT-based authentication using Jose library and Argon2 password hashing following boilerplate.md specifications.

Current auth files to replace:
- /Users/dmzmzmd/helper/lib/supabase/client.ts
- Any Supabase auth middleware or utilities

Create new authentication system:
1. lib/auth.ts - JWT token creation/verification with Jose
2. lib/cookie.ts - Cookie-based session management (following boilerplate.md)
3. middleware.ts - Route protection middleware
4. app/api/auth/login/route.ts - Login API endpoint
5. app/api/auth/logout/route.ts - Logout API endpoint  
6. app/api/auth/me/route.ts - Get current user endpoint
7. components/auth-provider.tsx - Client-side auth context
8. hooks/use-user.tsx - User hook with SWR (following boilerplate.md)

Authentication features to implement:
- Email/password login with Argon2 hashing
- JWT token generation and verification
- Cookie-based session storage
- Protected route middleware
- Password reset flow (if existed in original)

Ensure all existing tRPC auth checks are converted to the new JWT system.
```

## Task 4: Replace tRPC with SWR and API Routes
**Subagent:** fullstack-expert  
**Estimated Time:** 8-10 hours

**Claude Code Prompt:**
```
Convert the Helper AI application from tRPC to SWR + Next.js API routes following boilerplate.md patterns.

Current tRPC setup to remove:
- /Users/dmzmzmd/helper/trpc/trpc.ts
- All tRPC routers and procedures
- tRPC client configurations

Create new API infrastructure:
1. hooks/use-api.tsx - API hook following boilerplate.md exactly
2. hooks/use-app.tsx - App context provider with SWR config
3. lib/response.ts - Standardized API response utility
4. lib/validation/index.ts - Request validation utility
5. lib/handle-api-err.ts - Error handling utility

Convert existing tRPC endpoints to API routes:
- Conversations CRUD operations
- Messages management
- User profile management
- Saved replies system
- Issue groups management
- File uploads
- AI integration endpoints

Ensure all API routes follow the boilerplate.md template:
- Proper authentication checks using getLogin()
- Request validation with Zod schemas
- Standardized error handling
- Pagination support with parsePaginate()

Update all frontend components to use SWR hooks instead of tRPC hooks.
```

## Task 5: Job Queue System Simplification
**Subagent:** backend-architect  
**Estimated Time:** 4-6 hours

**Claude Code Prompt:**
```
Replace the complex job queue system (if using pgmq or similar) with a simple database-based queue using Drizzle ORM and setTimeout for scheduling.

Current job system files to identify and replace:
- Search for any job queue implementations
- Cron job setups in /Users/dmzmzmd/helper/db/setupCron.ts
- Background job processing

Create simplified job system:
1. db/schema/jobs.ts - Simple jobs table with Drizzle ORM
   ```typescript
   export const jobsTable = pgTable("jobs", {
     id: integer().primaryKey().generatedAlwaysAsIdentity(),
     type: varchar({ length: 255 }).notNull(),
     payload: jsonb("payload"),
     status: varchar({ length: 50 }).notNull().default('pending'),
     scheduledFor: timestamp("scheduled_for").defaultNow(),
     createdAt: timestamp("created_at").defaultNow(),
     updatedAt: timestamp("updated_at").defaultNow(),
   });
   ```

2. lib/jobs/queue.ts - Simple job queue manager using setTimeout
3. lib/jobs/processor.ts - Job processing logic
4. lib/jobs/scheduler.ts - Job scheduling with setTimeout

Job types to handle:
- Email sending/processing
- AI response generation
- Cleanup tasks
- Notification sending

Replace cron jobs with setTimeout-based scheduling for development simplicity.
```

## Task 6: Real-time Features Replacement
**Subagent:** fullstack-expert  
**Estimated Time:** 3-4 hours

**Claude Code Prompt:**
```
Replace Supabase real-time subscriptions with simple polling using SWR's automatic revalidation.

Files likely using real-time features:
- Dashboard components showing live data
- Conversation updates
- Message notifications
- Any components using Supabase subscriptions

Conversion strategy:
1. Replace real-time subscriptions with SWR polling
2. Use SWR's `refreshInterval` for automatic data updates
3. Implement optimistic updates for better UX
4. Add manual refresh capabilities

Key areas to update:
- Live conversation updates
- Dashboard metrics
- Message status updates  
- Online/offline status indicators

Configure appropriate polling intervals:
- Active conversations: 2-5 seconds
- Dashboard data: 30 seconds
- General data: 60 seconds

Maintain the responsive feel while keeping the implementation simple.
```

## Task 7: File Storage System Update
**Subagent:** backend-architect  
**Estimated Time:** 3-4 hours

**Claude Code Prompt:**
```
Update file storage system to work without Supabase Storage while maintaining the existing file upload functionality.

Current file handling:
- /Users/dmzmzmd/helper/db/schema/files.ts
- File upload components and APIs

Create new file storage system:
1. Choose storage solution (local filesystem for development, cloud storage for production)
2. Update file upload API routes to handle direct storage
3. Implement file serving endpoints
4. Update file schema to remove Supabase-specific fields

File operations to maintain:
- File upload for attachments
- Image handling for conversations
- Document attachments
- Avatar/profile images

Security considerations:
- File type validation
- Size limits
- Access control based on user permissions
- Secure file serving

Update all file-related components to work with the new storage system.
```

## Task 8: Frontend State Management with SWR
**Subagent:** frontend-developer  
**Estimated Time:** 6-8 hours

**Claude Code Prompt:**
```
Convert all frontend state management from tRPC/React Query to SWR following boilerplate.md patterns.

Current state management files to update:
- All components in /Users/dmzmzmd/helper/app/(dashboard)/
- Conversation management components
- Dashboard components
- Settings components

Implement SWR patterns:
1. hooks/use-table.tsx - Data table hook following boilerplate.md
2. Create custom SWR hooks for each major data type:
   - useConversations()
   - useMessages()  
   - useSavedReplies()
   - useIssueGroups()
   - useUserProfile()

Update major component categories:
1. Dashboard components:
   - /Users/dmzmzmd/helper/app/(dashboard)/dashboard/
   - Convert dashboard metrics to SWR
   - Real-time charts with polling

2. Conversation components:
   - /Users/dmzmzmd/helper/app/(dashboard)/[category]/conversation/
   - Message loading and pagination
   - Optimistic updates for new messages

3. List components:
   - /Users/dmzmzmd/helper/app/(dashboard)/[category]/list/
   - Search and filtering with SWR
   - Pagination support

Ensure proper loading states, error handling, and data synchronization across all components.
```

## Task 9: Admin Dashboard Implementation
**Subagent:** fullstack-expert  
**Estimated Time:** 5-7 hours

**Claude Code Prompt:**
```
Create a complete admin dashboard following boilerplate.md specifications for managing Helper AI data.

Create admin section with routing structure:
```
app/
├── (adm)/
│   └── adm/
│       ├── login/page.tsx
│       └── (authenticated)/
│           ├── layout.tsx
│           ├── dashboard/page.tsx
│           ├── conversations/
│           │   ├── page.tsx
│           │   ├── create/page.tsx
│           │   └── [id]/page.tsx
│           ├── users/
│           ├── saved-replies/
│           ├── issue-groups/
│           └── settings/
```

Implement CRUD pages following boilerplate.md templates:
1. List pages with search, sort, pagination
2. Create/Edit forms with validation
3. Delete confirmation dialogs
4. Data tables with actions

Admin features:
- User management (view, edit, deactivate)
- Conversation management and oversight
- Saved replies administration  
- Issue groups configuration
- System settings
- Analytics dashboard

Use ShadCN/UI components and follow the exact boilerplate.md patterns for forms, tables, and navigation.

Install required ShadCN components:
- button, input, label, form
- table, data-table, pagination
- dialog, alert-dialog
- dropdown-menu, select, checkbox
- badge, card, separator
- tabs, sheet, drawer
```

## Task 10: API Routes Migration and Testing
**Subagent:** fullstack-expert  
**Estimated Time:** 4-6 hours

**Claude Code Prompt:**
```
Complete the API routes migration and implement comprehensive testing for the new lightweight system.

Finalize API route conversions:
1. Ensure all API routes follow boilerplate.md patterns
2. Implement proper authentication middleware
3. Add comprehensive validation schemas
4. Test error handling and edge cases

API routes to complete:
- /api/auth/* - Authentication endpoints
- /api/adm/* - Admin dashboard APIs  
- /api/conversations/* - Conversation management
- /api/messages/* - Message handling
- /api/files/* - File upload/serving
- /api/users/* - User management

Testing checklist:
1. Authentication flow (login, logout, protected routes)
2. CRUD operations for all major entities
3. File upload functionality
4. Error handling and validation
5. Pagination and search
6. Data integrity and relationships

Performance optimizations:
- Database query optimization
- API response caching where appropriate
- Image resizing and optimization
- Database connection pooling

Create migration documentation for moving from Supabase to the new lightweight system.
```

## Task 11: Integration Testing and Bug Fixes
**Subagent:** fullstack-expert  
**Estimated Time:** 4-6 hours

**Claude Code Prompt:**
```
Perform comprehensive integration testing and fix any issues found during the conversion process.

Testing areas:
1. End-to-end user flows:
   - User registration/login
   - Creating and managing conversations
   - AI response generation
   - File attachments
   - Admin dashboard functionality

2. Data consistency:
   - Verify all relationships work correctly
   - Test data migration from Supabase structure
   - Ensure no data loss during conversion

3. Performance testing:
   - Page load times
   - API response times
   - Database query performance
   - File upload/download speeds

4. Security testing:
   - Authentication and authorization
   - JWT token handling
   - File access controls
   - Input validation

Bug fix priorities:
- Authentication issues
- Data loading problems
- UI/UX inconsistencies
- Performance bottlenecks
- Security vulnerabilities

Create deployment checklist and environment setup guide for the new lightweight version.
```

## Task 12: Documentation and Deployment Preparation
**Subagent:** fullstack-expert  
**Estimated Time:** 2-3 hours

**Claude Code Prompt:**
```
Create comprehensive documentation and prepare the lightweight Helper AI application for deployment.

Documentation to create:
1. README.md updates:
   - New tech stack overview
   - Installation instructions with Bun
   - Environment variable setup
   - Database migration steps

2. DEPLOYMENT.md:
   - Production deployment guide
   - Environment configuration
   - Database setup instructions
   - File storage configuration

3. MIGRATION.md:
   - Step-by-step migration guide from Supabase version
   - Data migration scripts
   - Rollback procedures
   - Testing checklist

4. API.md:
   - API endpoint documentation
   - Authentication flow
   - Request/response formats
   - Error codes and handling

Deployment preparation:
1. Production environment variables template
2. Database migration scripts
3. Health check endpoints
4. Monitoring and logging setup
5. Backup procedures

Final verification:
- All dependencies correctly installed
- Environment variables properly configured
- Database schema matches requirements
- Authentication working correctly
- Core functionality preserved from original application

The lightweight Helper AI application should now be ready for deployment with improved performance and simpler maintenance requirements.
```

---

## Summary

This task plan converts the Helper AI application from a Supabase-dependent system to a lightweight PostgreSQL + Drizzle ORM solution following modern best practices. The conversion maintains all core help desk functionality while simplifying the architecture for better performance and easier maintenance.

**Total Estimated Time:** 50-65 hours

**Key Technologies Replaced:**
- Supabase Auth → JWT with Jose + Argon2
- Supabase Database → Direct PostgreSQL with Drizzle ORM  
- tRPC → SWR + Next.js API routes
- Supabase Real-time → SWR polling
- Complex job queues → Database-based queue with setTimeout
- Supabase Storage → Configurable file storage

**Core Features Maintained:**
- Help desk/customer support functionality
- AI-powered response generation
- Conversation management
- User authentication and management
- File attachments and uploads
- Admin dashboard
- Real-time-like updates through polling

The resulting application will be more portable, easier to deploy, and simpler to maintain while preserving all essential functionality.