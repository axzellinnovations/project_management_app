-- V4: Multiple assignees per task
-- A task can now have many assignees; existing single assignee_id column is preserved for backward compat.

CREATE TABLE IF NOT EXISTS task_assignees (
    task_id   BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, member_id)
);
