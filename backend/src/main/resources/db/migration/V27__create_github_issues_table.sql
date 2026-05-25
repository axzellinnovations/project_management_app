-- Stores GitHub issue snapshots linked to a Planora project.
-- Issues are repository-level (not task-level) and are cached here
-- to avoid hitting the GitHub API on every page load.
CREATE TABLE IF NOT EXISTS github_issues (
    id           BIGSERIAL     NOT NULL,
    project_id   BIGINT        NOT NULL,
    issue_number INT           NOT NULL,
    title        VARCHAR(500),
    state        VARCHAR(20),
    html_url     VARCHAR(1000),
    author       VARCHAR(255),
    body         VARCHAR(5000),
    created_at   VARCHAR(30),
    closed_at    VARCHAR(30),
    synced_at    TIMESTAMP     NOT NULL,

    PRIMARY KEY (id),
    CONSTRAINT uq_github_issues_project_issue UNIQUE (project_id, issue_number)
);

CREATE INDEX IF NOT EXISTS idx_github_issues_project_id ON github_issues (project_id);
CREATE INDEX IF NOT EXISTS idx_github_issues_state      ON github_issues (state);
