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
 * Automated database maintenance service (Garbage Collection).
 * Runs nightly at 02:00 UTC to delete expired and already-used VerificationToken rows.
 * WHY: Without this, the verification_tokens table grows indefinitely with dead data,
 * which slows down database queries and consumes unnecessary cloud storage costs.
 */
@Component
// @EnableScheduling tells Spring's background task executor to look for methods
// annotated with @Scheduled and run them automatically.
@EnableScheduling
public class TokenCleanupScheduler {

    private static final Logger logger = LoggerFactory.getLogger(TokenCleanupScheduler.class);

    private final TokenRepository tokenRepository;

    public TokenCleanupScheduler(TokenRepository tokenRepository) {
        this.tokenRepository = tokenRepository;
    }

    /**
     * Executes the cleanup query.
     * CRON Expression Breakdown ("0 0 2 * * *"):
     * Seconds(0) Minutes(0) Hours(2) DayOfMonth(*) Month(*) DayOfWeek(*)
     * Meaning: Run exactly at 2:00:00 AM every single day.
     */
    @Scheduled(cron = "0 0 2 * * *")
    // @Transactional is CRUCIAL here. Bulk delete operations (like deleting thousands
    // of old tokens) can cause database locks or partial failures. This ensures the
    // deletion either completely succeeds or completely rolls back if the DB crashes mid-way.
    @Transactional
    public void cleanUpExpiredAndUsedTokens() {
        // Step 1. Log the start of the job so DevOps/Admins can trace background activity.
        logger.info("Running scheduled token cleanup…");
        try {
            // Step 2. Execute the bulk delete query.
            // We delete tokens if they are logically burned (used == true)
            // OR if their expiration timestamp has passed (expiry < Instant.now()).
            tokenRepository.deleteByExpiryBeforeOrUsedTrue(Instant.now());

            // Step 3. Log successful completion.
            logger.info("Token cleanup completed.");
        } catch (Exception e) {
            // Step 4. Catch and log any database timeouts or connection failures.
            // Catching this prevents the entire Spring Scheduler thread from crashing
            // and failing to run other scheduled tasks.
            logger.error("Token cleanup failed: {}", e.getMessage(), e);
        }
    }
}
