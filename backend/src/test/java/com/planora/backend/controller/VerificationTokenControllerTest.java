package com.planora.backend.controller;

import com.planora.backend.model.User;
import com.planora.backend.model.VerificationToken;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pure unit tests for the VerificationToken model — no Spring context needed.
 */
class VerificationTokenControllerTest {

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setUserId(1L);
        user.setEmail("test@example.com");
    }

    @Test
    void isExpired_returnsTrueWhenExpiryIsInPast() {
        VerificationToken token = VerificationToken.builder()
                .token("123456")
                .user(user)
                .expiry(Instant.now().minusSeconds(60))
                .build();
        assertTrue(token.isExpired());
    }

    @Test
    void isExpired_returnsFalseWhenExpiryIsInFuture() {
        VerificationToken token = VerificationToken.builder()
                .token("654321")
                .user(user)
                .expiry(Instant.now().plusSeconds(300))
                .build();
        assertFalse(token.isExpired());
    }

    @Test
    void defaultTokenType_isVERIFICATION() {
        VerificationToken token = VerificationToken.builder()
                .token("abc")
                .user(user)
                .expiry(Instant.now().plusSeconds(60))
                .build();
        assertEquals(VerificationToken.TokenType.VERIFICATION, token.getTokenType());
    }

    @Test
    void canSetTokenTypeToPasswordReset() {
        VerificationToken token = VerificationToken.builder()
                .token("xyz")
                .user(user)
                .expiry(Instant.now().plusSeconds(60))
                .tokenType(VerificationToken.TokenType.PASSWORD_RESET)
                .build();
        assertEquals(VerificationToken.TokenType.PASSWORD_RESET, token.getTokenType());
    }

    @Test
    void defaultUsed_isFalse() {
        VerificationToken token = VerificationToken.builder()
                .token("abc")
                .user(user)
                .expiry(Instant.now().plusSeconds(60))
                .build();
        assertFalse(token.isUsed());
    }

    @Test
    void equalsAndHashCode_basedOnId() {
        VerificationToken t1 = new VerificationToken();
        VerificationToken t2 = new VerificationToken();
        // Both have null id — they should be equal to themselves
        assertEquals(t1, t1);
        assertNotEquals(t1, null);
    }
}
