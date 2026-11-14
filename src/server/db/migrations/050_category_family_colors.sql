-- Color families: each top-level group gets its own hue, its subcategories shades of it.
-- Data-driven in category-colors.ts (applyFamilyColors), which migrate.ts runs inside this
-- migration's transaction after a DB backup. Only seeded (never user-picked) colors change.
SELECT 1;
