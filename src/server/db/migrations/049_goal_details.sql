-- A goal can be a vacation plan: kind 'vacation' with its dates, travelers and budget lines as JSON in details.
-- The columns are added in migrate.ts (addGoalDetails) only when missing: a DB that ran this file under an earlier name already has them.
SELECT 1;
