package com.planora.backend.service;

import com.planora.backend.repository.TokenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TokenCleanupServiceTest {

    @Mock
    private TokenRepository tokenRepository;

    @InjectMocks
    private TokenCleanupScheduler tokenCleanupScheduler;

    @Test
    void cleanUpExpiredAndUsedTokens_callsRepositoryDeleteMethod() {
        doNothing().when(tokenRepository).deleteByExpiryBeforeOrUsedTrue(any(Instant.class));

        tokenCleanupScheduler.cleanUpExpiredAndUsedTokens();

        verify(tokenRepository).deleteByExpiryBeforeOrUsedTrue(any(Instant.class));
    }

    @Test
    void cleanUpExpiredAndUsedTokens_doesNotThrow_whenRepositoryThrows() {
        doThrow(new RuntimeException("DB error"))
                .when(tokenRepository).deleteByExpiryBeforeOrUsedTrue(any(Instant.class));

        // Scheduler should swallow exceptions per implementation
        assertDoesNotThrow(() -> tokenCleanupScheduler.cleanUpExpiredAndUsedTokens());
    }
}
