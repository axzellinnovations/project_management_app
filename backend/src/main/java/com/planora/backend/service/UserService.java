package com.planora.backend.service;

import java.io.IOException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.apache.tika.Tika;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import com.planora.backend.dto.LoginResponse;
import com.planora.backend.dto.UpdateProfileRequest;
import com.planora.backend.dto.UserResponseDTO;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.exception.ProfilePhotoStorageException;
import com.planora.backend.model.User;
import com.planora.backend.model.VerificationToken;
import com.planora.backend.repository.TokenRepository;
import com.planora.backend.repository.UserRepository;

import jakarta.transaction.Transactional;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;


// Core business logic for User identity, authentication, and profile management.
@Service
public class UserService {

    private static final Logger logger = LoggerFactory.getLogger(UserService.class);
    public static final long MAX_PROFILE_PHOTO_SIZE_BYTES = 25L * 1024 * 1024;
    private static final Duration REFRESH_TOKEN_RETRY_GRACE = Duration.ofSeconds(30);
    private static final int MAX_ACTIVE_REFRESH_SESSIONS_PER_USER = 10;
    private static final SecureRandom OTP_RANDOM = new SecureRandom();
    private static final String HASHED_OTP_PREFIX = "v2:";
    private final UserRepository userRepository;
    private final JWTService jwtService;

    // Using Bcrypt with a strength of 12 rounds for password hashing.
    // Computationally expensive enough to slow down brute-force attacks, but fast enough for normal login flows.
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
    private final TokenRepository tokenRepository;
    private final EmailService emailService;

    private final AuthenticationManager authenticationManager;

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final StringRedisTemplate stringRedisTemplate;

    @Value("${aws.s3.profile-bucket}")
    private String profileBucket;

    @Value("${aws.region}")
    private String region;

    /** Defaults to the JWT secret in deployed profiles; a separate rotated secret may be supplied. */
    @Value("${app.security.otp-pepper:${jwt.secret}}")
    private String otpPepper;

    @Autowired
    @Lazy
    private UserService self;

    private UserService getSelf() {
        return self != null ? self : this;
    }

    // Note: OTP-issuance rate limiting (forgot / resend / resend-otp) is enforced upstream by
    // RateLimitingFilter, which uses a Redis-backed IP+email keyed counter shared across all
    // application instances. No per-service cache is needed here.

    private record LoginAttemptRecord(int failedAttempts, Instant lockedUntil) {
        boolean isLocked(Instant now) {
            return lockedUntil != null && now.isBefore(lockedUntil);
        }

        LoginAttemptRecord recordFailedAttempt(Instant now) {
            int nextFailedAttempts = failedAttempts + 1;
            Instant nextLockedUntil = nextFailedAttempts >= 5 ? now.plus(Duration.ofMinutes(15)) : lockedUntil;
            return new LoginAttemptRecord(nextFailedAttempts, nextLockedUntil);
        }
    }

    public UserService(UserRepository userRepository, JWTService jwtService, AuthenticationManager authenticationManager, TokenRepository tokenRepository, EmailService emailService, S3Client s3Client, S3Presigner s3Presigner, StringRedisTemplate stringRedisTemplate) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.tokenRepository = tokenRepository;
        this.emailService = emailService;
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.stringRedisTemplate = stringRedisTemplate;
    }

    /*
    * Handles new user registration.
    * if a user tries to register with an email already in the system but unverified,
    * we recycle the account and issue a new OTP rather than blocking them */
    @Transactional
    public String register(User user) {

        // Step 1. Check if the email already exists in the database.
        User existingUser = userRepository.findFirstByEmailIgnoreCase(user.getEmail().toLowerCase()).orElse(null);

        if (existingUser != null) {
            // Step 2a. If the user exists but isn't verified yet, we reuse the entity.
            if (!existingUser.isVerified()) {
                // Wipe old OTPs so the user doesn't get confused by multiple active tokens.
                tokenRepository.deleteByUser(existingUser); // Clear old OTPs
                tokenRepository.flush(); // Force DB update immediately
                user = existingUser; // Point our local variable to the existing DB record
            } else {
                // Step 2b. User exists and is verified. Halt execution and tell user to login.
                return "User already verified. Please login.";
            }
        } else {
            // Step 2c. Entirely new user. Format data and save.
            user.setEmail(user.getEmail().toLowerCase());
            user.setPassword(encoder.encode(user.getPassword())); // Hash raw password
            user.setVerified(false); // Default to unverified
            userRepository.save(user);
            userRepository.flush();
        }

        // Step 3. Generate a random 6-digit number (100000 to 999999)
        String otp = generateOtp();

        // Step 4. Build the token entity linking the OTP to the user.
        VerificationToken verificationToken = new VerificationToken();
        verificationToken.setUser(user);
        verificationToken.setToken(hashOtp(otp));
        verificationToken.setTokenType(VerificationToken.TokenType.VERIFICATION);
        verificationToken.setExpiry(Instant.now().plus(Duration.ofMinutes(10)));

        // Step 5. Save token and dispatch email.
        tokenRepository.save(verificationToken);

        try {
            emailService.sendVerificationEmail(user.getEmail(), otp);
        } catch (Exception e) {
            logger.error("Failed to send verification email to {}: {}", user.getEmail(), e.getMessage());
        }
        return "OTP send successfully";
    }


    // Verifies a registration OTP.
    @Transactional
    @CacheEvict(cacheNames = "user-details", key = "#email.toLowerCase()", condition = "#result == true")
    public boolean verifyToken(String email, String otp) {
        // Step 1. Fetch user. If no user, fail immediately.
        User user = userRepository.findFirstByEmailIgnoreCase(email.toLowerCase()).orElse(null);
        if (user == null) {
            return false;
        }

        // Step 2. Fetch the active VERIFICATION token for this user.
        VerificationToken verificationToken = tokenRepository.findByUserAndTokenType(user, VerificationToken.TokenType.VERIFICATION);

        // Step 3. Validate token state (Must exist, not be used, and the current time must be before expiry).
        if (verificationToken == null || verificationToken.isUsed() || verificationToken.getExpiry().isBefore(Instant.now())) {
            return false;
        }

        // Step 4. Check brute-force counter.
        if (verificationToken.getAttempts() >= 5) {
            return false;
        }

        // Step 5. Compare the provided OTP against the stored token.
        if (tokenMatches(verificationToken.getToken(), otp)) {
            // Step 5a. Success. Update user status and burn the token.
            user.setVerified(true);
            verificationToken.setUsed(true);
            userRepository.save(user);
            tokenRepository.save(verificationToken);
            return true;
        } else {
            // Step 5b. Failure. Increment brute-force counter and save.
            verificationToken.setAttempts(verificationToken.getAttempts() + 1);
            tokenRepository.save(verificationToken);
            return false;
        }
    }

    // Authenticates a user and issue JWT tokens.
    @Transactional
    public LoginResponse loginUser(User user) {
        String email = user.getEmail().toLowerCase();
        LoginAttemptRecord loginAttemptRecord = getLoginAttemptRecord(email);

        if (loginAttemptRecord != null && loginAttemptRecord.isLocked(Instant.now())) {
            LoginResponse response = new LoginResponse();
            response.setSuccess(false);
            response.setMessage("Account temporarily locked due to too many failed attempts. Try again later.");
            response.setErrorCode("ACCOUNT_LOCKED");
            return response;
        }

        try {
            // Step 1: Delegate password checking to Spring Security's AuthenticationManager.
            Authentication authentication =
                    authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
                            email,
                            user.getPassword()));

            // Step 2. If auth succeeds, generate JWT.
            if (authentication.isAuthenticated()) {
                clearLoginAttemptRecord(email);
                User authenticatedUser = userRepository.findFirstByEmailIgnoreCase(email).orElse(null);

                // Create short-lived access token and long-lived refresh token.
                String accessToken  = jwtService.generateToken(email, authenticatedUser.getUsername(), authenticatedUser.getUserId());
                String refreshToken = jwtService.generateRefreshToken(email);

                // Store the JTI of the new refresh token for rotation tracking
                storeRefreshTokenJti(authenticatedUser, refreshToken);

                // Build success response.
                LoginResponse response = new LoginResponse();
                response.setSuccess(true);
                response.setMessage("Login successful");
                response.setToken(accessToken);
                response.setRefreshToken(refreshToken);
                return response;
            }

            // Step 3. Fallback if an authentication object is somehow not authenticated.
            LoginResponse response = new LoginResponse();
            response.setSuccess(false);
            response.setMessage("Incorrect username or password");
            response.setErrorCode("INVALID_CREDENTIALS");
            return response;

        } catch (DisabledException e) {
            // Exception caught: user exists, and password is correct, but isVerified == false.
            LoginResponse response = new LoginResponse();
            response.setSuccess(false);
            response.setMessage("Email is not verified. Please check your email.");
            response.setErrorCode("UNVERIFIED_EMAIL");
            return response;

        } catch (AuthenticationException e) {
            // Exception caught: Password does not match hash.
            LoginAttemptRecord updatedLoginAttemptRecord = recordFailedLoginAttempt(email, Instant.now());
            if (updatedLoginAttemptRecord.failedAttempts() == 5) {
                logger.warn("Account locked for email: {}", email);
            }

            LoginResponse response = new LoginResponse();
            response.setSuccess(false);
            response.setMessage("Incorrect username or password");
            response.setErrorCode("INVALID_CREDENTIALS");
            return response;
        }
    }

    private LoginAttemptRecord getLoginAttemptRecord(String email) {
        if (stringRedisTemplate == null) {
            return null;
        }
        try {
            String encoded = stringRedisTemplate.opsForValue().get(loginAttemptKey(email));
            return parseLoginAttemptRecord(encoded);
        } catch (RuntimeException ex) {
            logger.warn("Redis unavailable while reading login lockout for {}: {}", email, ex.getMessage());
            return null;
        }
    }

    private LoginAttemptRecord recordFailedLoginAttempt(String email, Instant now) {
        LoginAttemptRecord currentRecord = getLoginAttemptRecord(email);
        LoginAttemptRecord updatedRecord = (currentRecord == null
                ? new LoginAttemptRecord(0, null)
                : currentRecord).recordFailedAttempt(now);
        if (stringRedisTemplate == null) {
            return updatedRecord;
        }
        try {
            stringRedisTemplate.opsForValue().set(
                    loginAttemptKey(email),
                    encodeLoginAttemptRecord(updatedRecord),
                    Duration.ofMinutes(20));
        } catch (RuntimeException ex) {
            logger.warn("Redis unavailable while writing login lockout for {}: {}", email, ex.getMessage());
        }
        return updatedRecord;
    }

    private void clearLoginAttemptRecord(String email) {
        if (stringRedisTemplate == null) {
            return;
        }
        try {
            stringRedisTemplate.delete(loginAttemptKey(email));
        } catch (RuntimeException ex) {
            logger.warn("Redis unavailable while clearing login lockout for {}: {}", email, ex.getMessage());
        }
    }

    private String loginAttemptKey(String email) {
        return "login-attempt:" + email;
    }

    private String encodeLoginAttemptRecord(LoginAttemptRecord record) {
        long lockedUntilEpochMillis = record.lockedUntil() == null ? 0L : record.lockedUntil().toEpochMilli();
        return record.failedAttempts() + ":" + lockedUntilEpochMillis;
    }

    private LoginAttemptRecord parseLoginAttemptRecord(String encoded) {
        if (encoded == null || encoded.isBlank()) {
            return null;
        }
        String[] parts = encoded.split(":", 2);
        if (parts.length != 2) {
            return null;
        }
        try {
            int failedAttempts = Integer.parseInt(parts[0]);
            long lockedUntilEpochMillis = Long.parseLong(parts[1]);
            Instant lockedUntil = lockedUntilEpochMillis > 0 ? Instant.ofEpochMilli(lockedUntilEpochMillis) : null;
            return new LoginAttemptRecord(failedAttempts, lockedUntil);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    // Handles refresh token rotation.
    public LoginResponse refreshTokens(String refreshToken) {
        String email;
        String jti;
        try {
            email = jwtService.validateRefreshToken(refreshToken);
            jti = jwtService.extractJti(refreshToken);
        } catch (Exception e) {
            logger.warn("Refresh token validation failed: {}", e.getMessage());
            return null;
        }

        if (jti == null) {
            logger.warn("Refresh token missing JTI claim for user: {}", email);
            return null;
        }

        return getSelf().rotateRefreshTokens(email, jti);
    }

    @Transactional
    public LoginResponse rotateRefreshTokens(String email, String jti) {
        User user = userRepository.findFirstByEmailIgnoreCase(email).orElse(null);
        if (user == null || !user.isVerified()) {
            return null; // Token is structurally valid, but user is gone/disabled.
        }

        // Look up the token record by current JTI or previous JTI
        java.util.Optional<VerificationToken> storedTokenOpt =
                tokenRepository.findByTokenOrPreviousTokenAndTokenTypeForUpdate(jti, VerificationToken.TokenType.REFRESH_TOKEN);

        if (storedTokenOpt.isEmpty()) {
            logger.warn("Refresh token JTI not found for user: {}", email);
            return null;
        }

        VerificationToken storedToken = storedTokenOpt.get();

        boolean userMatches = (storedToken.getUser() != null)
                && ((storedToken.getUser().getUserId() != null && user.getUserId() != null)
                        ? storedToken.getUser().getUserId().equals(user.getUserId())
                        : storedToken.getUser().getEmail() != null && storedToken.getUser().getEmail().equalsIgnoreCase(user.getEmail()));

        if (!userMatches) {
            logger.warn("Refresh token owner mismatch for user: {}", email);
            return null;
        }

        if (storedToken.isUsed() || storedToken.isExpired()) {
            logger.warn("Refresh token JTI is expired or already marked used for user: {}", email);
            return null;
        }

        Instant now = Instant.now();
        boolean matchesCurrentToken = jti.equals(storedToken.getToken());
        boolean matchesRecentPreviousToken = storedToken.getPreviousToken() != null
                && jti.equals(storedToken.getPreviousToken())
                && storedToken.getPreviousTokenExpiresAt() != null
                && now.isBefore(storedToken.getPreviousTokenExpiresAt());

        if (!matchesCurrentToken && !matchesRecentPreviousToken) {
            logger.warn("Refresh token JTI mismatch for user: {} — rejected stale or reused token", email);
            return null;
        }

        String newAccessToken = jwtService.generateToken(email, user.getUsername(), user.getUserId());
        String newRefreshToken;

        if (matchesCurrentToken) {
            // Standard rotation: advance session to new JTI, keeping previous token valid for grace period
            newRefreshToken = jwtService.generateRefreshToken(email);
            String newJti = jwtService.extractJti(newRefreshToken);

            storedToken.setPreviousToken(jti);
            storedToken.setPreviousTokenExpiresAt(now.plus(REFRESH_TOKEN_RETRY_GRACE));
            storedToken.setToken(newJti);
            storedToken.setExpiry(now.plus(Duration.ofDays(30)));
            storedToken.setUsed(false);
            tokenRepository.save(storedToken);
        } else {
            // Concurrent / retry request within grace period:
            // Issue new access token and return a fresh refresh token without breaking the grace chain for other in-flight requests
            newRefreshToken = jwtService.generateRefreshToken(email);
            String newJti = jwtService.extractJti(newRefreshToken);

            storedToken.setToken(newJti);
            storedToken.setExpiry(now.plus(Duration.ofDays(30)));
            tokenRepository.save(storedToken);
        }

        LoginResponse response = new LoginResponse();
        response.setSuccess(true);
        response.setMessage("Token refreshed");
        response.setToken(newAccessToken);
        response.setRefreshToken(newRefreshToken);
        return response;
    }

    /**
     * Stores a new refresh token for a user session, pruning older sessions if the active count exceeds limit.
     */
    private void storeRefreshTokenJti(User user, String refreshToken) {
        String jti = jwtService.extractJti(refreshToken);
        if (jti == null || user == null) return;

        List<VerificationToken> existingTokens = tokenRepository.findByUserAndTokenTypeOrderByExpiryAsc(user, VerificationToken.TokenType.REFRESH_TOKEN);
        if (existingTokens != null && existingTokens.size() >= MAX_ACTIVE_REFRESH_SESSIONS_PER_USER) {
            int toRemove = existingTokens.size() - MAX_ACTIVE_REFRESH_SESSIONS_PER_USER + 1;
            for (int i = 0; i < toRemove && i < existingTokens.size(); i++) {
                tokenRepository.delete(existingTokens.get(i));
            }
        }

        VerificationToken jtiRecord = new VerificationToken();
        jtiRecord.setUser(user);
        jtiRecord.setToken(jti);
        jtiRecord.setPreviousToken(null);
        jtiRecord.setPreviousTokenExpiresAt(null);
        jtiRecord.setTokenType(VerificationToken.TokenType.REFRESH_TOKEN);
        jtiRecord.setExpiry(Instant.now().plus(Duration.ofDays(30)));
        jtiRecord.setUsed(false);
        tokenRepository.save(jtiRecord);
    }

    @Transactional
    public void revokeRefreshToken(String email, String refreshToken) {
        if (email == null || email.isBlank()) {
            return;
        }

        if (refreshToken != null && !refreshToken.isBlank()) {
            try {
                String jti = jwtService.extractJti(refreshToken);
                if (jti != null) {
                    tokenRepository.findByTokenOrPreviousTokenAndTokenTypeForUpdate(jti, VerificationToken.TokenType.REFRESH_TOKEN)
                            .ifPresent(tokenRepository::delete);
                    return;
                }
            } catch (Exception ignored) {
                // Fallback to email-based revocation
            }
        }

        userRepository.findFirstByEmailIgnoreCase(email)
                .ifPresent(user -> tokenRepository.deleteByUserAndTokenType(user, VerificationToken.TokenType.REFRESH_TOKEN));
    }

    @Transactional
    public void revokeRefreshToken(String email) {
        revokeRefreshToken(email, null);
    }

    // Generates and dispatches a new OTP for account verification.
    @Transactional
    public String resendOtp(String email) {
        // Step 1. Validate user existence and status.
        User user = userRepository.findByEmail(email.toLowerCase());

        if (user == null) {
            return "User is not found";
        }

        if (user.isVerified()) {
            return "User already verified.";
        }

        // Step 2. Clean up any old OTPs before issuing a new one to prevent race conditions.
        tokenRepository.deleteByUser(user);
        tokenRepository.flush();

        // Step 3. Generate a fresh 6-digit OTP.
        String otp = generateOtp();

        // Step 4. Save the new token entity.
        VerificationToken verificationToken = new VerificationToken();
        verificationToken.setUser(user);
        verificationToken.setToken(hashOtp(otp));
        verificationToken.setTokenType(VerificationToken.TokenType.VERIFICATION);
        verificationToken.setExpiry(Instant.now().plus(Duration.ofMinutes(10)));
        tokenRepository.save(verificationToken);

        // Step 5. Dispatch the email.
        try {
            emailService.sendVerificationEmail(email.toLowerCase(), otp);
        } catch (Exception e) {
            logger.error("Failed to send verification email to {}: {}", email, e.getMessage());
        }
        return "New OTP send to your email.";
    }

    /**
     * Initiates the forgotten-password flow.
     *
     * <p>Rate limiting for this endpoint (5 requests / 10 minutes per IP+email) is enforced
     * upstream by {@code RateLimitingFilter} before this method is ever reached. No
     * additional throttle gate is needed here.
     */
    @Transactional
    public String forgotPassword(String email) {
        String lowerEmail = email.toLowerCase();

        // Step 1. Attempt to fetch the user.
        User user = userRepository.findByEmail(lowerEmail);

        // Step 2. Security Check: Mask user non-existence.
        if (user == null)
            return "If that email exists, an OTP has been sent.";

        // Step 3. Invalidate any previous unused password reset tokens.
        VerificationToken existingToken = tokenRepository.findByUserAndTokenType(user, VerificationToken.TokenType.PASSWORD_RESET);
        if (existingToken != null) {
            tokenRepository.delete(existingToken);
        }
        tokenRepository.flush();

        // Step 4. Generate and save the new reset OTP.
        String otp = generateOtp();
        VerificationToken verificationToken = new VerificationToken();
        verificationToken.setUser(user);
        verificationToken.setToken(hashOtp(otp));
        verificationToken.setTokenType(VerificationToken.TokenType.PASSWORD_RESET);
        verificationToken.setExpiry(Instant.now().plus(Duration.ofMinutes(10)));
        tokenRepository.save(verificationToken);

        // Step 5. Dispatch the reset email.
        try {
            emailService.sendPasswordResetRequest(lowerEmail, otp);
        } catch (Exception e) {
            logger.error("Failed to send password reset email to {}: {}", email, e.getMessage());
        }
        return "If that email exists, an OTP has been sent.";
    }

    /**
     * Resets the password using the OTP received by email.
     * The token must be of type PASSWORD_RESET and must not be expired or already used.
     */
    @Transactional
    public boolean resetPassword(String email, String token, String newPassword) {
        if (email == null || token == null) {
            return false;
        }

        // Step 1. Fetch user by email.
        User user = userRepository.findFirstByEmailIgnoreCase(email.toLowerCase()).orElse(null);
        if (user == null) {
            return false;
        }

        // Step 2. Fetch the active PASSWORD_RESET token for this user.
        VerificationToken verificationToken = tokenRepository.findByUserAndTokenType(user, VerificationToken.TokenType.PASSWORD_RESET);
        if (verificationToken == null || verificationToken.getTokenType() != VerificationToken.TokenType.PASSWORD_RESET) {
            return false;
        }

        // Step 3. Validate attempts / brute force limit.
        if (verificationToken.getAttempts() >= 5) {
            return false;
        }

        // Step 4. Validate used / expired.
        if (verificationToken.isUsed() || verificationToken.isExpired()) {
            return false;
        }

        // Step 5. Check if the provided OTP matches the stored token hash.
        if (!tokenMatches(verificationToken.getToken(), token)) {
            int newAttempts = verificationToken.getAttempts() + 1;
            verificationToken.setAttempts(newAttempts);
            if (newAttempts >= 5) {
                verificationToken.setUsed(true);
            }
            tokenRepository.save(verificationToken);
            return false;
        }

        // Step 6. Update user's password using Bcrypt.
        user.setPassword(encoder.encode(newPassword));

        // Step 7. Burn the token, set used-at timestamp, and save.
        verificationToken.setUsed(true);
        verificationToken.setUsedAt(Instant.now());
        userRepository.save(user);
        tokenRepository.save(verificationToken);
        tokenRepository.deleteByUserAndTokenType(user, VerificationToken.TokenType.REFRESH_TOKEN);
        clearLoginAttemptRecord(normalizeEmail(email));
        return true;
    }

    public java.util.List<User> getAllUsers() {
        return userRepository.findAll();
    }

    // Fetches all users mapped to secure DTOs.
    public java.util.List<UserResponseDTO> getAllUserDTOs(String excludeEmail) {
        // Step 1. Fetch the raw list from the database.
        java.util.List<User> allUsers = userRepository.findAll();

        // Step 2. Filter and transform entities in parallel stream.
        return allUsers.parallelStream()
                .filter(user -> excludeEmail == null || excludeEmail.isEmpty() || !user.getEmail().equalsIgnoreCase(excludeEmail))
                .map(this::mapToUserResponseDTO)
                .collect(java.util.stream.Collectors.toList());
    }

    /*
     * Maps a database User entity to a data transfer object.
     * We NEVER want to send the raw User entity to the frontend, as it contains
     * the hashed password, internal DB IDs, and private tokens.
     */
    public UserResponseDTO mapToUserResponseDTO(User user) {
        // Step 1. Dynamically generate an S3 presigned URL if they have an avatar key saved.
        String presignedUrl = user.getProfilePicUrl() != null && !user.getProfilePicUrl().isEmpty()
                ? getSelf().generatePresignedUrl(user.getProfilePicUrl())
                : null;

        // Step 2. Construct the DTO with safe public data.
        return new UserResponseDTO(
                user.getUserId(),
                user.getUsername(),
                user.getFullName(),
                user.getEmail(),
                user.isVerified(),
                presignedUrl,
                user.getLastActive(),
                user.getFirstName(),
                user.getLastName(),
                user.getContactNumber(),
                user.getCountryCode(),
                user.getJobTitle(),
                user.getCompany(),
                user.getPosition(),
                user.getBio(),
                user.getGithubUsername(),
                user.getGithubEmail(),
                user.isNotifyDueDateReminders()
        );
    }

    @Cacheable(value = "userProfile", key = "#email")
    public UserResponseDTO getCurrentUserDTO(String email) {
        // Orchestration method: Fetches user and immediately converts to DTO.
        User user = getUserByEmail(email);
        return mapToUserResponseDTO(user);
    }

    @Transactional
    @CachePut(value = "userProfile", key = "#email")
    public UserResponseDTO updateUserProfileAndGetDTO(String email, UpdateProfileRequest request) {
        // Orchestration method: Updates user and immediately returns the fresh DTO state.
        User updatedUser = updateUserProfile(email, request);
        return mapToUserResponseDTO(updatedUser);
    }

    @Transactional
    @CachePut(value = "userProfile", key = "#email")
    public UserResponseDTO updateGithubUsernameAndGetDTO(String email, String githubUsername) {
        User user = getUserByEmail(email);
        validateGithubUsernameUniqueness(user, githubUsername);
        user.setGithubUsername(githubUsername);
        user.setGithubEmail(null);
        return mapToUserResponseDTO(userRepository.save(user));
    }

    @Transactional
    @CachePut(value = "userProfile", key = "#email")
    public UserResponseDTO unlinkGithubUsernameAndGetDTO(String email) {
        User user = getUserByEmail(email);
        user.setGithubUsername(null);
        user.setGithubEmail(null);
        return mapToUserResponseDTO(userRepository.save(user));
    }

    @Transactional
    public void logoutAllSessions(String email) {
        User user = getUserByEmail(email);
        tokenRepository.deleteByUserAndTokenType(user, VerificationToken.TokenType.REFRESH_TOKEN);
    }

    private void validateGithubUsernameUniqueness(User currentUser, String githubUsername) {
        if (githubUsername == null || githubUsername.isBlank()) {
            return;
        }

        List<User> linkedUsers = userRepository.findByGithubUsernameIgnoreCase(githubUsername);
        boolean conflict = linkedUsers.stream()
                .anyMatch(otherUser -> !otherUser.getUserId().equals(currentUser.getUserId()));

        if (conflict) {
            throw new IllegalStateException("GitHub username is already linked to another user");
        }
    }

    /**
     * Generates a presigned S3 URL for a single user's profile photo on demand.
     * Returns null if the user has no profile picture or does not exist.
     */
    public String generatePresignedUrlForUser(Long userId) {
        // Step 1. Fetch user by ID.
        User user = userRepository.findById(userId).orElse(null);

        // Step 2. Quick exit if no user or no picture configured.
        if (user == null || user.getProfilePicUrl() == null || user.getProfilePicUrl().isEmpty()) {
            return null;
        }

        // Step 3. Pass to the generation method.
        return getSelf().generatePresignedUrl(user.getProfilePicUrl());
    }

    /*
     * Core helper method to fetch a user safely.
     * Throws an exception if not found to fail fast.
     */
    public User getUserByEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("User email is required");
        }

        return userRepository.findFirstByEmailIgnoreCase(email.toLowerCase())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    // Updates specific user details (specifically fullName for now).
    @Transactional
    public User updateUserDetails(String email, String newFullName) {
        // Step 1. Fetch the user.
        User user = userRepository.findFirstByEmailIgnoreCase(email.toLowerCase()).orElse(null);
        if (user == null) {
            throw new ResourceNotFoundException("User not found");
        }

        // Step 2. Validate incoming data.
        if (newFullName != null && !newFullName.isEmpty()) {
            user.setFullName(newFullName);
        } else {
            throw new IllegalArgumentException("Full name cannot be empty");
        }

        // Step 3. Re setting fields to trigger Hibernate dirty checking if needed.
        user.setEmail(user.getEmail());
        user.setUsername(user.getUsername());

        return userRepository.save(user);
    }

    /*
     * Processes a bulk profile update from a request payload.
     * Only updates fields that are explicitly provided (non-null) in the request.
     */
    @Transactional
    public User updateUserProfile(String email, UpdateProfileRequest request) {
        // Step 1. Fetch user.
        User user = userRepository.findFirstByEmailIgnoreCase(email.toLowerCase())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // Step 2. Selectively apply updates. Null checks ensure we don't overwrite existing data with null.
        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setFullName(request.getFullName());
        }
        if (request.getFirstName() != null)
            user.setFirstName(request.getFirstName());

        if (request.getLastName() != null)
            user.setLastName(request.getLastName());

        if (request.getContactNumber() != null)
            user.setContactNumber(request.getContactNumber());

        if (request.getCountryCode() != null)
            user.setCountryCode(request.getCountryCode());

        if (request.getJobTitle() != null)
            user.setJobTitle(request.getJobTitle());

        if (request.getCompany() != null)
            user.setCompany(request.getCompany());

        if (request.getPosition() != null)
            user.setPosition(request.getPosition());

        if (request.getBio() != null)
            user.setBio(request.getBio());

        if (request.getNotifyDueDateReminders() != null) {
            user.setNotifyDueDateReminders(request.getNotifyDueDateReminders());
        }
        // Step 3. Save to a database.
        return userRepository.save(user);
    }

    /*
     * Uploads a new profile picture to S3 and updates the user record.
     * Automatically handles the cleanup of the user's old profile picture to save AWS storage costs.
     */
    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "userProfile", key = "#email"),
            @CacheEvict(value = "userPhotoUrls", allEntries = true)
    })
    public String uploadProfilePicture(String email, MultipartFile file) {
        // Step 1. Validate User exists.
        User user = userRepository.findFirstByEmailIgnoreCase(email.toLowerCase()).orElse(null);
        if (user == null) {
            throw new ResourceNotFoundException("User not found");
        }

        // Step 2. Hard validation on file size (25MB limit).
        if (file.getSize() > MAX_PROFILE_PHOTO_SIZE_BYTES) {
            throw new IllegalArgumentException("File size exceeds maximum limit of 25MB");
        }

        // Step 3. Validate MIME type against the allowed list to prevent malicious uploads.
        String contentType = file.getContentType();
        if (contentType == null || !isValidImageType(contentType)) {
            throw new IllegalArgumentException("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed");
        }

        // Browser-provided MIME types are not authoritative. Detect the bytes
        // before they are persisted to the private bucket.
        try {
            if (!isValidImageByMagicBytes(file)) {
                throw new IllegalArgumentException("Image content does not match an allowed image format");
            }
        } catch (IOException ex) {
            throw new IllegalArgumentException("Could not validate image content");
        }

        String oldKey = extractKeyFromStoredValue(user.getProfilePicUrl());
        String uniqueFileName = UUID.randomUUID() + extensionForContentType(contentType);
        boolean replacementUploaded = false;

        try {
            // Build the replacement from the validated MIME type. Camera and clipboard
            // uploads commonly have no filename extension, so the original name is not
            // safe input for key construction.

            // Step 6. Build AWS upload request metadata.
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(profileBucket)
                    .key(uniqueFileName)
                    .contentType(contentType)
                    .build();

            // Step 7. Stream file directly from the HTTP request to AWS S3.
            s3Client.putObject(putObjectRequest,
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
            replacementUploaded = true;

            // Persist the new key before deleting the old object. A failed replacement
            // must never remove the user's currently working avatar.
            user.setProfilePicUrl(uniqueFileName);
            userRepository.saveAndFlush(user);

            if (oldKey != null && !oldKey.isEmpty() && !oldKey.equals(uniqueFileName)) {
                deleteProfilePictureByKey(oldKey);
            }

            return uniqueFileName;

        } catch (Exception e) {
            if (replacementUploaded) {
                deleteProfilePictureByKey(uniqueFileName);
            }
            logger.error("Failed to replace profile photo for user {}", email, e);
            throw new ProfilePhotoStorageException("Could not store the profile photo", e);
        }
    }

    private String extensionForContentType(String contentType) {
        return switch (contentType.toLowerCase()) {
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
    }

    // Whitelist of allowed MIME types for avatar uploads.
    public boolean isValidImageType(String contentType) {
        return contentType.equals("image/jpeg") ||
                contentType.equals("image/png") ||
                contentType.equals("image/gif") ||
                contentType.equals("image/webp");
    }

    /**
     * Validates a MultipartFile is a genuine image by reading its magic bytes.
     * Rejects files whose actual content does not match an allowed image format,
     * regardless of what Content-Type the client claimed.
     */
    public boolean isValidImageByMagicBytes(MultipartFile file) throws IOException {
        // Use Apache Tika to detect the REAL media type from the byte stream
        Tika tika = new Tika();
        String detectedType = tika.detect(file.getInputStream());
        // Allow only these four safe image formats
        return detectedType != null && List.of(
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/gif"
        ).contains(detectedType.toLowerCase());
    }

    /**
     * Resolves the S3 object key from the stored value.
     * Handles both legacy full-URL values and new key-only values for backward compatibility.
     */
    private String extractKeyFromStoredValue(String stored) {
        // Step 1. Check for null or empty strings.
        if (stored == null || stored.isEmpty())
            return stored;

        // Step 2. If it's a full URL, split the string at the last slash and take the end (the filename/key).
        if (stored.startsWith("http://") || stored.startsWith("https://")) {
            return stored.substring(stored.lastIndexOf("/") + 1);
        }

        // Step 3. If it doesn't have a protocol, assume it's already just the key.
        return stored;
    }

    // Issues a delete command to S3 for a specific object key.
    private void deleteProfilePictureByKey(String key) {
        if (key == null || key.isEmpty()) return;
        try {
            // Step 1. Build the deletion request targeting our specific bucket.
            DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                    .bucket(profileBucket)
                    .key(key)
                    .build();

            // Step 2. Execute.
            s3Client.deleteObject(deleteObjectRequest);
        } catch (Exception e) {
            // Step 3. We log and swallow the exception. A failure to delete an old picture
            // shouldn't crash the server or break the user's ability to upload a new one.
            logger.warn("Failed to delete old profile picture from S3 (key={}): {}", key, e.getMessage());
        }
    }

    /**
     * Generates a presigned S3 URL valid for 60 minutes.
     * Accepts either a raw S3 object key or a legacy full S3 URL for backward compatibility.
     * Returns null/empty for null/empty input. Results are cached via Spring Cache (userPhotoUrls).
     */
    @Cacheable(value = "userPhotoUrls", key = "#photoKey", condition = "#photoKey != null", unless = "#result == null")
    public String generatePresignedUrl(String photoKey) {
        // Step 1. Handle empty states gracefully.
        if (photoKey == null || photoKey.isEmpty()) {
            return photoKey;
        }

        // Step 2. Strip any legacy HTTP formatting to isolate just the S3 Key.
        String key = extractKeyFromStoredValue(photoKey);

        try {
            // Step 4. Build S3 Request targeting the specific object key.
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(profileBucket)
                    .key(key)
                    .build();

            // Step 5. Request a cryptographic signature valid for 60 minutes.
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(60))
                    .getObjectRequest(getObjectRequest)
                    .build();

            // Step 6. Execute generation and convert to string URL.
            return s3Presigner.presignGetObject(presignRequest).url().toString();
        } catch (Exception e) {
            logger.error("Failed to generate presigned URL for key={}: {}", key, e.getMessage());
            return null;
        }
    }

    private String hashToken(String rawToken) {
        if (rawToken == null) {
            return null;
        }
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not found", e);
        }
    }

    private String generateOtp() {
        return String.format("%06d", OTP_RANDOM.nextInt(1_000_000));
    }

    /** Hashes newly issued OTPs; legacy plaintext and SHA-256 values remain valid until their expiry. */
    private String hashOtp(String rawToken) {
        return HASHED_OTP_PREFIX + hmacToken(rawToken);
    }

    private boolean tokenMatches(String storedToken, String rawToken) {
        if (storedToken == null || rawToken == null) {
            return false;
        }
        String expected = storedToken.startsWith(HASHED_OTP_PREFIX)
                ? HASHED_OTP_PREFIX + hmacToken(rawToken)
                : storedToken.matches("[0-9a-f]{64}") ? hashToken(rawToken) : rawToken;
        return java.security.MessageDigest.isEqual(
                storedToken.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                expected.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private String hmacToken(String rawToken) {
        if (otpPepper == null || otpPepper.isBlank()) {
            // Unit-test compatibility only; production configuration supplies a non-empty pepper.
            return hashToken(rawToken);
        }
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(
                    otpPepper.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
            return java.util.HexFormat.of().formatHex(mac.doFinal(rawToken.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException ex) {
            throw new IllegalStateException("Could not hash verification token", ex);
        }
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(java.util.Locale.ROOT);
    }

    /*
     * Generates a cryptographically secure random string.
     * Used for creating secure tokens (like password reset hashes) that cannot be easily guessed.
     */
    @SuppressWarnings("unused")
    private String generateSecureToken() {
        // Step 1. Instantiate the secure random number generator.
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32]; // 32 bytes = 256 bits of entropy.

        // Step 2. Fill the array with random bytes.
        random.nextBytes(bytes);

        // Step 3. Encode to a URL-safe Base64 string without padding characters (=).
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
