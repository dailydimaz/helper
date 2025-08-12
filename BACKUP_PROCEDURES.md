# Backup & Recovery Procedures

This document outlines comprehensive backup and recovery procedures for the Helper AI application, ensuring data integrity and business continuity.

## Overview

The backup strategy covers:
- **Database backups** - PostgreSQL data and schema
- **File storage backups** - User uploads and generated files  
- **Configuration backups** - Environment variables and settings
- **Application backups** - Code deployment artifacts

## Database Backup Procedures

### Automated Daily Backups

Create an automated backup script that runs daily:

```bash
#!/bin/bash
# File: scripts/backup-database.sh

set -e

# Configuration
BACKUP_DIR="/backups/database"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
DATABASE_URL="${DATABASE_URL}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup with compression
echo "Starting database backup at $(date)"
pg_dump "$DATABASE_URL" | gzip > "${BACKUP_DIR}/backup_${DATE}.sql.gz"

# Verify backup integrity
if gzip -t "${BACKUP_DIR}/backup_${DATE}.sql.gz"; then
    echo "✅ Backup created successfully: backup_${DATE}.sql.gz"
    
    # Calculate size
    SIZE=$(du -h "${BACKUP_DIR}/backup_${DATE}.sql.gz" | cut -f1)
    echo "Backup size: $SIZE"
    
    # Upload to cloud storage (optional)
    if [ -n "$AWS_S3_BACKUP_BUCKET" ]; then
        aws s3 cp "${BACKUP_DIR}/backup_${DATE}.sql.gz" \
            "s3://$AWS_S3_BACKUP_BUCKET/database-backups/"
        echo "✅ Backup uploaded to S3"
    fi
    
    # Clean up old local backups
    find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    echo "✅ Old backups cleaned up (retention: ${RETENTION_DAYS} days)"
    
else
    echo "❌ Backup verification failed"
    exit 1
fi

echo "Database backup completed at $(date)"
```

### Manual Backup Commands

#### Full Database Backup
```bash
# Create compressed backup
pg_dump "$DATABASE_URL" | gzip > "backup_$(date +%Y%m%d_%H%M%S).sql.gz"

# Create plain SQL backup  
pg_dump "$DATABASE_URL" > "backup_$(date +%Y%m%d_%H%M%S).sql"

# Backup specific tables only
pg_dump "$DATABASE_URL" \
  --table=users \
  --table=conversations \
  --table=conversation_messages \
  > "essential_tables_backup.sql"
```

#### Schema-Only Backup
```bash
# Backup database schema without data
pg_dump "$DATABASE_URL" --schema-only > "schema_backup.sql"

# Backup data without schema
pg_dump "$DATABASE_URL" --data-only > "data_backup.sql"
```

### Backup Verification

Always verify backup integrity:

```bash
#!/bin/bash
# File: scripts/verify-backup.sh

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    exit 1
fi

echo "Verifying backup: $BACKUP_FILE"

# Check if file exists and is readable
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found"
    exit 1
fi

# Verify gzip integrity
if [[ "$BACKUP_FILE" == *.gz ]]; then
    if gzip -t "$BACKUP_FILE"; then
        echo "✅ Gzip integrity check passed"
    else
        echo "❌ Gzip integrity check failed"
        exit 1
    fi
fi

# Check backup content
if [[ "$BACKUP_FILE" == *.gz ]]; then
    SAMPLE=$(zcat "$BACKUP_FILE" | head -20)
else
    SAMPLE=$(head -20 "$BACKUP_FILE")
fi

if echo "$SAMPLE" | grep -q "PostgreSQL database dump"; then
    echo "✅ Backup format validation passed"
else
    echo "❌ Invalid backup format"
    exit 1
fi

# Count expected tables in backup
TABLE_COUNT=$(if [[ "$BACKUP_FILE" == *.gz ]]; then zcat "$BACKUP_FILE"; else cat "$BACKUP_FILE"; fi | \
              grep -c "CREATE TABLE" || true)

echo "📊 Tables found in backup: $TABLE_COUNT"

if [ "$TABLE_COUNT" -lt 10 ]; then
    echo "⚠️  Warning: Low table count, backup may be incomplete"
else
    echo "✅ Backup verification completed successfully"
fi
```

## File Storage Backup

### Local File System Backup

```bash
#!/bin/bash  
# File: scripts/backup-files.sh

set -e

# Configuration
FILES_DIR="file-storage"
BACKUP_DIR="/backups/files"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

echo "Starting file storage backup at $(date)"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create compressed archive
tar -czf "${BACKUP_DIR}/files_${DATE}.tar.gz" \
    -C "$FILES_DIR" \
    --exclude="*.tmp" \
    --exclude="cache/*" \
    .

# Verify backup
if tar -tzf "${BACKUP_DIR}/files_${DATE}.tar.gz" >/dev/null; then
    SIZE=$(du -h "${BACKUP_DIR}/files_${DATE}.tar.gz" | cut -f1)
    echo "✅ File backup created: files_${DATE}.tar.gz ($SIZE)"
    
    # Upload to cloud storage
    if [ -n "$AWS_S3_BACKUP_BUCKET" ]; then
        aws s3 cp "${BACKUP_DIR}/files_${DATE}.tar.gz" \
            "s3://$AWS_S3_BACKUP_BUCKET/file-backups/"
        echo "✅ File backup uploaded to S3"
    fi
    
    # Clean up old backups
    find "$BACKUP_DIR" -name "files_*.tar.gz" -mtime +$RETENTION_DAYS -delete
    
else
    echo "❌ File backup verification failed"
    exit 1
fi

echo "File storage backup completed at $(date)"
```

### Incremental File Backup

For large file storage, use rsync for incremental backups:

```bash
#!/bin/bash
# File: scripts/backup-files-incremental.sh

SOURCE_DIR="file-storage/"
BACKUP_DIR="/backups/files-incremental/"
LOG_FILE="/var/log/helperai-backup.log"

# Create incremental backup using rsync
rsync -av \
  --delete \
  --link-dest="${BACKUP_DIR}/latest" \
  "$SOURCE_DIR" \
  "${BACKUP_DIR}/$(date +%Y%m%d_%H%M%S)/" \
  2>&1 | tee -a "$LOG_FILE"

# Update 'latest' symlink
ln -sfn "${BACKUP_DIR}/$(date +%Y%m%d_%H%M%S)" "${BACKUP_DIR}/latest"

echo "Incremental backup completed at $(date)" | tee -a "$LOG_FILE"
```

## Configuration Backup

### Environment Variables Backup

```bash
#!/bin/bash
# File: scripts/backup-config.sh

BACKUP_DIR="/backups/config"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup environment configuration (excluding secrets)
cat > "${BACKUP_DIR}/env_backup_${DATE}.txt" << EOF
# Environment backup created on $(date)
# Secrets have been redacted for security

NODE_ENV=${NODE_ENV}
NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Database configuration (connection details redacted)
DATABASE_PROVIDER=postgresql
DATABASE_SSL_MODE=require

# Features enabled
ENABLE_VECTOR_SEARCH=${ENABLE_VECTOR_SEARCH}
ENABLE_FULL_TEXT_SEARCH=${ENABLE_FULL_TEXT_SEARCH}
ENABLE_BACKGROUND_JOBS=${ENABLE_BACKGROUND_JOBS}

# Integrations configured
GOOGLE_OAUTH_ENABLED=$( [ -n "$GOOGLE_CLIENT_ID" ] && echo "true" || echo "false" )
SLACK_INTEGRATION_ENABLED=$( [ -n "$SLACK_CLIENT_ID" ] && echo "true" || echo "false" )
GITHUB_INTEGRATION_ENABLED=$( [ -n "$GITHUB_APP_ID" ] && echo "true" || echo "false" )

# Monitoring
SENTRY_ENABLED=$( [ -n "$NEXT_PUBLIC_SENTRY_DSN" ] && echo "true" || echo "false" )

EOF

echo "✅ Configuration backup created: env_backup_${DATE}.txt"
```

## Backup Scheduling

### Cron Configuration

Add to your system crontab (`crontab -e`):

```bash
# Helper AI Backup Schedule

# Database backup - Daily at 2:00 AM
0 2 * * * /opt/helperai/scripts/backup-database.sh >> /var/log/helperai-backup.log 2>&1

# File storage backup - Daily at 3:00 AM  
0 3 * * * /opt/helperai/scripts/backup-files.sh >> /var/log/helperai-backup.log 2>&1

# Configuration backup - Weekly on Sunday at 4:00 AM
0 4 * * 0 /opt/helperai/scripts/backup-config.sh >> /var/log/helperai-backup.log 2>&1

# Backup verification - Daily at 5:00 AM
0 5 * * * /opt/helperai/scripts/verify-latest-backups.sh >> /var/log/helperai-backup.log 2>&1

# Clean up old logs - Monthly
0 0 1 * * find /var/log -name "*helperai*" -mtime +90 -delete
```

### Systemd Timer (Alternative)

Create systemd timer for backup automation:

```ini
# File: /etc/systemd/system/helperai-backup.service
[Unit]
Description=Helper AI Backup Service
After=network.target

[Service]
Type=oneshot
User=helperai
ExecStart=/opt/helperai/scripts/full-backup.sh
```

```ini
# File: /etc/systemd/system/helperai-backup.timer
[Unit]
Description=Helper AI Backup Timer
Requires=helperai-backup.service

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

Enable the timer:
```bash
sudo systemctl enable helperai-backup.timer
sudo systemctl start helperai-backup.timer
```

## Recovery Procedures

### Database Recovery

#### Full Database Restore
```bash
#!/bin/bash
# File: scripts/restore-database.sh

BACKUP_FILE="$1"
DATABASE_URL="$2"

if [ -z "$BACKUP_FILE" ] || [ -z "$DATABASE_URL" ]; then
    echo "Usage: $0 <backup_file> <database_url>"
    echo "Example: $0 backup_20250115_020000.sql.gz postgresql://user:pass@host:port/db"
    exit 1
fi

echo "🔄 Starting database restore from: $BACKUP_FILE"
echo "⚠️  WARNING: This will overwrite the target database!"
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Create a backup of current database before restore
echo "📦 Creating safety backup of current database..."
pg_dump "$DATABASE_URL" | gzip > "pre_restore_backup_$(date +%Y%m%d_%H%M%S).sql.gz"

# Drop existing connections
echo "🔌 Terminating active connections..."
psql "$DATABASE_URL" -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = current_database() AND pid != pg_backend_pid();"

# Restore from backup
echo "🔄 Restoring database..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    zcat "$BACKUP_FILE" | psql "$DATABASE_URL"
else
    psql "$DATABASE_URL" < "$BACKUP_FILE"
fi

# Run any post-restore scripts
if [ -f "scripts/post-restore.sql" ]; then
    echo "⚙️  Running post-restore scripts..."
    psql "$DATABASE_URL" -f "scripts/post-restore.sql"
fi

echo "✅ Database restore completed successfully"
echo "🔍 Run application tests to verify restore integrity"
```

#### Selective Table Restore
```bash
# Restore specific tables only
pg_restore -t users -t conversations backup.dump | psql "$DATABASE_URL"

# Restore data to existing tables (truncate first)
pg_restore --data-only --disable-triggers backup.dump | psql "$DATABASE_URL"
```

### File Storage Recovery

```bash
#!/bin/bash
# File: scripts/restore-files.sh

BACKUP_FILE="$1"
TARGET_DIR="${2:-file-storage}"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.tar.gz> [target_directory]"
    exit 1
fi

echo "🔄 Restoring files from: $BACKUP_FILE"

# Create target directory
mkdir -p "$TARGET_DIR"

# Extract files
if tar -xzf "$BACKUP_FILE" -C "$TARGET_DIR"; then
    echo "✅ Files restored successfully to: $TARGET_DIR"
    
    # Set proper permissions
    chmod -R 755 "$TARGET_DIR"
    
    # Verify restoration
    FILE_COUNT=$(find "$TARGET_DIR" -type f | wc -l)
    echo "📊 Restored $FILE_COUNT files"
    
else
    echo "❌ File restore failed"
    exit 1
fi
```

### Point-in-Time Recovery

For PostgreSQL installations with WAL archiving:

```bash
#!/bin/bash
# Point-in-time recovery script

TARGET_TIME="$1"  # Format: '2025-01-15 14:30:00'
BASE_BACKUP="$2"

if [ -z "$TARGET_TIME" ] || [ -z "$BASE_BACKUP" ]; then
    echo "Usage: $0 'YYYY-MM-DD HH:MM:SS' <base_backup_file>"
    exit 1
fi

echo "🔄 Starting point-in-time recovery to: $TARGET_TIME"

# Stop database service
sudo systemctl stop postgresql

# Restore base backup
tar -xzf "$BASE_BACKUP" -C /var/lib/postgresql/data/

# Create recovery configuration
cat > /var/lib/postgresql/data/recovery.conf << EOF
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
recovery_target_time = '$TARGET_TIME'
recovery_target_action = 'promote'
EOF

# Start PostgreSQL in recovery mode
sudo systemctl start postgresql

echo "✅ Point-in-time recovery initiated"
echo "🔍 Monitor PostgreSQL logs for recovery completion"
```

## Disaster Recovery Plan

### Recovery Time Objectives (RTO)

| Component | Target RTO | Notes |
|-----------|------------|-------|
| Database | 30 minutes | Using latest backup |
| File Storage | 15 minutes | From cloud storage |
| Application | 10 minutes | Redeploy from Git |
| DNS/Networking | 5 minutes | Update DNS records |

### Recovery Point Objectives (RPO)

| Component | Target RPO | Backup Frequency |
|-----------|------------|------------------|
| Database | 24 hours | Daily backups |
| File Storage | 24 hours | Daily backups |
| Configuration | 1 week | Weekly backups |

### Emergency Contact Information

Maintain an emergency contact list:
```bash
# File: emergency-contacts.txt
# Infrastructure Team
Primary: +1-555-0101 (Alice Smith)
Secondary: +1-555-0102 (Bob Johnson)

# Database Administrator  
Primary: +1-555-0201 (Carol Davis)

# DevOps/Platform
Primary: +1-555-0301 (Dave Wilson)

# Management Escalation
Director: +1-555-0401 (Eve Anderson)
```

## Backup Monitoring & Alerting

### Backup Health Check Script

```bash
#!/bin/bash
# File: scripts/monitor-backups.sh

BACKUP_DIRS=("/backups/database" "/backups/files")
ALERT_EMAIL="alerts@company.com"
MAX_AGE_HOURS=26  # Expect daily backups

for DIR in "${BACKUP_DIRS[@]}"; do
    echo "Checking backups in: $DIR"
    
    # Find most recent backup
    LATEST_BACKUP=$(find "$DIR" -name "backup_*" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [ -z "$LATEST_BACKUP" ]; then
        echo "❌ No backups found in $DIR"
        echo "ALERT: No backups found in $DIR" | mail -s "Backup Alert: Missing Backups" "$ALERT_EMAIL"
        continue
    fi
    
    # Check backup age
    BACKUP_AGE=$(find "$LATEST_BACKUP" -mtime +1 -print)
    if [ -n "$BACKUP_AGE" ]; then
        echo "❌ Latest backup is older than 24 hours: $LATEST_BACKUP"
        echo "ALERT: Backup in $DIR is older than 24 hours" | mail -s "Backup Alert: Stale Backup" "$ALERT_EMAIL"
    else
        echo "✅ Recent backup found: $LATEST_BACKUP"
    fi
    
    # Verify backup integrity
    if [[ "$LATEST_BACKUP" == *.sql.gz ]]; then
        if gzip -t "$LATEST_BACKUP"; then
            echo "✅ Backup integrity verified"
        else
            echo "❌ Backup integrity check failed"
            echo "ALERT: Backup integrity check failed for $LATEST_BACKUP" | mail -s "Backup Alert: Corrupted Backup" "$ALERT_EMAIL"
        fi
    fi
done
```

### Nagios/Prometheus Monitoring

Example monitoring configuration:

```yaml
# prometheus-backup-monitoring.yml
groups:
- name: backup_monitoring
  rules:
  - alert: BackupMissing
    expr: time() - backup_last_success_timestamp > 86400
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Database backup has not completed in over 24 hours"
      
  - alert: BackupFailed
    expr: backup_last_status != 1
    for: 0m
    labels:
      severity: critical
    annotations:
      summary: "Last backup attempt failed"
```

## Best Practices

### Security
- Encrypt backups containing sensitive data
- Store backup credentials securely 
- Test backup restoration regularly
- Maintain separate backup infrastructure

### Storage
- Use immutable storage for critical backups
- Implement 3-2-1 backup rule (3 copies, 2 different media, 1 offsite)
- Monitor backup storage capacity
- Regular backup cleanup and rotation

### Documentation
- Document all backup procedures
- Maintain recovery runbooks
- Test disaster recovery procedures
- Update contact information regularly

### Automation
- Automate backup creation and verification
- Set up monitoring and alerting
- Use configuration management for backup scripts
- Implement self-healing backup systems

## Backup Testing Schedule

| Test Type | Frequency | Description |
|-----------|-----------|-------------|
| Backup Verification | Daily | Automated integrity checks |
| Partial Recovery | Weekly | Restore single table/file |
| Full Recovery | Monthly | Complete system restoration |
| Disaster Recovery | Quarterly | Full DR procedure test |
| Documentation Review | Semi-annually | Update procedures and contacts |

---

Remember: **Backups are only as good as your ability to restore from them.** Regular testing is essential for a reliable backup strategy.