-- Stores GitHub commit snapshots linked to Planora tasks.
-- ci_status holds the resolved check-run conclusion for that commit's SHA
-- ("success" | "failure" | "pending" | NULL when not yet checked).
CREATE TABLE IF NOT EXISTS github_commits (
    id           BIGSERIAL     NOT NULL,
    task_id      BIGINT        NOT NULL,
    sha          VARCHAR(40)   NOT NULL,
    message      VARCHAR(1000),
    author       VARCHAR(255),
    committed_at VARCHAR(30),
    html_url     VARCHAR(1000),
    ci_status    VARCHAR(20),
    synced_at    TIMESTAMP     NOT NULL,

    PRIMARY KEY (id),
    CONSTRAINT fk_gc_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gc_task_id ON github_commits (task_id);
CREATE INDEX IF NOT EXISTS idx_gc_synced_at ON github_commits (synced_at);
