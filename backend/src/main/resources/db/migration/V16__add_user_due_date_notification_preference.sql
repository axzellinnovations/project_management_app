-- V13: Add due-date reminder preference flag for users

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS notify_due_date_reminders BOOLEAN NOT NULL DEFAULT TRUE;