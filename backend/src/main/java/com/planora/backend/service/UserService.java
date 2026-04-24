package com.planora.backend.service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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
import com.planora.backend.model.User;
import com.planora.backend.model.VerificationToken;
import com.planora.backend.repository.TokenRepository;
import com.planora.backend.repository.UserRepository;

import jakarta.transaction.Transactional;
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

    @Value("${aws.s3.profile-bucket}")
    private String profileBucket;

    @Value("${aws.region}")
    private String region;

    /** In-memory presigned URL cache: S3 key → (url, expiry). TTL = 55 min (URLs expire at 60 min). */
    /* Generating S3 presigned URLs is a CPU-intensive cryptographic operation.
     * Caching them prevents our server from buckling under load if a user frequently
     * refreshes the page or fetches lists of users.
     */
    private final Map<String, Object[]> presignedUrlCache = new ConcurrentHashMap<>();
    private static final Duration PRESIGN_TTL = Duration.ofMinutes(55);

    public UserService(UserRepository userRepository, JWTService jwtService, AuthenticationManager authenticationManager, TokenRepository tokenRepository, EmailService emailService, S3Client s3Client, S3Presigner s3Presigner) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.tokenRepository = tokenRepository;
        this.emailService = emailService;
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
    }

    /*
    * Handles new user registration.
    * if a user tries to register with an email already in the system but unverified,
    * we recycle the account and issue a new OTP rather than blocking them */
    @Transactional
    public String register(User user) {

        // Step 1. Check if the email already exists in the database.
        User existingUser = userRepository.findByEmailIgnoreCase(user.getEmail().toLowerCase()).orElse(null);

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
        String otp = String.valueOf(new Random().nextInt(900000) + 100000);

        // Step 4. Build the token entity linking the OTP to the user.
        VerificationToken verificationToken = new VerificationToken();
        verificationToken.setUser(user);
        verificationToken.setToken(otp);
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
    public boolean verifyToken(String email, String otp) {
        // Step 1. Fetch user. If no user, fail immediately.
        User user = userRepository.findByEmailIgnoreCase(email.toLowerCase()).orElse(null);
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
        if (verificationToken.getToken().equals(otp)) {
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
        try {
            // Step 1: Delegate password checking to Spring Security's AuthenticationManager.
            Authentication authentication =
                    authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
                            user.getEmail().toLowerCase(),
                            user.getPassword()));

            // Step 2. If auth succeeds, generate JWT.
            if (authentication.isAuthenticated()) {
                User authenticatedUser = userRepository.findByEmailIgnoreCase(user.getEmail().toLowerCase()).orElse(null);

                // Create short-lived access token and long-lived refresh token.
                String accessToken  = jwtService.generateToken(user.getEmail().toLowerCase(), authenticatedUser.getUsername());
                String refreshToken = jwtService.generateRefreshToken(user.getEmail().toLowerCase());

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
            LoginResponse response = new LoginResponse();
            response.setSuccess(false);
            response.setMessage("Incorrect username or password");
            response.setErrorCode("INVALID_CREDENTIALS");
            return response;
        }
    }

    // Handles refresh token rotation.
    @Transactional
    public LoginResponse refreshTokens(String refreshToken) {
        try {
            // Step 1. Cryptographically validate the incoming token and extract the subject (email).
            String email = jwtService.validateRefreshToken(refreshToken);
            User user = userRepository.findByEmailIgnoreCase(email).orElse(null);
            if (user == null || !user.isVerified()) {
                return null; // Token is structurally valid, but user is gone/disabled.
            }

            // Step 2. Verify this specific refresh token's JTI was issued and not yet used
            String jti = jwtService.extractJti(refreshToken);
            if (jti == null) {
                logger.warn("Refresh token missing JTI claim for user: {}", email);
                return null;
            }

            // Step 3. Look up the expected JTI in our database for this user.
            VerificationToken storedToken = tokenRepository.findByUserAndTokenType(user, VerificationToken.TokenType.REFRESH_TOKEN);

            // Step 4. Validate DB record state.
            if (storedToken == null || storedToken.isUsed() || storedToken.isExpired()) {
                logger.warn("Refresh token JTI not found or already used for user: {}", email);
                return null;
            }

            // Step 5. Check for Replay Attacks. Compare JTI with DB JTI.
            if (!jti.equals(storedToken.getToken())) {
                logger.warn("Refresh token JTI mismatch for user: {} — possible token reuse attack", email);
                // Invalidate all refresh tokens for this user as a security measure
                tokenRepository.delete(storedToken);
                return null;
            }

            // Step 6. Mark the current token as used so it can't be submitted again.
            storedToken.setUsed(true);
            tokenRepository.save(storedToken);

            // Step 7. Issue new tokens
            String newAccessToken  = jwtService.generateToken(email, user.getUsername());
            String newRefreshToken = jwtService.generateRefreshToken(email);

            // Step 8. Store the new refresh token JTI
            storeRefreshTokenJti(user, newRefreshToken);

            LoginResponse response = new LoginResponse();
            response.setSuccess(true);
            response.setMessage("Token refreshed");
            response.setToken(newAccessToken);
            response.setRefreshToken(newRefreshToken);
            return response;
        } catch (Exception e) {
            logger.warn("Refresh token validation failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Stores the JTI of the given refresh token for the user, replacing any existing refresh token record.
     * The JTI is a UUID extracted from the JWT claims — short enough to store in the token column.
     */
    private void storeRefreshTokenJti(User user, String refreshToken) {
        String jti = jwtService.extractJti(refreshToken);
        if (jti == null) return;

        // Step 1. Remove the existing REFRESH_TOKEN record
        // This enforces a strict 1-to-1 relationship (one active refresh session per user).
        VerificationToken existing = tokenRepository.findByUserAndTokenType(user, VerificationToken.TokenType.REFRESH_TOKEN);
        if (existing != null) {
            tokenRepository.delete(existing);
            tokenRepository.flush();
        }

        // Step 2. Build and save the new record tracking this specific JTI.
        VerificationToken jtiRecord = new VerificationToken();
        jtiRecord.setUser(user);
        jtiRecord.setToken(jti);
        jtiRecord.setTokenType(VerificationToken.TokenType.REFRESH_TOKEN);
        jtiRecord.setExpiry(java.time.Instant.now().plus(java.time.Duration.ofDays(7)));
        jtiRecord.setUsed(false);
        tokenRepository.save(jtiRecord);
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
        String otp = String.valueOf(new Random().nextInt(900000) + 100000);

        // Step 4. Save the new token entity.
        VerificationToken verificationToken = new VerificationToken();
        verificationToken.setUser(user);
        verificationToken.setToken(otp);
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

    // Initiate the forgotten password flow.
    @Transactional
    public String forgotPassword(String email) {
        // Step 1. Attempt to fetch the user.
        User user = userRepository.findByEmail(email.toLowerCase());

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
        String otp = String.valueOf(new Random().nextInt(900000) + 100000);
        VerificationToken verificationToken = new VerificationToken();
        verificationToken.setUser(user);
        verificationToken.setToken(otp);
        verificationToken.setTokenType(VerificationToken.TokenType.PASSWORD_RESET);
        verificationToken.setExpiry(Instant.now().plus(Duration.ofMinutes(10)));
        tokenRepository.save(verificationToken);

        // Step 5. Dispatch the reset email.
        try {
            emailService.sendPasswordResetRequest(email.toLowerCase(), otp);
        } catch (Exception e) {
            logger.error("Failed to send password reset email to {}: {}", email, e.getMessage());
        }
        return "Password reset OTP sent successfully.";
    }

    /**
     * Resets the password using the OTP received by email (which is the token stored in VerificationToken).
     * The token must be of type PASSWORD_RESET and must not be expired or already used.
     */
    @Transactional
    public boolean resetPassword(String token, String newPassword) {
        // Step 1. Fetch the token directly.
        VerificationToken verificationToken = tokenRepository.findByToken(token);

        // Step 2. Validate the token state and ensure it's specifically a password reset token.
        if (verificationToken == null || verificationToken.isUsed() || verificationToken.isExpired()
                || verificationToken.getTokenType() != VerificationToken.TokenType.PASSWORD_RESET) {
            return false;
        }

        // Step 3. Retrieve the associated user and update their password using Bcrypt.
        User user = verificationToken.getUser();
        user.setPassword(encoder.encode(newPassword));

        // Step 4. Burn the token so it cannot be reused and save both entities.
        verificationToken.setUsed(true);
        userRepository.save(user);
        tokenRepository.save(verificationToken);
        return true;
    }

    public java.util.List<User> getAllUsers() {
        return userRepository.findAll();
    }

    // Fetches all users mapped to secure DTOs.
    public java.util.List<UserResponseDTO> getAllUserDTOs(String excludeEmail) {
        // Step 1. Fetch the raw list from the database.
        java.util.List<User> allUsers = userRepository.findAll();

        // Step 2. Filter out the specific email if requested.
        if (excludeEmail != null && !excludeEmail.isEmpty()) {
            allUsers = allUsers.stream()
                    .filter(user -> !user.getEmail().equalsIgnoreCase(excludeEmail))
                    .collect(java.util.stream.Collectors.toList());
        }

        // Step 3. Transform the remaining entities into clean DTOs.
        return allUsers.stream()
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
                ? generatePresignedUrl(user.getProfilePicUrl())
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
                user.isNotifyDueDateReminders()
        );
    }

    public UserResponseDTO getCurrentUserDTO(String email) {
        // Orchestration method: Fetches user and immediately converts to DTO.
        User user = getUserByEmail(email);
        return mapToUserResponseDTO(user);
    }

    @Transactional
    public UserResponseDTO updateUserProfileAndGetDTO(String email, UpdateProfileRequest request) {
        // Orchestration method: Updates user and immediately returns the fresh DTO state.
        User updatedUser = updateUserProfile(email, request);
        return mapToUserResponseDTO(updatedUser);
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
        return generatePresignedUrl(user.getProfilePicUrl());
    }

    /*
     * Core helper method to fetch a user safely.
     * Throws an exception if not found to fail fast.
     */
    public User getUserByEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new RuntimeException("User email is required");
        }

        return userRepository.findByEmailIgnoreCase(email.toLowerCase())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // Updates specific user details (specifically fullName for now).
    @Transactional
    public User updateUserDetails(String email, String newFullName) {
        // Step 1. Fetch the user.
        User user = userRepository.findByEmailIgnoreCase(email.toLowerCase()).orElse(null);
        if (user == null) {
            throw new RuntimeException("User not found");
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
        User user = userRepository.findByEmailIgnoreCase(email.toLowerCase())
                .orElseThrow(() -> new RuntimeException("User not found"));

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
    public String uploadProfilePicture(String email, MultipartFile file) {
        // Step 1. Validate User exists.
        User user = userRepository.findByEmailIgnoreCase(email.toLowerCase()).orElse(null);
        if (user == null) {
            throw new RuntimeException("User not found");
        }

        // Step 2. Hard validation on file size (25MB limit).
        long maxFileSize = 25L * 1024 * 1024; // 25 MB to match service-layer limit
        if (file.getSize() > maxFileSize) {
            throw new IllegalArgumentException("File size exceeds maximum limit of 25MB");
        }

        // Step 3. Validate MIME type against the allowed list to prevent malicious uploads.
        String contentType = file.getContentType();
        if (contentType == null || !isValidImageType(contentType)) {
            throw new IllegalArgumentException("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed");
        }

        try {
            // Step 4. Check if user already has an avatar. If yes, issue delete command to S3.
            String oldKey = user.getProfilePicUrl();
            if (oldKey != null && !oldKey.isEmpty()) {
                deleteProfilePictureByKey(extractKeyFromStoredValue(oldKey));
            }

            // Step 5. Construct a collision-free filename using UUIDs.
            String originalFilename = file.getOriginalFilename();
            String fileExtension = originalFilename != null ? originalFilename.substring(originalFilename.lastIndexOf(".")) : ".jpg";
            String uniqueFileName = UUID.randomUUID().toString() + fileExtension;

            // Step 6. Build AWS upload request metadata.
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(profileBucket)
                    .key(uniqueFileName)
                    .contentType(contentType)
                    .build();

            // Step 7. Stream file directly from the HTTP request to AWS S3.
            s3Client.putObject(putObjectRequest,
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

            // Step 8. Store ONLY the S3 object key. Storing full URLs makes migrating AWS buckets difficult.
            user.setProfilePicUrl(uniqueFileName);
            userRepository.save(user);

            return uniqueFileName;

        } catch (Exception e) {
            throw new RuntimeException("Could not store the file in S3. Error: " + e.getMessage());
        }
    }

    // Whitelist of allowed MIME types for avatar uploads.
    public boolean isValidImageType(String contentType) {
        return contentType.equals("image/jpeg") ||
                contentType.equals("image/png") ||
                contentType.equals("image/gif") ||
                contentType.equals("image/webp");
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
     * Returns null/empty for null/empty input. Results are cached for 55 minutes.
     */
    public String generatePresignedUrl(String stored) {
        // Step 1. Handle empty states gracefully.
        if (stored == null || stored.isEmpty()) {
            return stored;
        }

        // Step 2. Strip any legacy HTTP formatting to isolate just the S3 Key.
        String key = extractKeyFromStoredValue(stored);

        // Step 3. Query the in-memory ConcurrentHashMap cache.
        Object[] cached = presignedUrlCache.get(key);
        if (cached != null) {
            Instant expiry = (Instant) cached[1];

            // Step 3a. If the cached URL is still valid, return it instantly.
            if (Instant.now().isBefore(expiry)) {
                return (String) cached[0];
            }

            // Step 3b. Cache is expired. Remove it and proceed to generate a new one.
            presignedUrlCache.remove(key);
        }

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
            String url = s3Presigner.presignGetObject(presignRequest).url().toString();

            // Step 7. Push to cache. We set the cache expiry to 55 minutes
            // (5 minutes BEFORE the actual AWS 60-minute expiry) to prevent edge-case race conditions.
            presignedUrlCache.put(key, new Object[]{url, Instant.now().plus(PRESIGN_TTL)});
            return url;
        } catch (Exception e) {
            logger.error("Failed to generate presigned URL for key={}: {}", key, e.getMessage());
            return null;
        }
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


