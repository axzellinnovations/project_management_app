ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS project_task_number BIGINT,
    ADD COLUMN IF NOT EXISTS backlog_position INTEGER,
    ADD COLUMN IF NOT EXISTS sprint_position INTEGER;

WITH project_sequence AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at, id) AS seq
    FROM tasks
)
UPDATE tasks t
SET project_task_number = ps.seq
FROM project_sequence ps
WHERE t.id = ps.id
  AND t.project_task_number IS NULL;

WITH backlog_order AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at, id) - 1 AS pos
    FROM tasks
    WHERE sprint_id IS NULL
)
UPDATE tasks t
SET backlog_position = bo.pos
FROM backlog_order bo
WHERE t.id = bo.id
  AND t.backlog_position IS NULL;

WITH sprint_order AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY sprint_id ORDER BY created_at, id) - 1 AS pos
    FROM tasks
    WHERE sprint_id IS NOT NULL
)
UPDATE tasks t
SET sprint_position = so.pos
FROM sprint_order so
WHERE t.id = so.id
  AND t.sprint_position IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_sequence
    ON tasks (project_id, project_task_number);

CREATE INDEX IF NOT EXISTS idx_tasks_backlog_position
    ON tasks (project_id, backlog_position)
    WHERE sprint_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_sprint_position
    ON tasks (sprint_id, sprint_position)
    WHERE sprint_id IS NOT NULL;
