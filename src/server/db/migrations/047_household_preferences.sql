-- Onboarding skips ("activation") are household data, not per-profile looks.
-- Copy the main (lowest-id) profile's value to the shared 'household' row, falling back to any other copy.
-- Non-destructive: per-profile rows stay; the app just stops reading them.
INSERT OR IGNORE INTO synced_preferences (workspace_id, profile, key, value, revision)
SELECT s.workspace_id, 'household', s.key, s.value, 1
FROM synced_preferences s
LEFT JOIN profiles p ON s.profile = 'p' || p.id AND p.workspace_id = s.workspace_id
WHERE s.key = 'activation'
ORDER BY s.workspace_id, s.key, p.id IS NULL, p.id;
