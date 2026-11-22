-- The file a statement import came from, for the import history list (provider 'file' runs only).
ALTER TABLE sync_runs ADD COLUMN file_name TEXT;
