# Migration Guide: From Supabase to Lightweight Architecture

## Overview

This comprehensive guide details the migration process from a Supabase-based architecture to our new lightweight system. This migration delivers significant performance improvements, cost reduction, and simplified maintenance while preserving all existing functionality.

**Migration Status: ✅ Complete**
- Database schema migrated to Drizzle ORM
- Authentication system replaced with JWT
- Real-time features implemented with SWR
- File storage transitioned to local filesystem
- All API endpoints converted to Next.js routes

## Migration Benefits

### Performance Improvements
- **Reduced Latency**: Direct PostgreSQL connections eliminate Supabase API overhead
- **Query Optimization**: Custom-optimized queries using Drizzle ORM
- **Connection Pooling**: Efficient database connection management
- **Caching Layer**: Integrated caching for frequently accessed data

### Technical Advantages
- **Type Safety**: Full TypeScript support with Drizzle ORM
- **Schema Control**: Direct control over database schema and migrations
- **Reduced Dependencies**: Elimination of Supabase client libraries
- **Better Error Handling**: Comprehensive error handling and logging

### Cost Benefits
- **Reduced External Dependencies**: Lower operational costs
- **Simplified Infrastructure**: Fewer services to manage
- **Better Resource Utilization**: Optimized for your specific use case

## Architecture Changes

### Before (Supabase)
```
Frontend (Next.js) → Supabase Client → Supabase API → PostgreSQL
                   ↓
                 Realtime Subscriptions
                   ↓
                 Auth Service
```

### After (Lightweight System)
```
Frontend (Next.js) → SWR Hooks → API Routes → Drizzle ORM → PostgreSQL
                   ↓
                 JWT Auth + Sessions
                   ↓
                 Database-backed Cache
```

## Database Schema Migration

### Schema Mapping

The database schema has been converted to Drizzle ORM with the following key changes:

| Supabase Feature | Lightweight Equivalent | Status |
|-----------------|----------------------|---------|
| `auth.users` | `users` table with JWT | ✅ Complete |
| RLS Policies | Application-level auth | ✅ Complete |
| Realtime | SWR with polling/events | ✅ Complete |
| Storage | Local file system + DB | ✅ Complete |
| Edge Functions | API Routes | ✅ Complete |

### Database Tables

```typescript
// Core tables maintained with new schema
- users              // User management with JWT auth
- conversations      // Message conversations
- conversationMessages // Individual messages
- files             // File attachments
- savedReplies      // Saved reply templates
- issueGroups       // Issue categorization
- cache             // Database-backed caching
- userSessions      // Session management
```

## API Migration

### Authentication Migration

#### Before (Supabase)
```typescript
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, key)

// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email, password
})

// Get user
const { data: { user } } = await supabase.auth.getUser()
```

#### After (Lightweight)
```typescript
import { useApi } from '@/hooks/use-api'
const api = useApi()

// Login
const response = await api.post('/auth/login', { email, password })

// Get user (using SWR)
import { useUser } from '@/hooks/use-user'
const { user, status } = useUser()
```

### Data Fetching Migration

#### Before (Supabase)
```typescript
// Fetch conversations
const { data, error } = await supabase
  .from('conversations')
  .select('*')
  .eq('status', 'open')
  .order('created_at', { ascending: false })
  .range(0, 9)
```

#### After (Lightweight)
```typescript
// Fetch conversations using SWR
import { useTable } from '@/hooks/use-table'

const { data, isLoading, error } = useTable({
  pathname: '/adm/conversations',
  perPage: 10
})
```

### Realtime Migration

#### Before (Supabase)
```typescript
// Subscribe to changes
const subscription = supabase
  .channel('conversations')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'conversations' },
    (payload) => console.log('Change received!', payload)
  )
  .subscribe()
```

#### After (Lightweight)
```typescript
// Using SWR with automatic revalidation
import useSWR, { mutate } from 'swr'

const { data } = useSWR('/adm/conversations', {
  refreshInterval: 5000, // Poll every 5 seconds
  revalidateOnFocus: true,
  revalidateOnReconnect: true
})

// Manual revalidation after mutations
await api.post('/adm/conversations', newData)
mutate('/adm/conversations') // Refresh data
```

## Frontend Migration

### Hook Migration

#### Conversation Management
```typescript
// OLD: Supabase hooks
import { useSupabaseQuery } from './old-hooks'

// NEW: SWR-based hooks
import { useConversations } from '@/hooks/use-conversations'

const {
  conversations,
  loading,
  error,
  createConversation,
  updateConversation,
  deleteConversation
} = useConversations()
```

#### User Management
```typescript
// OLD: Supabase auth
import { useUser as useSupabaseUser } from '@supabase/auth-helpers-react'

// NEW: Custom auth hook
import { useUser } from '@/hooks/use-user'

const { user, status, reload } = useUser()
```

### Component Migration

#### Data Tables
```typescript
// OLD: Manual pagination with Supabase
const [page, setPage] = useState(1)
const { data, count } = await supabase
  .from('table')
  .select('*', { count: 'exact' })
  .range((page - 1) * 10, page * 10 - 1)

// NEW: Integrated table hook
import { useTable } from '@/hooks/use-table'
import DataTable from '@/components/ui/data-table'

const tableData = useTable({
  pathname: '/adm/conversations',
  perPage: 10
})

return <DataTable {...tableData} columns={columns} />
```

## Configuration Migration

### Environment Variables

Update your `.env.local`:

```bash
# Remove Supabase variables
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=

# Add new database configuration
DATABASE_URL="postgresql://username:password@localhost:5432/dbname"
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"

# App configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
```

### Database Setup

1. **Export Supabase Data**
```bash
# Export your Supabase data
pg_dump "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres" > supabase_backup.sql
```

2. **Setup New Database**
```bash
# Install dependencies
npm install drizzle-orm postgres drizzle-kit

# Generate migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Import data (after schema adjustments)
psql "postgresql://username:password@localhost:5432/dbname" < adjusted_backup.sql
```

## Migration Steps

### Phase 1: Database Migration (1-2 days)

1. **Setup New Database**
   - Install PostgreSQL locally or use managed service
   - Configure connection strings
   - Run initial migrations

2. **Data Migration**
   - Export existing data from Supabase
   - Transform data to match new schema
   - Import data into new database
   - Verify data integrity

3. **Test Database Operations**
   - Run provided test scripts
   - Verify all CRUD operations
   - Test authentication flows

### Phase 2: API Migration (2-3 days)

1. **Deploy API Routes**
   - All routes are already implemented and tested
   - Update environment variables
   - Test all endpoints

2. **Authentication Migration**
   - Migrate user accounts
   - Test login/logout flows
   - Verify permission systems

3. **File Storage Migration**
   - Migrate file storage from Supabase Storage
   - Update file handling logic
   - Test file uploads/downloads

### Phase 3: Frontend Migration (1-2 days)

1. **Replace Supabase Hooks**
   - Update all components to use new hooks
   - Replace Supabase client calls
   - Test user interactions

2. **Update Components**
   - Replace auth components
   - Update data fetching patterns
   - Test all user flows

3. **Performance Testing**
   - Load test API endpoints
   - Verify response times
   - Test with production data volumes

### Phase 4: Production Deployment (1 day)

1. **Pre-deployment Testing**
   - Run comprehensive test suite
   - Performance benchmarking
   - Security audit

2. **Deployment**
   - Deploy database changes
   - Deploy application updates
   - Monitor system health

3. **Post-deployment Verification**
   - Verify all functionality
   - Monitor error rates
   - Performance monitoring

## Testing Strategy

### Automated Testing

Run the comprehensive test suite:

```bash
# Run API endpoint tests
npm run tsx scripts/test-api-endpoints.ts

# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e
```

### Manual Testing Checklist

- [ ] User registration and login
- [ ] Password reset flow
- [ ] Conversation management (CRUD)
- [ ] Message handling
- [ ] File uploads and downloads
- [ ] Search and pagination
- [ ] Admin functions
- [ ] Saved replies management
- [ ] Permission system
- [ ] Error handling

### Performance Testing

- [ ] Response time < 200ms for API calls
- [ ] Database query optimization
- [ ] Connection pool efficiency
- [ ] Memory usage monitoring
- [ ] Concurrent user testing

## Rollback Strategy

### Quick Rollback
If issues are discovered immediately after deployment:

1. **Revert Environment Variables**
```bash
# Restore Supabase configuration
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

2. **Deploy Previous Version**
```bash
git revert HEAD
npm run deploy
```

### Data Preservation
- Keep Supabase instance active during migration
- Maintain data backups at each phase
- Document all schema changes for reverse migration

## Monitoring and Maintenance

### Health Checks

```typescript
// Database health monitoring
import { checkDatabaseHealth } from '@/lib/database/optimizations'

const health = await checkDatabaseHealth()
console.log('Database status:', health)
```

### Performance Monitoring

```typescript
// Query performance tracking
import { getQueryMetrics } from '@/lib/database/optimizations'

const metrics = getQueryMetrics()
console.log('Query performance:', metrics)
```

### Error Tracking

- Monitor API response times
- Track error rates by endpoint
- Database connection monitoring
- User authentication failure tracking

## Troubleshooting Guide

### Common Issues

1. **Database Connection Issues**
```bash
# Check connection
psql "postgresql://username:password@localhost:5432/dbname"

# Verify environment variables
echo $DATABASE_URL
```

2. **Authentication Problems**
```bash
# Verify JWT secret
echo $JWT_SECRET

# Check user sessions
SELECT * FROM user_sessions WHERE expires_at > NOW();
```

3. **Migration Data Issues**
```sql
-- Check data integrity
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM conversations;
SELECT COUNT(*) FROM conversation_messages;
```

### Performance Issues

1. **Slow Queries**
```sql
-- Enable query logging
SET log_statement = 'all';
SET log_min_duration_statement = 1000; -- Log queries > 1s
```

2. **Connection Pool Issues**
```typescript
// Adjust pool configuration
const poolConfig = {
  min: 2,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
}
```

## Post-Migration Optimization

### Database Optimization
- Add appropriate indexes
- Optimize frequent queries
- Configure connection pooling
- Set up regular maintenance tasks

### Application Optimization
- Implement response caching
- Optimize API payload sizes
- Add request rate limiting
- Monitor and tune performance

### Security Hardening
- Review authentication flows
- Audit permission systems
- Implement security headers
- Regular security assessments

## Support and Resources

### Documentation
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [SWR Documentation](https://swr.vercel.app/)

### Monitoring Tools
- Database query analysis
- API performance monitoring
- Error tracking and alerting
- User session monitoring

### Maintenance Schedule
- Weekly database maintenance
- Monthly performance reviews
- Quarterly security audits
- Regular backup verification

---

## Migration Checklist

### Pre-Migration
- [ ] Database setup complete
- [ ] Environment variables configured
- [ ] Test suite passing
- [ ] Backup strategy in place

### Migration
- [ ] Data exported from Supabase
- [ ] Database migrations applied
- [ ] Data imported and verified
- [ ] API endpoints tested
- [ ] Frontend components updated
- [ ] Authentication flows verified

### Post-Migration
- [ ] Performance monitoring active
- [ ] Error tracking configured
- [ ] User acceptance testing complete
- [ ] Documentation updated
- [ ] Team training completed

---

This migration guide provides a comprehensive roadmap for transitioning from Supabase to the new lightweight system. The migration preserves all existing functionality while providing improved performance, better control, and reduced operational complexity.