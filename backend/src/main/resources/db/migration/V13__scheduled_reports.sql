-- ══════════════════════════════════════════════════════════════════════════════
--  V13__scheduled_reports.sql
--  Persisted configuration for one-time and recurring scheduled report emails.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE scheduled_reports (
    id                    BIGSERIAL       PRIMARY KEY,
    project_id            BIGINT          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by_user_id    BIGINT          NOT NULL REFERENCES users(user_id),

    -- Report format: PDF | EXCEL | BOTH
    format                VARCHAR(10)     NOT NULL,

    -- ONE_TIME | RECURRING
    schedule_type         VARCHAR(20)     NOT NULL,

    -- Recurrence: DAILY | WEEKLY | MONTHLY | CUSTOM  (null for ONE_TIME)
    frequency             VARCHAR(20),
    custom_interval_days  INT,            -- used when frequency = CUSTOM

    -- Time of day for sending (stored as time string HH:mm)
    send_time             VARCHAR(10)     NOT NULL,

    -- Day selection for WEEKLY (0=Sun..6=Sat) or MONTHLY (1-31)
    send_day_of_week      INT,
    send_day_of_month     INT,

    -- Specific date for ONE_TIME schedules
    scheduled_date        DATE,

    -- Recipients stored as comma-separated email strings
    recipients_to         TEXT            NOT NULL,
    recipients_cc         TEXT,
    recipients_bcc        TEXT,

    -- Email content
    subject               VARCHAR(500),
    body_message          TEXT,

    -- End condition for RECURRING: AFTER_N | UNTIL_DATE | MANUAL
    end_type              VARCHAR(20),
    end_after_count       INT,
    end_date              DATE,

    -- Runtime tracking
    send_count            INT             NOT NULL DEFAULT 0,
    status                VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE | PAUSED | COMPLETED | CANCELLED
    next_send_at          TIMESTAMPTZ,
    last_sent_at          TIMESTAMPTZ,

    created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Fast lookup: find all due active reports (checked every minute by scheduler)
CREATE INDEX idx_sr_next_send_active
    ON scheduled_reports (next_send_at)
    WHERE status = 'ACTIVE';

-- Project-level listing
CREATE INDEX idx_sr_project
    ON scheduled_reports (project_id);
