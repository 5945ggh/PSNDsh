ALTER TABLE week_plan_entries ADD COLUMN role TEXT NOT NULL DEFAULT 'commitment'
  CHECK (role IN ('focus', 'commitment'));
ALTER TABLE week_plan_entries ADD COLUMN planned_focus_seconds INTEGER;

UPDATE week_plan_entries
SET role = 'focus'
WHERE entry_id IN (
  SELECT id FROM entries WHERE completion_mode = 'ongoing'
);
