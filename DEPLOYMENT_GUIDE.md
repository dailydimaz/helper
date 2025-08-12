# Production Deployment Guide

This guide provides comprehensive instructions for deploying the Helper AI lightweight application to production environments. The application has been optimized for performance, security, and maintainability with the new PostgreSQL + Drizzle ORM architecture.

## Pre-Deployment Checklist

### ✅ Pre-Deployment Verification

Ensure the following items are completed before production deployment:

**Code & Dependencies:**
- [ ] All dependencies updated and security-audited
- [ ] TypeScript compilation successful (`pnpm typecheck`)
- [ ] All tests passing (`pnpm test`)
- [ ] E2E tests validated (`pnpm test:e2e`)
- [ ] Code coverage meets requirements

**Database & Migration:**
- [ ] Database migration scripts tested
- [ ] Required PostgreSQL extensions available
- [ ] Data integrity validation complete
- [ ] Backup and recovery procedures tested

**Security & Configuration:**
- [ ] JWT secrets properly configured
- [ ] HTTPS certificates installed
- [ ] Security headers implemented
- [ ] Environment variables secured

### ✅ Infrastructure Requirements

#### Database Requirements

**Production Database Options:**

1. **Managed PostgreSQL (Recommended)**
   ```bash
   # Required Extensions:
   - vector (pgvector)      # AI embeddings
   - pgmq                   # Message queue
   - pg_cron                # Scheduled tasks  
   - http                   # HTTP requests
   - pg_trgm                # Text search
   ```

2. **Recommended Providers:**
   - **Supabase** (ironic but they have the extensions)
   - **Neon** (PostgreSQL with extensions)
   - **Railway** (with extension support)
   - **AWS RDS** (with custom extensions)

#### Application Requirements

- Node.js >= 18.x
- 2GB+ RAM minimum
- SSD storage for file uploads
- HTTPS certificate
- Redis (for caching, optional)

### ✅ Environment Configuration

#### Required Environment Variables

```bash
# Database Configuration
DATABASE_URL="postgresql://username:password@host:port/database"

# JWT Authentication
JWT_SECRET="your-super-secure-jwt-secret-key-at-least-32-characters-long"
JWT_EXPIRES_IN="7d"

# AI Integration
OPENAI_API_KEY="your-openai-api-key"

# Encryption (Production)
ENCRYPT_COLUMN_SECRET="32-character-hex-string-for-sensitive-data"

# Application URLs
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
NEXT_PUBLIC_API_URL="https://yourdomain.com/api"

# Email (Optional)
RESEND_API_KEY="your-resend-api-key"
RESEND_FROM_ADDRESS="noreply@yourdomain.com"

# Monitoring (Optional)
NEXT_PUBLIC_SENTRY_DSN="your-sentry-dsn"
```

#### Optional Integration Variables

```bash
# OAuth Integrations
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"

# Slack Integration
SLACK_CLIENT_ID="your-slack-client-id"
SLACK_CLIENT_SECRET="your-slack-client-secret"
SLACK_SIGNING_SECRET="your-slack-signing-secret"

# GitHub Integration
GITHUB_APP_SLUG="your-github-app-slug"
GITHUB_APP_ID="your-github-app-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
GITHUB_PRIVATE_KEY="your-github-private-key"

# Additional Services
JINA_API_TOKEN="your-jina-api-token"
FIRECRAWL_API_KEY="your-firecrawl-api-key"
```

## Database Setup

### 1. Production Database Setup

#### Option A: Supabase (Recommended for Extensions)

```bash
# 1. Create new Supabase project
# 2. Enable required extensions in SQL Editor:

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

# 3. Get connection string from Supabase dashboard
```

#### Option B: Neon Database

```bash
# 1. Create Neon project
# 2. Request extension support
# 3. Install extensions (if available)
```

#### Option C: Self-Managed PostgreSQL

```dockerfile
# Dockerfile for PostgreSQL with extensions
FROM pgvector/pgvector:pg15

# Install additional extensions
RUN apt-get update && apt-get install -y \
    postgresql-15-cron \
    postgresql-15-http \
    && rm -rf /var/lib/apt/lists/*
```

### 2. Database Migration

```bash
# Set production DATABASE_URL
export DATABASE_URL="postgresql://..."

# Run migrations
pnpm db:migrate

# Setup cron jobs (if pg_cron available)
pnpm db:setup-cron

# Seed initial data (optional)
pnpm db:seed
```

### 3. Backup Strategy

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump "$DATABASE_URL" > "backup_${DATE}.sql"

# Upload to S3 or similar
aws s3 cp "backup_${DATE}.sql" s3://your-backup-bucket/
```

## Application Deployment

### 1. Build Process

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Build application
pnpm build

# Run production server
pnpm start
```

### 2. Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build

# Expose port
EXPOSE 3000

# Start
CMD ["pnpm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - postgres
  
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_DB: helperai_db
      POSTGRES_USER: postgres  
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

### 3. Platform-Specific Deployments

#### Vercel (Recommended)

```json
// vercel.json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 60
    }
  },
  "env": {
    "DATABASE_URL": "@database-url",
    "JWT_SECRET": "@jwt-secret",
    "OPENAI_API_KEY": "@openai-api-key"
  }
}
```

#### Railway

```yaml
# railway.yml
version: 2
build:
  command: pnpm build
start:
  command: pnpm start
env:
  NODE_ENV: production
```

#### DigitalOcean App Platform

```yaml
# .do/app.yaml  
name: helperai
services:
- name: web
  source_dir: /
  github:
    repo: your-repo
    branch: main
  run_command: pnpm start
  build_command: pnpm install && pnpm build
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  env:
  - key: DATABASE_URL
    scope: RUN_AND_BUILD_TIME
    value: ${DATABASE_URL}
```

## Post-Deployment Configuration

### 1. Database Optimizations

```sql
-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_conversations_user_id ON conversations(user_id);
CREATE INDEX CONCURRENTLY idx_conversations_status ON conversations(status);
CREATE INDEX CONCURRENTLY idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);

-- Analyze tables for query optimization
ANALYZE users;
ANALYZE conversations;
ANALYZE conversation_messages;
```

### 2. Application Health Checks

```typescript
// app/api/health/route.ts
export async function GET() {
  try {
    // Check database
    await db.execute('SELECT 1');
    
    // Check essential services
    const checks = {
      database: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version
    };
    
    return Response.json(checks);
  } catch (error) {
    return Response.json({ error: 'Health check failed' }, { status: 500 });
  }
}
```

### 3. Monitoring Setup

#### Application Monitoring

```typescript
// lib/monitoring.ts
import * as Sentry from "@sentry/nextjs";

export function initMonitoring() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV,
    });
  }
}
```

#### Database Monitoring

```sql
-- Create monitoring views
CREATE VIEW active_connections AS
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  state_change
FROM pg_stat_activity 
WHERE state != 'idle';

-- Monitor slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

### 4. Backup and Recovery

#### Automated Backups

```bash
#!/bin/bash
# backup.sh

# Set variables
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="helperai_db"

# Create backup
pg_dump "$DATABASE_URL" | gzip > "${BACKUP_DIR}/backup_${DATE}.sql.gz"

# Upload to cloud storage
aws s3 cp "${BACKUP_DIR}/backup_${DATE}.sql.gz" "s3://your-backup-bucket/"

# Clean up old local backups (keep 7 days)
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
```

#### Recovery Process

```bash
# Download backup
aws s3 cp "s3://your-backup-bucket/backup_YYYYMMDD_HHMMSS.sql.gz" .

# Restore database
gunzip backup_YYYYMMDD_HHMMSS.sql.gz
psql "$DATABASE_URL" < backup_YYYYMMDD_HHMMSS.sql

# Run migrations if needed
pnpm db:migrate
```

## Security Hardening

### 1. Environment Security

```bash
# Use strong secrets
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPT_COLUMN_SECRET=$(openssl rand -hex 16)

# Secure database connection
DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require"
```

### 2. Application Security

```typescript
// middleware.ts
import { NextResponse } from 'next/server';

export function middleware(request: Request) {
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  return response;
}
```

### 3. Database Security

```sql
-- Create limited user for application
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE helperai_db TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
```

## Monitoring and Maintenance

### 1. Performance Monitoring

- **Response Times**: < 200ms for API calls
- **Database Queries**: < 100ms average
- **Memory Usage**: Monitor for leaks
- **Connection Pool**: Monitor active connections

### 2. Regular Maintenance Tasks

#### Daily
- Check application logs
- Monitor error rates
- Verify backup completion

#### Weekly  
- Review performance metrics
- Update dependencies
- Database maintenance

#### Monthly
- Security audit
- Capacity planning
- Backup testing

### 3. Alerting Setup

```yaml
# alerts.yml (example for monitoring service)
alerts:
  - name: High Error Rate
    condition: error_rate > 5%
    duration: 5m
    notification: slack
    
  - name: Database Connections
    condition: db_connections > 80%
    duration: 2m
    notification: email
    
  - name: Response Time
    condition: avg_response_time > 500ms
    duration: 10m  
    notification: slack
```

## Rollback Strategy

### 1. Application Rollback

```bash
# Quick rollback to previous version
git revert HEAD
pnpm build
pnpm start

# Or deploy previous stable version
git checkout previous-stable-tag
pnpm build
pnpm start
```

### 2. Database Rollback

```bash
# Restore from backup
psql "$DATABASE_URL" < backup_before_migration.sql

# Run any necessary cleanup scripts
psql "$DATABASE_URL" -c "DELETE FROM schema_migrations WHERE version > 'ROLLBACK_VERSION';"
```

## Troubleshooting Guide

### Common Issues

#### 1. Database Connection Errors
```bash
# Check connection
psql "$DATABASE_URL" -c "SELECT 1"

# Check connection pool
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
```

#### 2. Migration Failures
```bash
# Check migration status
SELECT * FROM drizzle_migrations ORDER BY created_at DESC;

# Manual migration rollback
DELETE FROM drizzle_migrations WHERE batch = (SELECT MAX(batch) FROM drizzle_migrations);
```

#### 3. Performance Issues
```sql
-- Check slow queries
SELECT query, calls, total_exec_time, mean_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
FROM pg_stat_user_indexes;
```

---

## Deployment Timeline

### Phase 1: Pre-Deployment (1-2 days)
- [ ] Resolve critical code issues
- [ ] Set up production database
- [ ] Configure environment variables
- [ ] Run integration tests

### Phase 2: Initial Deployment (1 day)  
- [ ] Deploy to staging environment
- [ ] Run full test suite
- [ ] Performance testing
- [ ] Security audit

### Phase 3: Production Release (1 day)
- [ ] Deploy to production
- [ ] Monitor system health
- [ ] User acceptance testing
- [ ] Performance monitoring setup

### Phase 4: Post-Deployment (ongoing)
- [ ] Daily monitoring
- [ ] Performance optimization
- [ ] User feedback collection
- [ ] Continuous improvement

---

**Guide Version**: 1.0  
**Last Updated**: August 11, 2025  
**Next Review**: After production deployment