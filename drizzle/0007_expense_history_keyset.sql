ALTER TABLE expenses ADD COLUMN history_date_key TEXT;
ALTER TABLE expenses ADD COLUMN history_occurred_at_ms INTEGER;
ALTER TABLE expenses ADD COLUMN history_fallback_ms INTEGER;

CREATE TABLE expense_history_revisions (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX expenses_user_history_keyset_idx
  ON expenses(
    user_id,
    deleted_at,
    history_date_key DESC,
    history_occurred_at_ms DESC,
    history_fallback_ms DESC,
    id ASC
  );

CREATE TRIGGER expenses_history_revision_after_insert
AFTER INSERT ON expenses
BEGIN
  INSERT INTO expense_history_revisions (user_id, revision) VALUES (NEW.user_id, 1)
  ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;

CREATE TRIGGER expenses_history_revision_after_update
AFTER UPDATE ON expenses
BEGIN
  INSERT INTO expense_history_revisions (user_id, revision) VALUES (NEW.user_id, 1)
  ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;

CREATE TRIGGER expenses_history_revision_after_delete
AFTER DELETE ON expenses
BEGIN
  INSERT INTO expense_history_revisions (user_id, revision) VALUES (OLD.user_id, 1)
  ON CONFLICT(user_id) DO UPDATE SET revision = revision + 1;
END;
