-- Stores GitHub pull-request snapshots linked to Planora tasks.
-- Rows are refreshed by TaskGithubService on each GitHub sync; the table is
-- treated as a write-through cache (DELETE + INSERT per task on every sync).
CREATE TABLE IF NOT EXISTS github_pull_requests (
    id          BIGSERIAL       NOT NULL,
    task_id     BIGINT          NOT NULL,
    pr_number   INT             NOT NULL,
    title       VARCHAR(500),
    state       VARCHAR(20),
    html_url    VARCHAR(1000),
    author      VARCHAR(255),
    created_at  VARCHAR(30),
    merged_at   VARCHAR(30),
    head_branch VARCHAR(255),
    base_branch VARCHAR(255),
    synced_at   TIMESTAMP       NOT NULL,

    PRIMARY KEY (id),
    CONSTRAINT fk_gpr_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gpr_task_id ON github_pull_requests (task_id);
