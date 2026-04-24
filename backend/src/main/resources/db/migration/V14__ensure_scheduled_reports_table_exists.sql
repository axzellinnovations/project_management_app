-- ══════════════════════════════════════════════════════════════════════════════
--  V14__ensure_scheduled_reports_table_exists.sql
--  Safety migration: repair environments where V13 is marked applied but table
--  `scheduled_reports` does not exist (schema drift).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scheduled_reports (
    id                    BIGSERIAL       PRIMARY KEY,
    project_id            BIGINT          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by_user_id    BIGINT          NOT NULL REFERENCES users(user_id),

    format                VARCHAR(10)     NOT NULL,
    schedule_type         VARCHAR(20)     NOT NULL,

    frequency             VARCHAR(20),
    custom_interval_days  INT,

    send_time             VARCHAR(10)     NOT NULL,
    send_day_of_week      INT,
    send_day_of_month     INT,
    scheduled_date        DATE,

    recipients_to         TEXT            NOT NULL,
    recipients_cc         TEXT,
    recipients_bcc        TEXT,

    subject               VARCHAR(500),
    body_message          TEXT,

    end_type              VARCHAR(20),
    end_after_count       INT,
    end_date              DATE,

    send_count            INT             NOT NULL DEFAULT 0,
    status                VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    next_send_at          TIMESTAMPTZ,
    last_sent_at          TIMESTAMPTZ,

    created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sr_next_send_active
    ON scheduled_reports (next_send_at)
    WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_sr_project
    ON scheduled_reports (project_id);
