-- Adds enrichment columns to github_pull_requests needed for the full PR response:
--   head_sha     — SHA of the PR's head commit (used to cross-reference CI status)
--   updated_at   — GitHub's updated_at for sorting by most-recently-updated
--   ci_status    — normalized CiStatus name for the PR's head commit ("PASSING"|"FAILED"|"RUNNING")
--   review_status — derived review state ("APPROVED"|"CHANGES_REQUESTED"|"REVIEW_REQUIRED"|"COMMENTED")
ALTER TABLE github_pull_requests ADD COLUMN IF NOT EXISTS head_sha      VARCHAR(40);
ALTER TABLE github_pull_requests ADD COLUMN IF NOT EXISTS updated_at    VARCHAR(30);
ALTER TABLE github_pull_requests ADD COLUMN IF NOT EXISTS ci_status     VARCHAR(20);
ALTER TABLE github_pull_requests ADD COLUMN IF NOT EXISTS review_status VARCHAR(30);

-- Index to support ORDER BY COALESCE(updated_at, created_at) DESC efficiently.
CREATE INDEX IF NOT EXISTS idx_gpr_updated_at ON github_pull_requests (updated_at DESC);
