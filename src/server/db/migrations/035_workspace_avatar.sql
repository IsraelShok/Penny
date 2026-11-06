-- Profiles ("מי משתמש?") are workspaces with an avatar: an emoji and a palette colour.
ALTER TABLE workspaces ADD COLUMN avatar_emoji TEXT;
ALTER TABLE workspaces ADD COLUMN avatar_color TEXT;
