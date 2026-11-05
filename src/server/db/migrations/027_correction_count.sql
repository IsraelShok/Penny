-- How many times the same correction was made, so a repeated fix can become a rule.
ALTER TABLE category_corrections ADD COLUMN times INTEGER NOT NULL DEFAULT 1;
