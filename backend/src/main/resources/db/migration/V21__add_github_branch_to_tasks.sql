-- V8 GitHub integration: store the linked branch name directly on the task row.
-- All other GitHub data (PRs, commits, CI status) is fetched live from the GitHub API.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS github_branch VARCHAR(255) NULL;
