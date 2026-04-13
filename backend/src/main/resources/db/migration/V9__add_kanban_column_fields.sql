-- V9: Add color, wip_limit, and status fields to kanban_column table

ALTER TABLE kanban_column ADD COLUMN IF NOT EXISTS color VARCHAR(20);
ALTER TABLE kanban_column ADD COLUMN IF NOT EXISTS wip_limit INTEGER;
ALTER TABLE kanban_column ADD COLUMN IF NOT EXISTS status VARCHAR(50);
