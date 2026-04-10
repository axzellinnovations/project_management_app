-- V2: Add milestones table and milestone_id FK on tasks

CREATE TABLE IF NOT EXISTS milestones (
    id          BIGSERIAL PRIMARY KEY,
    project_id  BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    due_date    DATE,
    status      VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS milestone_id BIGINT REFERENCES milestones(id) ON DELETE SET NULL;
