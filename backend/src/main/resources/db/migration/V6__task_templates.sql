-- V6: Task templates per project
-- DROP first to handle any stale table created by Hibernate ddl-auto or a previous partial run.
-- Since V6 was never successfully applied to the database, no user data is at risk.
DROP TABLE IF EXISTS task_templates CASCADE;

CREATE TABLE task_templates (
    id            BIGSERIAL    PRIMARY KEY,
    project_id    BIGINT       NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name          VARCHAR(200) NOT NULL,
    title         VARCHAR(500) NOT NULL,
    description   TEXT,
    priority      VARCHAR(20),
    story_point   INT          NOT NULL DEFAULT 0,
    label_ids     TEXT,        -- JSON array of label IDs
    created_at    TIMESTAMP    NOT NULL DEFAULT now(),
    created_by_id BIGINT       REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX idx_task_templates_project ON task_templates(project_id);
