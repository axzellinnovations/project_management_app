-- Supabase/managed Postgres can enforce a low statement_timeout.
-- Disable it only for this migration transaction so large backfills can complete.
SET LOCAL statement_timeout = 0;

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS project_task_number BIGINT,
    ADD COLUMN IF NOT EXISTS backlog_position INTEGER,
    ADD COLUMN IF NOT EXISTS sprint_position INTEGER;

-- Chunk-safe backfill: process one project/sprint at a time
-- so each statement is smaller and less likely to hit managed DB limits.
DO $$
DECLARE
    v_project_id BIGINT;
    v_start BIGINT;
BEGIN
    FOR v_project_id IN
        SELECT DISTINCT project_id
        FROM tasks
        WHERE project_id IS NOT NULL
          AND project_task_number IS NULL
    LOOP
        SELECT COALESCE(MAX(project_task_number), 0)
        INTO v_start
        FROM tasks
        WHERE project_id = v_project_id;

        WITH ordered AS (
            SELECT id,
                   ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
            FROM tasks
            WHERE project_id = v_project_id
              AND project_task_number IS NULL
        )
        UPDATE tasks t
        SET project_task_number = v_start + ordered.rn
        FROM ordered
        WHERE t.id = ordered.id;
    END LOOP;
END $$;

DO $$
DECLARE
    v_project_id BIGINT;
    v_start INTEGER;
BEGIN
    FOR v_project_id IN
        SELECT DISTINCT project_id
        FROM tasks
        WHERE project_id IS NOT NULL
          AND sprint_id IS NULL
          AND backlog_position IS NULL
    LOOP
        SELECT COALESCE(MAX(backlog_position), -1)
        INTO v_start
        FROM tasks
        WHERE project_id = v_project_id
          AND sprint_id IS NULL;

        WITH ordered AS (
            SELECT id,
                   ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
            FROM tasks
            WHERE project_id = v_project_id
              AND sprint_id IS NULL
              AND backlog_position IS NULL
        )
        UPDATE tasks t
        SET backlog_position = v_start + 1 + ordered.rn
        FROM ordered
        WHERE t.id = ordered.id;
    END LOOP;
END $$;

DO $$
DECLARE
    v_sprint_id BIGINT;
    v_start INTEGER;
BEGIN
    FOR v_sprint_id IN
        SELECT DISTINCT sprint_id
        FROM tasks
        WHERE sprint_id IS NOT NULL
          AND sprint_position IS NULL
    LOOP
        SELECT COALESCE(MAX(sprint_position), -1)
        INTO v_start
        FROM tasks
        WHERE sprint_id = v_sprint_id;

        WITH ordered AS (
            SELECT id,
                   ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
            FROM tasks
            WHERE sprint_id = v_sprint_id
              AND sprint_position IS NULL
        )
        UPDATE tasks t
        SET sprint_position = v_start + 1 + ordered.rn
        FROM ordered
        WHERE t.id = ordered.id;
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_project_sequence
    ON tasks (project_id, project_task_number);

CREATE INDEX IF NOT EXISTS idx_tasks_backlog_position
    ON tasks (project_id, backlog_position)
    WHERE sprint_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_sprint_position
    ON tasks (sprint_id, sprint_position)
    WHERE sprint_id IS NOT NULL;
