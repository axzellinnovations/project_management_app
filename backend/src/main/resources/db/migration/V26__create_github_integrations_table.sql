-- Stores per-project GitHub repository connections and access tokens.
-- Each active row means the project is linked to a specific GitHub repo.
CREATE TABLE IF NOT EXISTS github_integrations (
    id                   BIGSERIAL     NOT NULL,
    project_id           BIGINT        NOT NULL,
    repo_full_name       VARCHAR(255)  NOT NULL,
    owner                VARCHAR(128),
    repo_name            VARCHAR(128),
    github_token         VARCHAR(512),
    connected_by_user_id BIGINT,
    connected_at         TIMESTAMP     NOT NULL,
    active               BOOLEAN       NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id),
    CONSTRAINT uq_gi_project_repo UNIQUE (project_id, repo_full_name)
);

CREATE INDEX IF NOT EXISTS idx_gi_project_id ON github_integrations (project_id);
CREATE INDEX IF NOT EXISTS idx_gi_active      ON github_integrations (active) WHERE active = TRUE;
