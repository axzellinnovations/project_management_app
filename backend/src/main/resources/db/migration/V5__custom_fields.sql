-- V5: Custom fields per project and field values per task

CREATE TABLE IF NOT EXISTS custom_fields (
    id          BIGSERIAL    PRIMARY KEY,
    project_id  BIGINT       NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    field_type  VARCHAR(30)  NOT NULL, -- TEXT | NUMBER | DATE | SELECT
    options     TEXT,                  -- JSON array of strings (only for SELECT type)
    position    INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_field_values (
    id              BIGSERIAL PRIMARY KEY,
    task_id         BIGINT    NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    custom_field_id BIGINT    NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
    value           TEXT,
    UNIQUE (task_id, custom_field_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_fields_project ON custom_fields(project_id);
CREATE INDEX IF NOT EXISTS idx_task_field_values_task ON task_field_values(task_id);
