#!/bin/bash
# ============================================================================
# Database Backup Script for fnb-ops
# ============================================================================
# This script creates a backup of the fnb-ops MySQL database
# Usage: bash backup_db.sh
# ============================================================================

set -e

# Configuration
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USER:-root}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME:-fnb_ops_db}
BACKUP_DIR="${BACKUP_DIR:-backups}"
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

echo "=========================================="
echo "fnb-ops Database Backup Script"
echo "=========================================="
echo "Database: $DB_NAME"
echo "Host: $DB_HOST:$DB_PORT"
echo "Backup location: $BACKUP_FILE_GZ"
echo "Retention: $BACKUP_RETENTION_DAYS days"
echo "=========================================="
echo ""

# Create backup
echo "[1/3] Creating backup..."
if [ -z "$DB_PASSWORD" ]; then
    # No password provided, use socket auth
    mysqldump \
        -h "$DB_HOST" \
        -P "$DB_PORT" \
        -u "$DB_USER" \
        --single-transaction \
        --quick \
        --lock-tables=false \
        "$DB_NAME" > "$BACKUP_FILE"
else
    # Use provided password
    mysqldump \
        -h "$DB_HOST" \
        -P "$DB_PORT" \
        -u "$DB_USER" \
        -p"$DB_PASSWORD" \
        --single-transaction \
        --quick \
        --lock-tables=false \
        "$DB_NAME" > "$BACKUP_FILE"
fi

if [ $? -eq 0 ]; then
    echo "✓ Backup created successfully"
else
    echo "✗ Backup failed"
    exit 1
fi
echo ""

# Compress backup
echo "[2/3] Compressing backup..."
gzip "$BACKUP_FILE"
echo "✓ Backup compressed: $(du -h "$BACKUP_FILE_GZ" | cut -f1)"
echo ""

# Clean old backups
echo "[3/3] Cleaning old backups (older than $BACKUP_RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +$BACKUP_RETENTION_DAYS -delete
echo "✓ Old backups removed"
echo ""

# Summary
echo "=========================================="
echo "✓ Backup completed successfully!"
echo "=========================================="
echo ""
echo "Backup location: $BACKUP_FILE_GZ"
echo "Backup size: $(du -h "$BACKUP_FILE_GZ" | cut -f1)"
echo "Timestamp: $TIMESTAMP"
echo ""
echo "To restore this backup, use:"
echo "  gunzip -c $BACKUP_FILE_GZ | mysql -h $DB_HOST -u $DB_USER -p $DB_NAME"
