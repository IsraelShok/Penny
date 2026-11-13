ALTER TABLE goal_rules ADD COLUMN transaction_sign INTEGER NOT NULL DEFAULT -1 CHECK(transaction_sign IN (-1,1));
