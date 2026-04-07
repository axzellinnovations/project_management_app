package com.planora.backend.service;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

@Service
public class JWTService {

    private static final long ACCESS_TOKEN_TTL_MS  = 1000L * 60 * 60 * 24;       // 1 day
    private static final long REFRESH_TOKEN_TTL_MS = 1000L * 60 * 60 * 24 * 7;   // 7 days

    private static final String CLAIM_TOKEN_TYPE = "tokenType";
    private static final String TYPE_ACCESS  = "ACCESS";
    private static final String TYPE_REFRESH = "REFRESH";

    @Value("${jwt.secret}")
    private String secretKey;

    // ── Access token ──────────────────────────────────────────────────────────

    public String generateToken(String email) {
        return generateToken(email, null);
    }

    public String generateToken(String email, String username) {
        Map<String, Object> claims = new HashMap<>();
        claims.put(CLAIM_TOKEN_TYPE, TYPE_ACCESS);
        if (username != null) {
            claims.put("username", username);
        }
        return buildToken(email, claims, ACCESS_TOKEN_TTL_MS);
    }

    // ── Refresh token ─────────────────────────────────────────────────────────

    public String generateRefreshToken(String email) {
        Map<String, Object> claims = new HashMap<>();
        claims.put(CLAIM_TOKEN_TYPE, TYPE_REFRESH);
        return buildToken(email, claims, REFRESH_TOKEN_TTL_MS);
    }

    // ── Validation ─────────────────────────────────────────────────────────────

    /** Validates that the token is an ACCESS token for the given user. */
    public boolean validateToken(String token, UserDetails userDetails) {
        final String email = extractEmail(token);
        String type = extractAllClaims(token).get(CLAIM_TOKEN_TYPE, String.class);
        return email.equals(userDetails.getUsername())
                && !isTokenExpired(token)
                && TYPE_ACCESS.equals(type);
    }

    /** Validates that the token is a REFRESH token and returns the subject (email). */
    public String validateRefreshToken(String token) {
        Claims claims = extractAllClaims(token);
        if (isTokenExpired(token)) {
            throw new io.jsonwebtoken.ExpiredJwtException(null, claims, "Refresh token expired");
        }
        String type = claims.get(CLAIM_TOKEN_TYPE, String.class);
        if (!TYPE_REFRESH.equals(type)) {
            throw new io.jsonwebtoken.JwtException("Token is not a refresh token");
        }
        return claims.getSubject();
    }

    // ── Claims extraction ──────────────────────────────────────────────────────

    public String extractEmail(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public String extractUserName(String token) {
        return extractAllClaims(token).getSubject();
    }

    private <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    // ── Internal helpers ───────────────────────────────────────────────────────

    private String buildToken(String email, Map<String, Object> claims, long ttlMs) {
        return Jwts.builder()
                .claims()
                .subject(email)
                .add(claims)
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + ttlMs))
                .and()
                .signWith(getSigningKey())
                .compact();
    }

    private SecretKey getSigningKey() {
        byte[] secretAr = Decoders.BASE64.decode(secretKey);
        if (secretAr.length < 32) {
            throw new IllegalStateException(
                    "Security Risk: JWT secret key is too short. "
                            + "It must be at least 32 bytes for HS256. Current length: "
                            + secretAr.length);
        }
        return Keys.hmacShaKeyFor(secretAr);
    }
}
