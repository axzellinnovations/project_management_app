package com.planora.backend.service;

import com.planora.backend.repository.TokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Runs nightly at 02:00 UTC to delete expired and already-used VerificationToken rows.
 * Without this, the verification_tokens table grows indefinitely.
 */
@Component
@EnableScheduling
public class TokenCleanupScheduler {

    private static final Logger logger = LoggerFactory.getLogger(TokenCleanupScheduler.class);

    private final TokenRepository tokenRepository;

    public TokenCleanupScheduler(TokenRepository tokenRepository) {
        this.tokenRepository = tokenRepository;
    }

    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void cleanUpExpiredAndUsedTokens() {
        logger.info("Running scheduled token cleanup…");
        try {
            tokenRepository.deleteByExpiryBeforeOrUsedTrue(Instant.now());
            logger.info("Token cleanup completed.");
        } catch (Exception e) {
            logger.error("Token cleanup failed: {}", e.getMessage(), e);
        }
    }
}
