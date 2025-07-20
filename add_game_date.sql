-- Add gameDate column to tables table
-- This separates the game date from the creation date
ALTER TABLE tables ADD COLUMN gameDate DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Update existing tables to set gameDate to createdAt for backward compatibility
UPDATE tables SET gameDate = createdAt WHERE gameDate IS NULL;

-- Verify the changes
PRAGMA table_info(tables); 