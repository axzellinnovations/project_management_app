package com.planora.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Collections;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private JWTService jwtService;

    // 64-char Base64-encoded key (32 bytes)
    private static final String TEST_SECRET =
            Base64.getEncoder().encodeToString("this-is-a-super-secret-key-32byt".getBytes());

    @BeforeEach
    void setUp() {
        jwtService = new JWTService();
        ReflectionTestUtils.setField(jwtService, "secretKey", TEST_SECRET);
    }

    @Test
    void generateToken_producesNonNullToken() {
        String token = jwtService.generateToken("alice@example.com");
        assertNotNull(token);
        assertFalse(token.isBlank());
    }

    @Test
    void extractEmail_returnsCorrectSubject() {
        String token = jwtService.generateToken("alice@example.com");
        assertEquals("alice@example.com", jwtService.extractEmail(token));
    }

    @Test
    void validateToken_returnsTrueForValidAccessToken() {
        String token = jwtService.generateToken("alice@example.com");
        UserDetails userDetails = User.withUsername("alice@example.com")
                .password("pass").authorities(Collections.emptyList()).build();

        assertTrue(jwtService.validateToken(token, userDetails));
    }

    @Test
    void validateToken_returnsFalseForWrongUser() {
        String token = jwtService.generateToken("alice@example.com");
        UserDetails otherUser = User.withUsername("bob@example.com")
                .password("pass").authorities(Collections.emptyList()).build();

        assertFalse(jwtService.validateToken(token, otherUser));
    }

    @Test
    void validateToken_returnsFalseForRefreshToken() {
        String refreshToken = jwtService.generateRefreshToken("alice@example.com");
        UserDetails userDetails = User.withUsername("alice@example.com")
                .password("pass").authorities(Collections.emptyList()).build();

        // Refresh tokens must not validate as access tokens
        assertFalse(jwtService.validateToken(refreshToken, userDetails));
    }

    @Test
    void generateRefreshToken_extractsJtiSuccessfully() {
        String refreshToken = jwtService.generateRefreshToken("alice@example.com");
        String jti = jwtService.extractJti(refreshToken);
        assertNotNull(jti);
        assertFalse(jti.isBlank());
    }

    @Test
    void validateRefreshToken_returnsEmailForValidRefreshToken() {
        String refreshToken = jwtService.generateRefreshToken("alice@example.com");
        String email = jwtService.validateRefreshToken(refreshToken);
        assertEquals("alice@example.com", email);
    }

    @Test
    void validateRefreshToken_throwsForAccessToken() {
        String accessToken = jwtService.generateToken("alice@example.com");
        assertThrows(io.jsonwebtoken.JwtException.class,
                () -> jwtService.validateRefreshToken(accessToken));
    }

    @Test
    void generateToken_withUsername_embedsUsernameInClaims() {
        String token = jwtService.generateToken("alice@example.com", "alice");
        // Subject should still be email
        assertEquals("alice@example.com", jwtService.extractEmail(token));
    }
}
