-- V7: Recurring task support — extend the tasks table


IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'recurrence_rule' AND Object_ID = Object_ID(N'tasks'))
	ALTER TABLE tasks ADD recurrence_rule VARCHAR(30) NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'recurrence_end' AND Object_ID = Object_ID(N'tasks'))
	ALTER TABLE tasks ADD recurrence_end DATE NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'recurrence_parent_id' AND Object_ID = Object_ID(N'tasks'))
	ALTER TABLE tasks ADD recurrence_parent_id BIGINT NULL;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'next_occurrence' AND Object_ID = Object_ID(N'tasks'))
	ALTER TABLE tasks ADD next_occurrence DATE NULL;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = N'idx_tasks_next_occurrence' AND object_id = OBJECT_ID(N'tasks'))
	CREATE INDEX idx_tasks_next_occurrence ON tasks(next_occurrence);
