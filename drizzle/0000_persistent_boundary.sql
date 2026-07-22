PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT,
  nickname TEXT,
  profile_email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES entries(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  completion_mode TEXT NOT NULL CHECK (completion_mode IN ('ongoing', 'completable')),
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  due_at TEXT,
  sort_key TEXT NOT NULL,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS entries_user_parent_idx ON entries(user_id, parent_id);
CREATE INDEX IF NOT EXISTS entries_user_deleted_idx ON entries(user_id, deleted_at);

CREATE TABLE IF NOT EXISTS week_plans (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, week_start)
);

CREATE TABLE IF NOT EXISTS week_plan_entries (
  id TEXT PRIMARY KEY NOT NULL,
  week_plan_id TEXT NOT NULL REFERENCES week_plans(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE RESTRICT,
  source TEXT NOT NULL CHECK (source IN ('manual', 'rollover')),
  sort_key TEXT NOT NULL,
  UNIQUE(week_plan_id, entry_id)
);
CREATE INDEX IF NOT EXISTS week_plan_entries_order_idx ON week_plan_entries(week_plan_id, sort_key);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  capture_mode TEXT NOT NULL CHECK (capture_mode IN ('timer', 'manual')),
  note TEXT,
  outcome TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS focus_sessions_user_range_idx ON focus_sessions(user_id, started_at);
CREATE UNIQUE INDEX IF NOT EXISTS focus_sessions_one_active_per_user
  ON focus_sessions(user_id) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS focus_segments (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  entry_id TEXT REFERENCES entries(id) ON DELETE SET NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS focus_segments_session_order_idx ON focus_segments(session_id, started_at);
CREATE INDEX IF NOT EXISTS focus_segments_entry_idx ON focus_segments(entry_id);

CREATE TABLE IF NOT EXISTS schedule_blocks (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('course', 'plan', 'other')),
  title TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  location TEXT,
  color_key TEXT,
  recurrence_json TEXT,
  source TEXT NOT NULL CHECK (source IN ('manual', 'ics')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS schedule_blocks_user_range_idx ON schedule_blocks(user_id, started_at);
