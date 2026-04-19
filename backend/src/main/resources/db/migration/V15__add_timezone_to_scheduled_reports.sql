-- Adds a generic timezone column to store the user's localized time zone
ALTER TABLE scheduled_reports ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
