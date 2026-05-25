-- Stores GitHub commit snapshots linked to Planora tasks.
-- ci_status holds the resolved check-run conclusion for that commit's SHA
-- ("success" | "failure" | "pending" | NULL when not yet checked).
CREATE TABLE IF NOT EXISTS github_commits (
    id           BIGINT        NOT NULL AUTO_INCREMENT,
    task_id      BIGINT        NOT NULL,
    sha          VARCHAR(40)   NOT NULL,
    message      VARCHAR(1000),
    author       VARCHAR(255),
    committed_at VARCHAR(30),
    html_url     VARCHAR(1000),
    ci_status    VARCHAR(20),
    synced_at    DATETIME      NOT NULL,

    PRIMARY KEY (id),
    CONSTRAINT fk_gc_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    INDEX idx_gc_task_id (task_id),
    INDEX idx_gc_synced_at (synced_at)
);
