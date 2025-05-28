#!/bin/bash

# Set error handling
set -e

# Database path
DB_PATH="/opt/render/project/src/data/poker.db"
BACKUP_PATH="/opt/render/project/src/data/backup"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_PATH"

# Create backup with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_PATH/poker_${TIMESTAMP}.db"
echo "Creating backup at: $BACKUP_FILE"
cp "$DB_PATH" "$BACKUP_FILE"

# Function to execute SQL commands
execute_sql() {
    sqlite3 "$DB_PATH" "$1"
}

echo "Starting database update..."

# Check if groups table exists
if ! execute_sql "SELECT name FROM sqlite_master WHERE type='table' AND name='groups';" | grep -q "groups"; then
    echo "Creating groups table..."
    execute_sql "
    CREATE TABLE groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        createdAt TEXT NOT NULL,
        createdBy TEXT NOT NULL,
        isActive INTEGER DEFAULT 1,
        FOREIGN KEY (createdBy) REFERENCES users(id)
    );"
    echo "Groups table created successfully"
else
    echo "Groups table already exists"
fi

# Check if groupId column exists in tables
if ! execute_sql "PRAGMA table_info(tables);" | grep -q "groupId"; then
    echo "Adding groupId column to tables..."
    execute_sql "ALTER TABLE tables ADD COLUMN groupId TEXT REFERENCES groups(id);"
    echo "groupId column added successfully"
else
    echo "groupId column already exists"
fi

# Create default group if no groups exist
if ! execute_sql "SELECT COUNT(*) FROM groups;" | grep -q "[1-9]"; then
    echo "Creating default group..."
    DEFAULT_GROUP_ID=$(uuidgen)
    DEFAULT_ADMIN_ID=$(execute_sql "SELECT id FROM users WHERE username='admin' LIMIT 1;")
    CURRENT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    execute_sql "
    INSERT INTO groups (id, name, description, createdAt, createdBy, isActive)
    VALUES ('$DEFAULT_GROUP_ID', 'Default Group', 'Default group for existing tables', '$CURRENT_TIME', '$DEFAULT_ADMIN_ID', 1);"
    
    echo "Default group created successfully"
    
    # Update existing tables to use the default group
    echo "Updating existing tables to use default group..."
    execute_sql "UPDATE tables SET groupId = '$DEFAULT_GROUP_ID' WHERE groupId IS NULL;"
    echo "Existing tables updated successfully"
fi

# Verify the changes
echo "Verifying changes..."
echo "Groups table structure:"
execute_sql ".schema groups"

echo "Tables table structure:"
execute_sql ".schema tables"

echo "Number of groups:"
execute_sql "SELECT COUNT(*) FROM groups;"

echo "Number of tables with groupId:"
execute_sql "SELECT COUNT(*) FROM tables WHERE groupId IS NOT NULL;"

echo "Database update completed successfully!" 