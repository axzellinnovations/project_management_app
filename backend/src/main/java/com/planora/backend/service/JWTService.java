package com.planora.backend.service;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

/*
 * Core security service responsible for issuing, parsing, and validating JSON Web Tokens (JWTs).
 * This enables stateless authentication, meaning the server doesn't need to store active
 * user sessions in memory.
 */
@Service
public class JWTService {

    // Hardcoding TTLs (Time-To-Live) ensures predictable session lifespans.
    // Access tokens are short-lived (1 day) to minimize risk if stolen.
    private static final long ACCESS_TOKEN_TTL_MS  = 1000L * 60 * 60 * 24;       // 1 day

    // Refresh tokens are long-lived (7 days) and used strictly to get new Access tokens.
    private static final long REFRESH_TOKEN_TTL_MS = 1000L * 60 * 60 * 24 * 7;   // 7 days

    // Custom claim keys to securely differentiate token purposes.
    private static final String CLAIM_TOKEN_TYPE = "tokenType";
    private static final String CLAIM_JTI = "jti"; //JWT ID
    private static final String TYPE_ACCESS  = "ACCESS";
    private static final String TYPE_REFRESH = "REFRESH";

    @Value("${jwt.secret}")
    private String secretKey;

    // ── Access token ──────────────────────────────────────────────────────────

    // Overloaded helper method for generating a basic access token without a username.
    public String generateToken(String email) {
        return generateToken(email, null);
    }

    // Generates a short-lived Access Token used for authenticating standard API requests.
    public String generateToken(String email, String username) {
        // Step 1. Initialize an empty map for our custom payloads (claims).
        Map<String, Object> claims = new HashMap<>();

        // Step 2. Explicitly stamp this as an ACCESS token.
        // This prevents a malicious user from trying to use a stolen Refresh token
        // as an Access token to bypass the short expiration time.
        claims.put(CLAIM_TOKEN_TYPE, TYPE_ACCESS);

        // Step 3. Optionally, attach the username if provided, reducing database hits
        // on the frontend if they just need to display the user's name.
        if (username != null) {
            claims.put("username", username);
        }

        // Step 4. Delegate to the core builder method.
        return buildToken(email, claims, ACCESS_TOKEN_TTL_MS);
    }

    // ── Refresh token ─────────────────────────────────────────────────────────

    /*
     * Generates a long-lived Refresh Token.
     * Includes a unique JTI (JWT ID) to enable token rotation and replay-attack prevention.
     */
    public String generateRefreshToken(String email) {
        // Step 1. Initialize claims.
        Map<String, Object> claims = new HashMap<>();

        // Step 2. Explicitly stamp this as a REFRESH token.
        claims.put(CLAIM_TOKEN_TYPE, TYPE_REFRESH);

        // Step 3. Generate a cryptographically random UUID and assign it as the JTI.
        // This allows the database to track this specific token issuance and revoke it later if needed.
        claims.put(CLAIM_JTI, UUID.randomUUID().toString());

        // Step 4. Delegate to the core builder method.
        return buildToken(email, claims, REFRESH_TOKEN_TTL_MS);
    }

    /** Extracts the JTI (JWT Token ID) claim from a token. */
    public String extractJti(String token) {
        return extractAllClaims(token).get(CLAIM_JTI, String.class);
    }

    // ── Validation ─────────────────────────────────────────────────────────────

    /*
     * Validates that the token is a legitimate, unexpired ACCESS token belonging to the given user.
     * Used heavily by the Spring Security JWT Filter on every incoming HTTP request.
     */
    public boolean validateToken(String token, UserDetails userDetails) {
        // Step 1. Cryptographically parse the token and extract the subject (email).
        final String email = extractEmail(token);

        // Step 2. Extract the token type.
        String type = extractAllClaims(token).get(CLAIM_TOKEN_TYPE, String.class);

        // Step 3. Enforce three security rules:
        // A) Does the token email match the Spring Security context?
        // B) Is the token still within its valid timeframe?
        // C) Is it strictly an ACCESS token?
        return email.equals(userDetails.getUsername())
                && !isTokenExpired(token)
                && TYPE_ACCESS.equals(type);
    }

    /** Validates that the token is a REFRESH token and returns the subject (email). */
    public String validateRefreshToken(String token) {
        // Step 1. Cryptographically parse the token to get all payload data.
        Claims claims = extractAllClaims(token);

        // Step 2. Fail fast with a specific exception if the token is expired.
        // This tells the controller to force the user to log in again.
        if (isTokenExpired(token)) {
            throw new io.jsonwebtoken.ExpiredJwtException(null, claims, "Refresh token expired");
        }

        // Step 3. Verify the token type. If someone tries to pass an Access token
        // into the refresh endpoint, reject it.
        String type = claims.get(CLAIM_TOKEN_TYPE, String.class);
        if (!TYPE_REFRESH.equals(type)) {
            throw new io.jsonwebtoken.JwtException("Token is not a refresh token");
        }

        // Step 4. If all checks pass, return the user's email so the service can issue new tokens.
        return claims.getSubject();
    }

    // ── Claims extraction ──────────────────────────────────────────────────────

    // Extracts the primary subject (usually the user's email) from the token.
    public String extractEmail(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public String extractUserName(String token) {
        return extractAllClaims(token).getSubject();
    }

    // Generic helper method to execute a specific function against the parsed claims.
    private <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    /*
     * The core cryptographic parsing method.
     * If the token was tampered with (signature doesn't match), this method will throw a SignatureException.
     */
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

    // Constructs and signs the final JWT string.
    private String buildToken(String email, Map<String, Object> claims, long ttlMs) {
        // Step 1. Initiate the modern JJWT builder.
        return Jwts.builder()
                .claims()
                .subject(email) // Set the primary identifier.
                .add(claims)    // Inject our custom maps (tokenType, jti, username).
                .issuedAt(new Date(System.currentTimeMillis()))  // Mark creation time.
                .expiration(new Date(System.currentTimeMillis() + ttlMs))  // Set exact death time.
                .and()
                // Step 2. Cryptographically sign the header + payload using our secret key.
                .signWith(getSigningKey())
                // Step 3. Serialize into a URL-safe Base64 string (Header.Payload.Signature).
                .compact();
    }

    // Retrieves and validates the cryptographic signing key.
    private SecretKey getSigningKey() {
        // Step 1. Decode the Base64 secret from application.properties.
        byte[] secretAr = Decoders.BASE64.decode(secretKey);

        // Step 2. Hard Security Rule: HS256 requires at least a 256-bit (32-byte) key.
        // Failing fast here prevents the application from booting with a weak, easily crackable key.
        if (secretAr.length < 32) {
            throw new IllegalStateException(
                    "Security Risk: JWT secret key is too short. "
                            + "It must be at least 32 bytes for HS256. Current length: "
                            + secretAr.length);
        }

        // Step 3. Convert the byte array into a Java SecretKey object usable by JJWT.
        return Keys.hmacShaKeyFor(secretAr);
    }
}
