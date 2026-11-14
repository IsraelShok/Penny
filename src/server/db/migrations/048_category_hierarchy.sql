-- Two-level category tree (parents -> subcategories) with Israeli household groups.
-- The work is data-driven and lives in category-hierarchy.ts (applyCategoryHierarchy),
-- which migrate.ts runs inside this migration's transaction, after a DB backup.
SELECT 1;
