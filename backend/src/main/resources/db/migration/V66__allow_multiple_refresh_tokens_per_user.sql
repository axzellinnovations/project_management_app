-- V66: Allow multiple active refresh tokens per user (multi-device & multi-session support)

-- 1. Drop the legacy unique constraint that prevented multiple active sessions per user
ALTER TABLE verification_tokens
    DROP CONSTRAINT IF EXISTS uk_user_token_type;

-- 2. Ensure single-token uniqueness for OTP verification and password reset tokens only
CREATE UNIQUE INDEX IF NOT EXISTS uk_user_verification_token
    ON verification_tokens (user_id, token_type)
    WHERE token_type IN ('VERIFICATION', 'PASSWORD_RESET');

-- 3. Add composite indexes for high-performance multi-session token lookups and rotation
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token_type
    ON verification_tokens (token, token_type);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_token_type
    ON verification_tokens (user_id, token_type);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_previous_token
    ON verification_tokens (previous_token, token_type)
    WHERE previous_token IS NOT NULL;
