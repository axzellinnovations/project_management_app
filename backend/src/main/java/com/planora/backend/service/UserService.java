package com.planora.backend.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Random;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import com.planora.backend.dto.LoginResponse;
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

    private AuthenticationManager authenticationManager;

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    @Value("${aws.s3.profile-bucket}")
    private String profileBucket;

    @Value("${aws.region}")
    private String region;

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
            //save unverified user
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
        verificationToken.setExpiry(Instant.now().plus(java.time.Duration.ofMinutes(10)));
        tokenRepository.save(verificationToken);

        emailService.sendVerificationEmail(user.getEmail(), otp);
        return "OTP send successfully";
    }

    @Transactional
    public boolean verifyToken(String email, String otp) {
        User user = userRepository.findByEmailIgnoreCase(email.toLowerCase()).orElse(null);
        VerificationToken verificationToken = tokenRepository.findByUser(user);

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

    public String verify(User user) {
        Authentication authentication =
                authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(
                        user.getEmail().toLowerCase(),
                        user.getPassword()));

        if (authentication.isAuthenticated()) {
            User authenticatedUser = userRepository.findByEmailIgnoreCase(user.getEmail().toLowerCase()).orElse(null);
            return jwtService.generateToken(user.getEmail(), authenticatedUser.getUsername());
        }

        return "Failed to login";
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
                String token = jwtService.generateToken(user.getEmail(), authenticatedUser.getUsername());
                LoginResponse response = new LoginResponse();
                response.setSuccess(true);
                response.setMessage("Login successful");
                response.setToken(token);
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
        } catch (BadCredentialsException e) {
            LoginResponse response = new LoginResponse();
            response.setSuccess(false);
            response.setMessage("Incorrect username or password");
            response.setErrorCode("INVALID_CREDENTIALS");
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
        verificationToken.setExpiry(Instant.now().plus(java.time.Duration.ofMinutes(10)));
        tokenRepository.save(verificationToken);

        emailService.sendVerificationEmail(email.toLowerCase(), otp);
        return "New OTP send to your email.";
    }

    private String generateSecureToken() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    @Transactional
    public String forgotPassword(String email) {
        User user = userRepository.findByEmail(email.toLowerCase());

        if (user == null)
            return "If that email exists, an OTP has been sent.";

        // Delete existing password reset tokens for this user
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
        verificationToken.setExpiry(Instant.now().plus(java.time.Duration.ofMinutes(10)));
        tokenRepository.save(verificationToken);

        emailService.sendPasswordResetRequest(email.toLowerCase(), otp);
        return "Password reset OTP sent successfully.";
    }

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

    // Deprecated: Use resetPassword(token, newPassword) instead
    @Transactional
    @Deprecated
    public boolean resetPassword(String email, String otp, String newPassword) {
        User user = userRepository.findByEmail(email.toLowerCase());
        VerificationToken verificationToken = tokenRepository.findByUser(user);

        if (verificationToken != null && verificationToken.getToken().equals(otp) && !verificationToken.isExpired()
                && verificationToken.getTokenType() == VerificationToken.TokenType.PASSWORD_RESET) {
            user.setPassword(encoder.encode(newPassword));
            verificationToken.setUsed(true);
            userRepository.save(user);
            tokenRepository.save(verificationToken);
            return true;
        }

        return false;
    }

    public java.util.List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @Transactional
    public User updateUserDetails(String email, String newFullName) {
        User user = userRepository.findByEmailIgnoreCase(email.toLowerCase()).orElse(null);
        if (user == null) {
            throw new RuntimeException("User not found");
        }

        // Only fullName can be updated. Username and email are immutable.
        if (newFullName != null && !newFullName.isEmpty()) {
            user.setFullName(newFullName);
        } else {
            throw new IllegalArgumentException("Full name cannot be empty");
        }

        // Ensure email and username are not modified
        user.setEmail(user.getEmail()); // Defensive: prevent accidental modification
        user.setUsername(user.getUsername()); // Defensive: prevent accidental modification

        return userRepository.save(user);
    }

    @Transactional
    public String uploadProfilePicture(String email, MultipartFile file) {
        User user = userRepository.findByEmailIgnoreCase(email.toLowerCase()).orElse(null);
        if (user == null) {
            throw new RuntimeException("User not found");
        }

        // Validate file size (5MB max)
        long maxFileSize = 5 * 1024 * 1024;
        if (file.getSize() > maxFileSize) {
            throw new IllegalArgumentException("File size exceeds maximum limit of 5MB");
        }

        // Validate file type
        String contentType = file.getContentType();
        if (contentType == null || !isValidImageType(contentType)) {
            throw new IllegalArgumentException("Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed");
        }

        try {
            // Delete old profile picture if it exists
            String oldProfilePicUrl = user.getProfilePicUrl();
            if (oldProfilePicUrl != null && !oldProfilePicUrl.isEmpty()) {
                deleteProfilePictureFile(oldProfilePicUrl);
            }

            // Generate a unique file name
            String originalFilename = file.getOriginalFilename();
            String fileExtension = originalFilename != null ? originalFilename.substring(originalFilename.lastIndexOf(".")) : ".jpg";
            String uniqueFileName = UUID.randomUUID().toString() + fileExtension;

            // Upload to S3
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(profileBucket)
                    .key(uniqueFileName)
                    .contentType(contentType)
                    .build();

            s3Client.putObject(putObjectRequest,
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

            // Construct the public S3 URL
            String fileUrl = String.format("https://%s.s3.%s.amazonaws.com/%s", profileBucket, region, uniqueFileName);

            user.setProfilePicUrl(fileUrl);
            userRepository.save(user);

            return fileUrl;

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

    private void deleteProfilePictureFile(String fileUrl) {
        try {
            // Extract filename (the S3 Object Key) from the full URL
            // e.g., "https://my-bucket.s3.us-east-1.amazonaws.com/uuid.jpg" -> "uuid.jpg"
            String key = fileUrl.substring(fileUrl.lastIndexOf("/") + 1);

            DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                    .bucket(profileBucket)
                    .key(key)
                    .build();

            s3Client.deleteObject(deleteObjectRequest);
        } catch (Exception e) {
            // Log the error but don't fail the upload if old file cleanup fails
            logger.warn("Failed to delete old profile picture from S3: {}", e.getMessage());
        }
    }

    public String generatePresignedUrl(String fileUrl) {
        if (fileUrl == null || fileUrl.isEmpty() || !fileUrl.contains("amazonaws.com")) {
            return fileUrl; // Return as-is if it's empty or a local default image
        }

        try {
            // Extract the key (e.g., uuid.jpg) from the full database URL
            String key = fileUrl.substring(fileUrl.lastIndexOf("/") + 1);

            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(profileBucket)
                    .key(key)
                    .build();

            // Create a temporary URL valid for 60 minutes
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(60))
                    .getObjectRequest(getObjectRequest)
                    .build();

            return s3Presigner.presignGetObject(presignRequest).url().toString();
        } catch (Exception e) {
            logger.error("Failed to generate presigned URL", e);
            return null;
        }
    }
}

