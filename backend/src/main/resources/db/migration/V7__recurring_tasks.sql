-- V7: Recurring task support — extend the tasks table

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_rule       VARCHAR(30);   -- DAILY | WEEKLY | MONTHLY | YEARLY
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_end        DATE;          -- null = recur indefinitely
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_parent_id  BIGINT         REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS next_occurrence        DATE;          -- date the next instance should spawn

CREATE INDEX IF NOT EXISTS idx_tasks_next_occurrence ON tasks(next_occurrence) WHERE next_occurrence IS NOT NULL;
