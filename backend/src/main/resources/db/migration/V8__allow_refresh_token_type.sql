-- V8: Allow REFRESH_TOKEN in verification_tokens token_type check constraint

ALTER TABLE verification_tokens DROP CONSTRAINT IF EXISTS verification_tokens_token_type_check;

ALTER TABLE verification_tokens ADD CONSTRAINT verification_tokens_token_type_check
    CHECK (token_type IN ('VERIFICATION', 'PASSWORD_RESET', 'REFRESH_TOKEN'));
