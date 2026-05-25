CREATE TABLE IF NOT EXISTS portfolios (
    id          BIGSERIAL     PRIMARY KEY,
    name        VARCHAR(100)  NOT NULL,
    description VARCHAR(500),
    color       VARCHAR(7)    NOT NULL DEFAULT '#155DFC',
    emoji       VARCHAR(10),
    owner_id    BIGINT        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_projects (
    portfolio_id BIGINT      NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    project_id   BIGINT      NOT NULL REFERENCES projects(id)   ON DELETE CASCADE,
    added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (portfolio_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_portfolios_owner ON portfolios(owner_id);
CREATE INDEX IF NOT EXISTS idx_pp_portfolio ON portfolio_projects(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pp_project   ON portfolio_projects(project_id);
