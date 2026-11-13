CREATE TABLE app_users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,is_admin INTEGER NOT NULL DEFAULT 0,disabled INTEGER NOT NULL DEFAULT 0);
CREATE TABLE workspace_members(user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('viewer','editor')),PRIMARY KEY(user_id,workspace_id));
CREATE TABLE user_sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,expires_at TEXT NOT NULL);
CREATE TABLE access_attempts(username TEXT PRIMARY KEY,failures INTEGER NOT NULL DEFAULT 0,blocked_until INTEGER NOT NULL DEFAULT 0);
CREATE TABLE access_audit(id INTEGER PRIMARY KEY,user_id INTEGER,action TEXT NOT NULL,workspace_id INTEGER,created_at TEXT NOT NULL DEFAULT(datetime('now')));
