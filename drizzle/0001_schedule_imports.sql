CREATE TABLE IF NOT EXISTS schedule_imports (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS schedule_imports_user_created_idx ON schedule_imports(user_id, created_at);

ALTER TABLE schedule_blocks ADD COLUMN description TEXT;
ALTER TABLE schedule_blocks ADD COLUMN import_id TEXT REFERENCES schedule_imports(id) ON DELETE CASCADE;
ALTER TABLE schedule_blocks ADD COLUMN source_uid TEXT;
CREATE INDEX IF NOT EXISTS schedule_blocks_import_idx ON schedule_blocks(import_id);
CREATE INDEX IF NOT EXISTS schedule_blocks_source_uid_idx ON schedule_blocks(user_id, source_uid);
