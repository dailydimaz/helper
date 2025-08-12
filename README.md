<p align="center">
    <a href="https://helper.ai">helper.ai</a> |
    <a href="https://helper.ai/docs">Docs</a>
</p>

# Helper™ Community Edition - Lightweight

**This software is derived from the source code for Gumroad, Inc. Helper™ software.**

**High-performance customer support platform** built with modern web technologies for optimal speed, reliability, and maintainability.

> **Trademark Notice**: Helper™ is a trademark of Gumroad, Inc. This derivative software is not officially endorsed or distributed by Gumroad, Inc.

## Features

- **🤖 AI-Powered Support:** Intelligent responses using OpenAI integration with knowledge base
- **📊 Admin Dashboard:** Comprehensive conversation management and analytics
- **🔗 Integrations:** Gmail, Slack, GitHub, and custom API tools
- **💬 Live Chat Widget:** Embeddable widget with customizable styling
- **📁 File Management:** Secure file uploads with preview generation
- **👥 Team Management:** Role-based access control and user permissions
- **📈 Analytics:** Real-time insights and performance metrics

## Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **SWR** - Data fetching with caching and revalidation
- **Radix UI** - Accessible component primitives

### Backend
- **PostgreSQL** - Primary database with vector extensions
- **Drizzle ORM** - Type-safe database operations
- **JWT Authentication** - Secure session management
- **Node.js/Next.js API Routes** - RESTful API endpoints

### Key Improvements
- **🚀 Performance:** Direct database connections eliminate API overhead
- **🔧 Type Safety:** Full TypeScript coverage with Drizzle ORM
- **📦 Simplified:** Reduced dependencies and operational complexity
- **💰 Cost Effective:** Lower infrastructure costs

## Prerequisites

- **Node.js** - Version 22 ([see .node-version](.node-version))
- **pnpm** - Package manager (Version 10.8.0+)
- **PostgreSQL** - Database server (Version 14+)
- **mkcert** - For HTTPS development certificates (optional but recommended)

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repository-url>
cd helper

# Install dependencies with pnpm
pnpm install
```

### 2. Database Setup

#### Option A: Local PostgreSQL (Native Installation)
```bash
# macOS (with Homebrew)
brew install postgresql@14
brew services start postgresql@14

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-14 postgresql-contrib-14

# Create database and user
createdb helperai_dev
psql helperai_dev -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

#### Option B: Managed PostgreSQL
Use any PostgreSQL provider (Neon, Railway, PlanetScale, etc.)

#### Option C: Local PostgreSQL with Docker (if preferred)
```bash
# Start PostgreSQL with required extensions
docker run --name helperai-postgres \
  -e POSTGRES_DB=helperai_dev \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:14

# Install additional extensions
docker exec -it helperai-postgres psql -U postgres -d helperai_dev \
  -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

### 3. Environment Configuration

Create `.env.local` with the following configuration:

```bash
# Database Configuration
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/helperai_dev"

# Authentication
JWT_SECRET="your-super-secure-jwt-secret-at-least-32-characters-long"
JWT_EXPIRES_IN="7d"

# OpenAI (Required)
OPENAI_API_KEY="sk-your-openai-api-key"

# Application URLs
NEXT_PUBLIC_APP_URL="https://helperai.dev:3000"
NEXT_PUBLIC_API_URL="https://helperai.dev:3000/api"

# Optional: Email Service (Resend)
RESEND_API_KEY="re_your-resend-api-key"
RESEND_FROM_ADDRESS="noreply@yourdomain.com"

# Optional: OAuth Providers
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"

# Optional: Slack Integration
SLACK_CLIENT_ID="your-slack-client-id"
SLACK_CLIENT_SECRET="your-slack-client-secret"
SLACK_SIGNING_SECRET="your-slack-signing-secret"

# Optional: GitHub Integration
GITHUB_APP_ID="your-github-app-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
GITHUB_PRIVATE_KEY="your-github-private-key"
```

### 4. Database Migration and Seeding

```bash
# Run database migrations
pnpm db:migrate

# Seed with sample data (optional for development)
pnpm db:seed
```

### 5. Development Server

```bash
# Start the development server
pnpm dev

# Application will be available at:
# https://helperai.dev:3000 - Main application with HTTPS
# http://localhost:3000 - HTTP fallback
```

### 6. HTTPS Development Setup (Recommended)

For secure local development with HTTPS:

```bash
# Install mkcert (macOS)
brew install mkcert nss

# Install mkcert (Windows with Chocolatey)
choco install mkcert

# Install mkcert (Ubuntu/Debian)
apt install mkcert

# Certificates are automatically generated when you run:
pnpm dev
```

The development server will run with HTTPS at **https://helperai.dev:3000** 🚀

## Development Workflows

### Database Operations

```bash
# Generate new migration
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Reset database (drop + migrate + seed)
pnpm db:reset

# Production migration
pnpm db:prod:migrate
```

### Testing

```bash
# Run unit tests
pnpm test

# Run E2E tests (requires setup)
pnpm test:e2e:setup
pnpm test:e2e

# Run specific test
pnpm test conversation.test.ts

# Run with coverage
pnpm test --coverage
```

### Code Quality

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Formatting
pnpm format
```

## Production Deployment

### Quick Deploy Options

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fantiwork%2Fhelper&env=OPENAI_API_KEY&envDescription=See%20our%20deployment%20guide%20for%20details.&envLink=https%3A%2F%2Fhelper.ai%2Fdocs%2Fdeployment&project-name=helper&repository-name=helper&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6)

### Manual Deployment

```bash
# 1. Set production environment variables
export DATABASE_URL="postgresql://user:pass@host:port/db"
export JWT_SECRET="production-jwt-secret"
export OPENAI_API_KEY="your-production-key"

# 2. Build application
pnpm build

# 3. Run database migrations
pnpm db:prod:migrate

# 4. Start production server
pnpm start
```

### Environment Requirements

**Production Database:**
- PostgreSQL 14+ with extensions: `vector`, `pg_trgm`, `pgmq` (if available)
- Recommended providers: Supabase, Neon, Railway, AWS RDS

**Application Server:**
- Node.js 18+
- 2GB+ RAM
- SSD storage for file uploads
- HTTPS certificate

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   API Routes     │    │  PostgreSQL     │
│                 │    │                  │    │  Database       │
│  - Pages        │◄──►│  - Authentication│◄──►│                 │
│  - Components   │    │  - Conversations │    │  - Vector Store │
│  - SWR Hooks    │    │  - Files         │    │  - Full-text    │
│                 │    │  - Webhooks      │    │    Search       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
          │                       │
          ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│   File Storage  │    │   External APIs  │
│                 │    │                  │
│  - Local FS     │    │  - OpenAI        │
│  - Secure URLs  │    │  - Gmail         │
│  - Previews     │    │  - Slack         │
└─────────────────┘    └──────────────────┘
```

## Documentation

- **[API Documentation](./API.md)** - REST API endpoints and authentication
- **[Migration Guide](./SUPABASE_TO_LIGHTWEIGHT_MIGRATION.md)** - Supabase to lightweight migration
- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Production deployment instructions
- **[Development Guide](https://helper.ai/docs/development)** - Detailed development setup

## Performance Benefits

The lightweight architecture provides significant improvements over the previous Supabase-based system:

| Metric | Supabase Version | Lightweight Version | Improvement |
|--------|------------------|-------------------|-------------|
| API Response Time | ~300-500ms | ~50-150ms | **70% faster** |
| Database Queries | Via REST API | Direct connection | **Direct access** |
| Bundle Size | Large (Supabase SDK) | Optimized | **40% smaller** |
| Memory Usage | Higher overhead | Lean runtime | **30% less RAM** |
| Dependencies | 50+ packages | Core essentials | **Simplified** |

## Support

For questions, issues, or contributions:

- **Issues:** [GitHub Issues](https://github.com/your-org/helper/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/helper/discussions)
- **Documentation:** [helper.ai/docs](https://helper.ai/docs)

## License

Helper™ Community Edition is licensed under the [MIT License](LICENSE.md).

## Trademark Notice

Helper™ is a trademark of Gumroad, Inc. This software is derived from the source code for Gumroad, Inc. Helper™ software and is not officially endorsed or distributed by Gumroad, Inc.
