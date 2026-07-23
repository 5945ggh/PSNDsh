CREATE TABLE IF NOT EXISTS schedule_templates (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS schedule_templates_user_updated_idx ON schedule_templates(user_id, updated_at);

CREATE TABLE IF NOT EXISTS schedule_template_items (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  weekdays_json TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('course', 'plan', 'other')),
  location TEXT,
  color_key TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  sort_key TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS schedule_template_items_template_order_idx ON schedule_template_items(template_id, sort_key);

CREATE TABLE IF NOT EXISTS schedule_template_applications (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS schedule_template_applications_user_applied_idx ON schedule_template_applications(user_id, applied_at);

-- Rebuild the legacy table so its CHECK constraint accepts template instances.
-- The prior migrations added description/import_id/source_uid incrementally, so
-- the copy keeps every existing schedule field intact.
PRAGMA foreign_keys = OFF;
DROP INDEX IF EXISTS schedule_blocks_user_range_idx;
DROP INDEX IF EXISTS schedule_blocks_import_idx;
DROP INDEX IF EXISTS schedule_blocks_source_uid_idx;
ALTER TABLE schedule_blocks RENAME TO schedule_blocks_legacy;
CREATE TABLE schedule_blocks (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('course', 'plan', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  location TEXT,
  color_key TEXT,
  recurrence_json TEXT,
  source TEXT NOT NULL CHECK (source IN ('manual', 'ics', 'template')),
  import_id TEXT REFERENCES schedule_imports(id) ON DELETE CASCADE,
  source_uid TEXT,
  template_application_id TEXT REFERENCES schedule_template_applications(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO schedule_blocks (
  id, user_id, kind, title, description, started_at, ended_at, location,
  color_key, recurrence_json, source, import_id, source_uid,
  template_application_id, created_at, updated_at
)
SELECT id, user_id, kind, title, description, started_at, ended_at, location,
  color_key, recurrence_json, source, import_id, source_uid, NULL,
  created_at, updated_at
FROM schedule_blocks_legacy;
DROP TABLE schedule_blocks_legacy;
CREATE INDEX IF NOT EXISTS schedule_blocks_user_range_idx ON schedule_blocks(user_id, started_at);
CREATE INDEX IF NOT EXISTS schedule_blocks_import_idx ON schedule_blocks(import_id);
CREATE INDEX IF NOT EXISTS schedule_blocks_source_uid_idx ON schedule_blocks(user_id, source_uid);
CREATE INDEX IF NOT EXISTS schedule_blocks_template_application_idx ON schedule_blocks(template_application_id);
PRAGMA foreign_keys = ON;
