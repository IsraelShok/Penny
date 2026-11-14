-- Each profile picks its own Pip (look, colour, optional name) as its avatar: profiles.avatar_pet (JSON).
-- The column is added idempotently by addProfilePip in migrate.ts (SQLite has no ADD COLUMN IF NOT EXISTS).
SELECT 1;
