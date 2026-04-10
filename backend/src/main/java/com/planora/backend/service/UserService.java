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

@Service
public class UserService {

    private static final Logger logger = LoggerFactory.getLogger(UserService.class);
    private final UserRepository userRepository;
    private final JWTService jwtService;

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

    @Transactional
    public String register(User user) {

        User existingUser = userRepository.findByEmailIgnoreCase(user.getEmail().toLowerCase()).orElse(null);

        if (existingUser != null) {
            if (!existingUser.isVerified()) {
                tokenRepository.deleteByUser(existingUser);
                tokenRepository.flush();
                user = existingUser;
            } else {
                return "User already verified. Please login.";
            }
        } else {
            user.setEmail(user.getEmail().toLowerCase());
            user.setPassword(encoder.encode(user.getPassword()));
            user.setVerified(false);
            userRepository.save(user);
            userRepository.flush();
        }

        String otp = String.valueOf(new Random().nextInt(900000) + 100000);
        VerificationToken verificationToken = new VerificationToken();
        verificationToken.setUser(user);
        verificationToken.setToken(otp);
        verificationToken.setTokenType(VerificationToken.TokenType.VERIFICATION);
        verificationToken.setExpiry(Instant.now().plus(Duration.ofMinutes(10)));
        tokenRepository.save(verificationToken);

        try {
            emailService.sendVerificationEmail(user.getEmail(), otp);
        } catch (Exception e) {
            logger.error("Failed to send verification email to {}: {}", user.getEmail(), e.getMessage());
        }
        return "OTP send successfully";
    }

    @Transactional
    public boolean verifyToken(String email, String otp) {
        User user = userRepository.findByEmailIgnoreCase(email.toLowerCase()).orElse(null);
        if (user == null) {
            return false;
        }
        VerificationToken verificationToken = tokenRepository.findByUserAndTokenType(user, VerificationToken.TokenType.VERIFICATION);

        if (verificationToken == null || verificationToken.isUsed() || verificationToken.getExpiry().isBefore(Instant.now())) {
            return false;
        }

        if (verificationToken.getAttempts() >= 5) {
            return false;
        }

        if (verificationToken.getToken().equals(otp)) {
            user.setVerified(true);
            verificationToken.setUsed(true);
            userRepository.save(user);
            tokenRepository.save(verificationToken);
            return true;
        } else {
            verificationToken.setAttempts(verificationToken.getAttempts() + 1);
            tokenRepository.save(verificationToken);
            return false;
        }
    }

    @Transactional
    public LoginResponse loginUser(User user) {
        try {
            Authentication authentication =
                    authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
                            user.getEmail().toLowerCase(),
                            user.getPassword()));

            if (authentication.isAuthenticated()) {
                User authenticatedUser = userRepository.findByEmailIgnoreCase(user.getEmail().toLowerCase()).orElse(null);
                String accessToken  = jwtService.generateToken(user.getEmail().toLowerCase(), authenticatedUser.getUsername());
                String refreshToken = jwtService.generateRefreshToken(user.getEmail().toLowerCase());

                // Store the JTI of the new refresh token for rotation tracking
                storeRefreshTokenJti(authenticatedUser, refreshToken);

                LoginResponse response = new LoginResponse();
                response.setSuccess(true);
                response.setMessage("Login successful");
                response.setToken(accessToken);
                response.setRefreshToken(refreshToken);
                return response;
            }

            LoginResponse response = new LoginResponse();
            response.setSuccess(false);
            response.setMessage("Incorrect username or password");
            response.setErrorCode("INVALID_CREDENTIALS");
            return response;
        } catch (DisabledException e) {
            LoginResponse response = new LoginResponse();
            response.setSuccess(false);
            response.setMessage("Email is not verified. Please check your email.");
            response.setErrorCode("UNVERIFIED_EMAIL");
            return response;
        } catch (AuthenticationException e) {
            LoginResponse response = new LoginResponse();
            response.setSuccess(false);
            response.setMessage("Incorrect username or password");
            response.setErrorCode("INVALID_CREDENTIALS");
            return response;
        }
    }

    @Transactional
    public LoginResponse refreshTokens(String refreshToken) {
        try {
            String email = jwtService.validateRefreshToken(refreshToken);
            User user = userRepository.findByEmailIgnoreCase(email).orElse(null);
            if (user == null || !user.isVerified()) {
                return null;
            }

            // Verify this specific refresh token's JTI was issued and not yet used
            String jti = jwtService.extractJti(refreshToken);
            if (jti == null) {
                logger.warn("Refresh token missing JTI claim for user: {}", email);
                return null;
            }

            VerificationToken storedToken = tokenRepository.findByUserAndTokenType(user, VerificationToken.TokenType.REFRESH_TOKEN);
            if (storedToken == null || storedToken.isUsed() || storedToken.isExpired()) {
                logger.warn("Refresh token JTI not found or already used for user: {}", email);
                return null;
            }
            if (!jti.equals(storedToken.getToken())) {
                logger.warn("Refresh token JTI mismatch for user: {} — possible token reuse attack", email);
                // Invalidate all refresh tokens for this user as a security measure
                tokenRepository.delete(storedToken);
                return null;
            }

            // Invalidate the used refresh token
            storedToken.setUsed(true);
            tokenRepository.save(storedToken);

            // Issue new tokens
            String newAccessToken  = jwtService.generateToken(email, user.getUsername());
            String newRefreshToken = jwtService.generateRefreshToken(email);

            // Store the new refresh token JTI
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

        // Remove existing REFRESH_TOKEN record for this user (unique constraint: one per user per type)
        VerificationToken existing = tokenRepository.findByUserAndTokenType(user, VerificationToken.TokenType.REFRESH_TOKEN);
        if (existing != null) {
            tokenRepository.delete(existing);
            tokenRepository.flush();
        }

        VerificationToken jtiRecord = new VerificationToken();
        jtiRecord.setUser(user);
        jtiRecord.setToken(jti);
        jtiRecord.setTokenType(VerificationToken.TokenType.REFRESH_TOKEN);
        jtiRecord.setExpiry(java.time.Instant.now().plus(java.time.Duration.ofDays(7)));
        jtiRecord.setUsed(false);
        tokenRepository.save(jtiRecord);
    }

    @Transactional
    public String resendOtp(String email) {
        User user = userRepository.findByEmail(email.toLowerCase());

        if (user == null) {
            return "User is not found";
        }

        if (user.isVerified()) {
            return "User already verified.";
        }

        tokenRepository.deleteByUser(user);
        tokenRepository.flush();

        String otp = String.valueOf(new Random().nextInt(900000) + 100000);
        VerificationToken verificationToken = new VerificationToken();
        verificationToken.setUser(user);
        verificationToken.setToken(otp);
        verificationToken.setTokenType(VerificationToken.TokenType.VERIFICATION);
        verificationToken.setExpiry(Instant.now().plus(Duration.ofMinutes(10)));
        tokenRepository.save(verificationToken);

        try {
            emailService.sendVerificationEmail(email.toLowerCase(), otp);
        } catch (Exception e) {
            logger.error("Failed to send verification email to {}: {}", email, e.getMessage());
        }
        return "New OTP send to your email.";
    }

    @Transactional
    public String forgotPassword(String email) {
        User user = userRepository.findByEmail(email.toLowerCase());

        if (user == null)
            return "If that email exists, an OTP has been sent.";

        VerificationToken existingToken = tokenRepository.findByUserAndTokenType(user, VerificationToken.TokenType.PASSWORD_RESET);
        if (existingToken != null) {
            tokenRepository.delete(existingToken);
        }
        tokenRepository.flush();

        String otp = String.valueOf(new Random().nextInt(900000) + 100000);
        VerificationToken verificationToken = new VerificationToken();
        verificationToken.setUser(user);
        verificationToken.setToken(otp);
        verificationToken.setTokenType(VerificationToken.TokenType.PASSWORD_RESET);
        verificationToken.setExpiry(Instant.now().plus(Duration.ofMinutes(10)));
        tokenRepository.save(verificationToken);

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
        VerificationToken verificationToken = tokenRepository.findByToken(token);

        if (verificationToken == null || verificationToken.isUsed() || verificationToken.isExpired()
                || verificationToken.getTokenType() != VerificationToken.TokenType.PASSWORD_RESET) {
            return false;
        }

        User user = verificationToken.getUser();
        user.setPassword(encoder.encode(newPassword));
        verificationToken.setUsed(true);
        userRepository.save(user);
        tokenRepository.save(verificationToken);
        return true;
    }

    public java.util.List<User> getAllUsers() {
        return userRepository.findAll();
    }

    /**
     * Generates a presigned S3 URL for a single user's profile photo on demand.
     * Returns null if the user has no profile picture or does not exist.
     */
    public String generatePresignedUrlForUser(Long userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.getProfilePicUrl() == null || user.getProfilePicUrl().isEmpty()) {
            return null;
        }
        return generatePresignedUrl(user.getProfilePicUrl());
    }

    public User getUserByEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new RuntimeException("User email is required");
        }

        return userRepository.findByEmailIgnoreCase(email.toLowerCase())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    @Transactional
    public User updateUserDetails(String email, String newFullName) {
        User user = userRepository.findByEmailIgnoreCase(email.toLowerCase()).orElse(null);
        if (user == null) {
            throw new RuntimeException("User not found");
        }

        if (newFullName != null && !newFullName.isEmpty()) {
            user.setFullName(newFullName);
        } else {
            throw new IllegalArgumentException("Full name cannot be empty");
        }

        user.setEmail(user.getEmail());
        user.setUsername(user.getUsername());

        return userRepository.save(user);
    }

    @Transactional
    public User updateUserProfile(String email, UpdateProfileRequest request) {
        User user = userRepository.findByEmailIgnoreCase(email.toLowerCase())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setFullName(request.getFullName());
        }
        if (request.getFirstName() != null) user.setFirstName(request.getFirstName());
        if (request.getLastName() != null) user.setLastName(request.getLastName());
        if (request.getContactNumber() != null) user.setContactNumber(request.getContactNumber());
        if (request.getCountryCode() != null) user.setCountryCode(request.getCountryCode());
        if (request.getJobTitle() != null) user.setJobTitle(request.getJobTitle());
        if (request.getCompany() != null) user.setCompany(request.getCompany());
        if (request.getPosition() != null) user.setPosition(request.getPosition());
        if (request.getBio() != null) user.setBio(request.getBio());

        return userRepository.save(user);
    }

    @Transactional
    public String uploadProfilePicture(String email, MultipartFile file) {
        User user = userRepository.findByEmailIgnoreCase(email.toLowerCase()).orElse(null);
        if (user == null) {
            throw new RuntimeException("User not found");
        }

        long maxFileSize = 25L * 1024 * 1024; // 25 MB to match service-layer limit
        if (file.getSize() > maxFileSize) {
            throw new IllegalArgumentException("File size exceeds maximum limit of 25MB");
        }

        String contentType = file.getContentType();
        if (contentType == null || !isValidImageType(contentType)) {
            throw new IllegalArgumentException("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed");
        }

        try {
            // Delete old profile picture key from S3 if it exists
            String oldKey = user.getProfilePicUrl();
            if (oldKey != null && !oldKey.isEmpty()) {
                deleteProfilePictureByKey(extractKeyFromStoredValue(oldKey));
            }

            String originalFilename = file.getOriginalFilename();
            String fileExtension = originalFilename != null ? originalFilename.substring(originalFilename.lastIndexOf(".")) : ".jpg";
            String uniqueFileName = UUID.randomUUID().toString() + fileExtension;

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(profileBucket)
                    .key(uniqueFileName)
                    .contentType(contentType)
                    .build();

            s3Client.putObject(putObjectRequest,
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

            // Store only the S3 object key — never the full public URL
            user.setProfilePicUrl(uniqueFileName);
            userRepository.save(user);

            return uniqueFileName;

        } catch (Exception e) {
            throw new RuntimeException("Could not store the file in S3. Error: " + e.getMessage());
        }
    }

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
        if (stored == null || stored.isEmpty()) return stored;
        if (stored.startsWith("http://") || stored.startsWith("https://")) {
            return stored.substring(stored.lastIndexOf("/") + 1);
        }
        return stored;
    }

    private void deleteProfilePictureByKey(String key) {
        if (key == null || key.isEmpty()) return;
        try {
            DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                    .bucket(profileBucket)
                    .key(key)
                    .build();
            s3Client.deleteObject(deleteObjectRequest);
        } catch (Exception e) {
            logger.warn("Failed to delete old profile picture from S3 (key={}): {}", key, e.getMessage());
        }
    }

    /**
     * Generates a presigned S3 URL valid for 60 minutes.
     * Accepts either a raw S3 object key or a legacy full S3 URL for backward compatibility.
     * Returns null/empty for null/empty input. Results are cached for 55 minutes.
     */
    public String generatePresignedUrl(String stored) {
        if (stored == null || stored.isEmpty()) {
            return stored;
        }

        String key = extractKeyFromStoredValue(stored);

        // Check cache first
        Object[] cached = presignedUrlCache.get(key);
        if (cached != null) {
            Instant expiry = (Instant) cached[1];
            if (Instant.now().isBefore(expiry)) {
                return (String) cached[0];
            }
            presignedUrlCache.remove(key);
        }

        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(profileBucket)
                    .key(key)
                    .build();

            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(60))
                    .getObjectRequest(getObjectRequest)
                    .build();

            String url = s3Presigner.presignGetObject(presignRequest).url().toString();
            presignedUrlCache.put(key, new Object[]{url, Instant.now().plus(PRESIGN_TTL)});
            return url;
        } catch (Exception e) {
            logger.error("Failed to generate presigned URL for key={}: {}", key, e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unused")
    private String generateSecureToken() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}


