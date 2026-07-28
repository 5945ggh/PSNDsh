ALTER TABLE schedule_imports ADD COLUMN source_key TEXT;
ALTER TABLE schedule_imports ADD COLUMN source_name TEXT;
ALTER TABLE schedule_imports ADD COLUMN updated_at TEXT;
ALTER TABLE schedule_imports ADD COLUMN change_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE schedule_blocks ADD COLUMN source_instance_key TEXT;

CREATE INDEX IF NOT EXISTS schedule_imports_user_source_idx
  ON schedule_imports(user_id, source_key);
CREATE INDEX IF NOT EXISTS schedule_blocks_import_instance_idx
  ON schedule_blocks(import_id, source_instance_key);
