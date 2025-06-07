#!/bin/bash

# Set error handling
set -e

echo "Starting database update script..."

# Navigate to the data directory
cd /opt/render/project/src/data

# Check if the database file exists
if [ ! -f "poker.db" ]; then
    echo "Error: poker.db not found in /opt/render/project/src/data"
    exit 1
fi

# Check if the food column already exists
if sqlite3 poker.db "PRAGMA table_info(tables);" | grep -q "food"; then
    echo "Food column already exists in tables table"
else
    echo "Adding food column to tables table..."
    sqlite3 poker.db "ALTER TABLE tables ADD COLUMN food TEXT;"
    echo "Food column added successfully"
fi

# Verify the column was added
echo "Verifying table structure..."
sqlite3 poker.db "PRAGMA table_info(tables);"

echo "Database update completed successfully!" 