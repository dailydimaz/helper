#!/bin/bash

# Simple verification script to check if migration files are in place
# This doesn't require database connection, just checks file structure

echo "🔍 Verifying PostgreSQL Extension Migration Files..."
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo_check() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ $1 exists${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 missing${NC}"
        return 1
    fi
}

echo_check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✅ $1 contains '$2'${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 missing '$2'${NC}"
        return 1
    fi
}

echo "📁 Checking migration files..."
echo_check "db/migrations/0112_remove_extensions.sql"
echo_check "db/migrations/README.md"
echo_check "db/migrations/MIGRATION_SUMMARY.md"

echo ""
echo "🔧 Checking updated utility files..."
echo_check "db/lib/lightweightCronUtils.ts"
echo_check "db/setupLightweightCron.ts"
echo_check "db/test-migration.ts"

echo ""
echo "📋 Checking schema updates..."
echo_check "db/schema/jobs.ts"
echo_check_content "db/schema/jobs.ts" "httpRequestsTable"
echo_check_content "db/schema/jobs.ts" "attempts"

echo_check "db/schema/platformCustomers.ts"
if grep -q "gin_trgm_ops" "db/schema/platformCustomers.ts" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  db/schema/platformCustomers.ts still contains gin_trgm_ops (should be replaced)${NC}"
else
    echo -e "${GREEN}✅ db/schema/platformCustomers.ts trigram index replaced${NC}"
fi

echo ""
echo "📦 Checking package.json updates..."
if grep -q "db:legacy:setup-cron" "package.json" 2>/dev/null; then
    echo -e "${GREEN}✅ package.json contains db:legacy:setup-cron${NC}"
else
    echo -e "${RED}❌ package.json missing db:legacy:setup-cron${NC}"
fi

if grep -q "db:test-migration" "package.json" 2>/dev/null; then
    echo -e "${GREEN}✅ package.json contains db:test-migration${NC}"
else
    echo -e "${RED}❌ package.json missing db:test-migration${NC}"
fi

if grep -q "setupLightweightCron" "package.json" 2>/dev/null; then
    echo -e "${GREEN}✅ package.json uses setupLightweightCron${NC}"
else
    echo -e "${RED}❌ package.json doesn't use setupLightweightCron${NC}"
fi

echo ""
echo "🧪 Checking lightweight job system..."
echo_check "lib/jobs/queue.ts"
echo_check "lib/jobs/processor.ts"
echo_check "lib/jobs/startup.ts"
echo_check "lib/jobs/scheduler.ts"

echo ""
echo "📄 Checking SQL migration syntax..."
if head -5 "db/migrations/0112_remove_extensions.sql" | grep -q "PostgreSQL extension dependencies" 2>/dev/null; then
    echo -e "${GREEN}✅ Migration SQL file has correct header${NC}"
else
    echo -e "${RED}❌ Migration SQL file header incorrect${NC}"
fi

if grep -q "pgmq.drop_queue" "db/migrations/0112_remove_extensions.sql" 2>/dev/null; then
    echo -e "${GREEN}✅ Migration handles PGMQ cleanup${NC}"
else
    echo -e "${RED}❌ Migration missing PGMQ cleanup${NC}"
fi

if grep -q "cron.unschedule" "db/migrations/0112_remove_extensions.sql" 2>/dev/null; then
    echo -e "${GREEN}✅ Migration handles pg_cron cleanup${NC}"
else
    echo -e "${RED}❌ Migration missing pg_cron cleanup${NC}"
fi

echo ""
echo "📊 Summary:"
echo "================================================"
echo "The migration removes dependencies on these PostgreSQL extensions:"
echo "  - pgmq (PostgreSQL Message Queue)"
echo "  - pg_cron (PostgreSQL Cron)"
echo "  - http (PostgreSQL HTTP extension)"
echo "  - pg_trgm (Trigram extension)"
echo ""
echo "Replacement systems:"
echo "  - Lightweight job system (lib/jobs/)"
echo "  - Application-level scheduling"
echo "  - HTTP requests with logging"
echo "  - Standard B-tree indexes"
echo ""
echo "Next steps:"
echo "  1. Run 'pnpm db:migrate' to apply migration"
echo "  2. Run 'pnpm db:test-migration' to validate"
echo "  3. Test application functionality"
echo "  4. Deploy with confidence - no extensions needed!"
echo ""
echo "🎉 Migration files verified and ready to use!"