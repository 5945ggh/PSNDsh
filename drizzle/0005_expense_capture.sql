CREATE TABLE expense_categories (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX expense_categories_user_archived_idx ON expense_categories(user_id, archived_at);

CREATE TABLE expense_tags (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX expense_tags_user_archived_idx ON expense_tags(user_id, archived_at);

CREATE TABLE payment_methods (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX payment_methods_user_archived_idx ON payment_methods(user_id, archived_at);

CREATE TABLE expenses (
  row_id TEXT PRIMARY KEY NOT NULL,
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'CNY' CHECK (currency = 'CNY'),
  occurred_at TEXT,
  occurred_on TEXT,
  occurred_timezone TEXT,
  occurrence_precision TEXT NOT NULL CHECK (occurrence_precision IN ('datetime', 'date')),
  recorded_at TEXT NOT NULL,
  capture_message TEXT,
  note TEXT,
  category_id TEXT REFERENCES expense_categories(id) ON DELETE RESTRICT,
  payment_method_id TEXT REFERENCES payment_methods(id) ON DELETE RESTRICT,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'reviewed')),
  recognition_status TEXT NOT NULL DEFAULT 'recognized' CHECK (recognition_status = 'recognized'),
  recoverable_cents INTEGER NOT NULL DEFAULT 0 CHECK (recoverable_cents >= 0 AND recoverable_cents <= amount_cents),
  settled INTEGER NOT NULL DEFAULT 0 CHECK (settled IN (0, 1)),
  source TEXT NOT NULL DEFAULT 'shortcut' CHECK (source IN ('shortcut', 'manual')),
  latitude REAL CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude REAL CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    (occurrence_precision = 'datetime' AND occurred_at IS NOT NULL AND occurred_on IS NULL)
    OR
    (occurrence_precision = 'date' AND occurred_at IS NULL AND occurred_on IS NOT NULL)
  ),
  UNIQUE(user_id, id)
);
CREATE INDEX expenses_user_active_recorded_idx ON expenses(user_id, deleted_at, recorded_at);
CREATE INDEX expenses_user_inbox_idx ON expenses(user_id, review_status, deleted_at, recorded_at);

CREATE TABLE expense_record_tags (
  id TEXT PRIMARY KEY NOT NULL,
  expense_row_id TEXT NOT NULL REFERENCES expenses(row_id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES expense_tags(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  UNIQUE(expense_row_id, tag_id)
);
CREATE INDEX expense_record_tags_tag_idx ON expense_record_tags(tag_id);
