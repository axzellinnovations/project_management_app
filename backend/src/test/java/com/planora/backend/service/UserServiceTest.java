package com.planora.backend.service;

import com.planora.backend.dto.LoginResponse;
import com.planora.backend.dto.UpdateProfileRequest;
import com.planora.backend.exception.ProfilePhotoStorageException;
import com.planora.backend.model.User;
import com.planora.backend.model.VerificationToken;
import com.planora.backend.repository.TokenRepository;
import com.planora.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.Authentication;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import org.mockito.ArgumentCaptor;

@ExtendWith(MockitoExtension.class)
public class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private TokenRepository tokenRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JWTService jwtService;

    @Mock
    private S3Client s3Client;

    @Mock
    private S3Presigner s3Presigner;

    @Mock
    private StringRedisTemplate stringRedisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private UserService userService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setEmail("test@example.com");
        testUser.setPassword("Test@1234");
        testUser.setUsername("testuser");
        lenient().when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        ReflectionTestUtils.setField(userService, "profileBucket", "profile-bucket");
    }

    @Test
    void testRegister_NewUser() {
        when(userRepository.findFirstByEmailIgnoreCase(any())).thenReturn(Optional.empty());

        String result = userService.register(testUser);

        assertEquals("OTP send successfully", result);
        verify(userRepository).save(any(User.class));
        verify(tokenRepository).save(any(VerificationToken.class));
        verify(emailService).sendVerificationEmail(eq("test@example.com"), anyString());
        ArgumentCaptor<VerificationToken> tokenCaptor = ArgumentCaptor.forClass(VerificationToken.class);
        verify(tokenRepository).save(tokenCaptor.capture());
        assertTrue(tokenCaptor.getValue().getToken().startsWith("v2:"));
        assertFalse(tokenCaptor.getValue().getToken().matches("v2:[0-9]{6}"));
    }

    @Test
    void testRegister_ExistingUnverifiedUser() {
        testUser.setVerified(false);
        when(userRepository.findFirstByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));

        String result = userService.register(testUser);

        assertEquals("OTP send successfully", result);
        verify(tokenRepository).deleteByUser(testUser);
        verify(tokenRepository).save(any(VerificationToken.class));
        verify(emailService).sendVerificationEmail(eq("test@example.com"), anyString());
    }

    // (a) Register with duplicate verified email returns the "already verified" message
    @Test
    void testRegister_ExistingVerifiedUser_ReturnsAlreadyVerifiedMessage() {
        testUser.setVerified(true);
        when(userRepository.findFirstByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));

        String result = userService.register(testUser);

        assertEquals("User already verified. Please login.", result);
        verify(userRepository, never()).save(any());
        verify(emailService, never()).sendVerificationEmail(anyString(), anyString());
    }

    @Test
    void testVerifyToken_Success() {
        String otp = "123456";
        VerificationToken token = new VerificationToken();
        token.setToken(otp);
        token.setExpiry(Instant.now().plusSeconds(600));
        token.setUsed(false);
        token.setTokenType(VerificationToken.TokenType.VERIFICATION);

        when(userRepository.findFirstByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));
        when(tokenRepository.findByUserAndTokenType(any(), eq(VerificationToken.TokenType.VERIFICATION))).thenReturn(token);

        boolean result = userService.verifyToken("test@example.com", otp);

        assertTrue(result);
        assertTrue(testUser.isVerified());
        assertTrue(token.isUsed());
        verify(userRepository).save(testUser);
        verify(tokenRepository).save(token);
    }

    @Test
    void testVerifyToken_InvalidOtp() {
        String correctOtp = "123456";
        String wrongOtp = "000000";
        VerificationToken token = new VerificationToken();
        token.setToken(correctOtp);
        token.setExpiry(Instant.now().plusSeconds(600));
        token.setAttempts(0);
        token.setTokenType(VerificationToken.TokenType.VERIFICATION);

        when(userRepository.findFirstByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));
        when(tokenRepository.findByUserAndTokenType(any(), eq(VerificationToken.TokenType.VERIFICATION))).thenReturn(token);

        boolean result = userService.verifyToken("test@example.com", wrongOtp);

        assertFalse(result);
        assertEquals(1, token.getAttempts());
        verify(tokenRepository).save(token);
    }

    // (b) verifyToken with expired OTP returns false
    @Test
    void testVerifyToken_ExpiredOtp_ReturnsFalse() {
        VerificationToken token = new VerificationToken();
        token.setToken("123456");
        token.setExpiry(Instant.now().minusSeconds(1)); // already expired
        token.setUsed(false);
        token.setTokenType(VerificationToken.TokenType.VERIFICATION);

        when(userRepository.findFirstByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));
        when(tokenRepository.findByUserAndTokenType(any(), eq(VerificationToken.TokenType.VERIFICATION))).thenReturn(token);

        boolean result = userService.verifyToken("test@example.com", "123456");

        assertFalse(result);
    }

    // (c) verifyToken with 5+ failed attempts returns false
    @Test
    void testVerifyToken_MaxAttemptsExceeded_ReturnsFalse() {
        VerificationToken token = new VerificationToken();
        token.setToken("123456");
        token.setExpiry(Instant.now().plusSeconds(600));
        token.setAttempts(5);
        token.setUsed(false);
        token.setTokenType(VerificationToken.TokenType.VERIFICATION);

        when(userRepository.findFirstByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));
        when(tokenRepository.findByUserAndTokenType(any(), eq(VerificationToken.TokenType.VERIFICATION))).thenReturn(token);

        boolean result = userService.verifyToken("test@example.com", "123456");

        assertFalse(result);
        verify(tokenRepository, never()).save(any()); // no attempt increment
    }

    @Test
    void testLoginUser_Success() {
        Authentication authentication = mock(Authentication.class);
        when(authentication.isAuthenticated()).thenReturn(true);
        when(authenticationManager.authenticate(any())).thenReturn(authentication);
        when(userRepository.findFirstByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));
        when(jwtService.generateToken(anyString(), anyString(), any())).thenReturn("mock-access-token");
        when(jwtService.generateRefreshToken(anyString())).thenReturn("mock-refresh-token");

        LoginResponse result = userService.loginUser(testUser);

        assertTrue(result.isSuccess());
        assertEquals("mock-access-token", result.getToken());
        assertEquals("mock-refresh-token", result.getRefreshToken());
        assertEquals("Login successful", result.getMessage());
        verify(stringRedisTemplate).delete("login-attempt:test@example.com");
    }

    // (d) loginUser with unverified account returns UNVERIFIED_EMAIL errorCode
    @Test
    void testLoginUser_UnverifiedAccount_ReturnsUnverifiedEmailErrorCode() {
        when(authenticationManager.authenticate(any()))
                .thenThrow(new DisabledException("Email is not verified"));

        LoginResponse result = userService.loginUser(testUser);

        assertFalse(result.isSuccess());
        assertEquals("UNVERIFIED_EMAIL", result.getErrorCode());
    }

    // (e) forgotPassword with unknown email returns safe message without exposing user existence
    @Test
    void testForgotPassword_UnknownEmail_ReturnsSafeMessage() {
        when(userRepository.findByEmail(any())).thenReturn(null);

        String result = userService.forgotPassword("unknown@example.com");

        assertEquals("If that email exists, an OTP has been sent.", result);
        verify(emailService, never()).sendPasswordResetRequest(anyString(), anyString());
    }

    // (f) resetPassword with wrong token type (VERIFICATION) returns false
    @Test
    void testResetPassword_WrongTokenType_ReturnsFalse() {
        VerificationToken token = new VerificationToken();
        token.setToken(hashToken("999999"));
        token.setExpiry(Instant.now().plusSeconds(600));
        token.setUsed(false);
        token.setTokenType(VerificationToken.TokenType.VERIFICATION); // wrong type

        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));
        when(tokenRepository.findByUserAndTokenType(testUser, VerificationToken.TokenType.PASSWORD_RESET)).thenReturn(token);

        boolean result = userService.resetPassword("test@example.com", "999999", "NewPassword1!");

        assertFalse(result);
    }

    // BUG-1: UserPrincipal.isEnabled() must reflect the user's verified status
    @Test
    void testUserPrincipal_IsEnabled_ReflectsVerifiedStatus() {
        com.planora.backend.model.UserPrincipal principal =
                new com.planora.backend.model.UserPrincipal(testUser);

        testUser.setVerified(false);
        assertFalse(principal.isEnabled(), "isEnabled() should be false for unverified users");

        testUser.setVerified(true);
        assertTrue(principal.isEnabled(), "isEnabled() should be true for verified users");
    }

    // BUG-2: generatePresignedUrlForUser returns null for a user with no profile picture
    @Test
    void testGeneratePresignedUrlForUser_NullProfilePic_ReturnsNull() {
        testUser.setProfilePicUrl(null);
        when(userRepository.findById(1L)).thenReturn(java.util.Optional.of(testUser));

        String result = userService.generatePresignedUrlForUser(1L);

        assertNull(result);
        verify(s3Presigner, never()).presignGetObject(
                any(software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest.class));
    }

    // BUG-2: generatePresignedUrlForUser returns null for a non-existent user
    @Test
    void testGeneratePresignedUrlForUser_NonExistentUser_ReturnsNull() {
        when(userRepository.findById(999L)).thenReturn(java.util.Optional.empty());

        String result = userService.generatePresignedUrlForUser(999L);

        assertNull(result);
    }

    @Test
    void testUpdateUserProfile_UpdatesDueDateReminderPreference() {
        testUser.setNotifyDueDateReminders(true);
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setNotifyDueDateReminders(false);

        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));
        when(userRepository.save(testUser)).thenReturn(testUser);

        User updated = userService.updateUserProfile("test@example.com", request);

        assertFalse(updated.isNotifyDueDateReminders());
        verify(userRepository).save(testUser);
    }

    @Test
    void testLoginUser_InvalidCredentials_ReturnsInvalidCredentialsErrorCode() {
        when(authenticationManager.authenticate(any()))
                .thenThrow(new org.springframework.security.authentication.BadCredentialsException("Bad credentials"));

        LoginResponse result = userService.loginUser(testUser);

        assertFalse(result.isSuccess());
        assertEquals("INVALID_CREDENTIALS", result.getErrorCode());
    }

    @Test
    void testLoginUser_LocksAfterFiveInvalidCredentialAttempts() {
        Map<String, String> redisValues = new HashMap<>();
        when(valueOperations.get(anyString())).thenAnswer(invocation -> redisValues.get(invocation.getArgument(0)));
        doAnswer(invocation -> {
            redisValues.put(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(valueOperations).set(anyString(), anyString(), any(Duration.class));
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        for (int i = 0; i < 5; i++) {
            LoginResponse failedLogin = userService.loginUser(testUser);
            assertFalse(failedLogin.isSuccess());
            assertEquals("INVALID_CREDENTIALS", failedLogin.getErrorCode());
        }

        LoginResponse lockedLogin = userService.loginUser(testUser);

        assertFalse(lockedLogin.isSuccess());
        assertEquals("ACCOUNT_LOCKED", lockedLogin.getErrorCode());
        verify(authenticationManager, times(5)).authenticate(any());
    }

    @Test
    void testLoginUser_RedisFailureDuringLockoutCheck_FailsOpenAndAllowsSuccessfulLogin() {
        Authentication authentication = mock(Authentication.class);
        when(authentication.isAuthenticated()).thenReturn(true);
        when(stringRedisTemplate.opsForValue()).thenThrow(new RuntimeException("Redis unavailable"));
        when(authenticationManager.authenticate(any())).thenReturn(authentication);
        when(userRepository.findFirstByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));
        when(jwtService.generateToken(anyString(), anyString(), any())).thenReturn("mock-access-token");
        when(jwtService.generateRefreshToken(anyString())).thenReturn("mock-refresh-token");

        LoginResponse result = userService.loginUser(testUser);

        assertTrue(result.isSuccess());
        assertEquals("mock-access-token", result.getToken());
    }

    @Test
    void testResendOtp_UnverifiedUser_SendsNewOtp() {
        testUser.setVerified(false);
        when(userRepository.findByEmail("test@example.com")).thenReturn(testUser);

        String result = userService.resendOtp("test@example.com");

        assertEquals("New OTP send to your email.", result);
        verify(tokenRepository).deleteByUser(testUser);
        verify(tokenRepository).save(any(VerificationToken.class));
        verify(emailService).sendVerificationEmail(eq("test@example.com"), anyString());
    }

    @Test
    void testResendOtp_UnknownUser_ReturnsNotFoundMessage() {
        when(userRepository.findByEmail(anyString())).thenReturn(null);

        String result = userService.resendOtp("ghost@example.com");

        assertEquals("User is not found", result);
        verify(emailService, never()).sendVerificationEmail(anyString(), anyString());
    }

    @Test
    void testResendOtp_AlreadyVerifiedUser_ReturnsAlreadyVerifiedMessage() {
        testUser.setVerified(true);
        when(userRepository.findByEmail("test@example.com")).thenReturn(testUser);

        String result = userService.resendOtp("test@example.com");

        assertEquals("User already verified.", result);
        verify(emailService, never()).sendVerificationEmail(anyString(), anyString());
    }

    @Test
    void testForgotPassword_KnownEmail_SendsPasswordResetOtp() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(testUser);
        when(tokenRepository.findByUserAndTokenType(testUser, VerificationToken.TokenType.PASSWORD_RESET)).thenReturn(null);

        String result = userService.forgotPassword("test@example.com");

        assertEquals("If that email exists, an OTP has been sent.", result);
        verify(tokenRepository).save(any(VerificationToken.class));
        verify(emailService).sendPasswordResetRequest(eq("test@example.com"), anyString());
    }

    @Test
    void testForgotPassword_ExistingToken_DeletesOldTokenBeforeIssuingNew() {
        VerificationToken existingToken = new VerificationToken();
        existingToken.setToken("old-otp");
        existingToken.setTokenType(VerificationToken.TokenType.PASSWORD_RESET);

        when(userRepository.findByEmail("test@example.com")).thenReturn(testUser);
        when(tokenRepository.findByUserAndTokenType(testUser, VerificationToken.TokenType.PASSWORD_RESET)).thenReturn(existingToken);

        userService.forgotPassword("test@example.com");

        verify(tokenRepository).delete(existingToken);
        verify(tokenRepository).save(any(VerificationToken.class));
    }

    @Test
    void testResetPassword_ValidToken_UpdatesPasswordAndReturnsTrue() {
        VerificationToken token = new VerificationToken();
        token.setToken(hashToken("valid-otp"));
        token.setExpiry(Instant.now().plusSeconds(600));
        token.setUsed(false);
        token.setTokenType(VerificationToken.TokenType.PASSWORD_RESET);
        token.setUser(testUser);

        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));
        when(tokenRepository.findByUserAndTokenType(testUser, VerificationToken.TokenType.PASSWORD_RESET)).thenReturn(token);

        boolean result = userService.resetPassword("test@example.com", "valid-otp", "NewSecure@1");

        assertTrue(result);
        assertTrue(token.isUsed());
        assertNotNull(token.getUsedAt());
        verify(userRepository).save(testUser);
        verify(tokenRepository).save(token);
    }

    @Test
    void testResetPassword_ExpiredToken_ReturnsFalse() {
        VerificationToken token = new VerificationToken();
        token.setToken(hashToken("expired-otp"));
        token.setExpiry(Instant.now().minusSeconds(1));
        token.setUsed(false);
        token.setTokenType(VerificationToken.TokenType.PASSWORD_RESET);

        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));
        when(tokenRepository.findByUserAndTokenType(testUser, VerificationToken.TokenType.PASSWORD_RESET)).thenReturn(token);

        boolean result = userService.resetPassword("test@example.com", "expired-otp", "NewPassword1!");

        assertFalse(result);
        verify(userRepository, never()).save(any());
    }

    @Test
    void testResetPassword_UsedToken_ReturnsFalse() {
        VerificationToken token = new VerificationToken();
        token.setToken(hashToken("used-otp"));
        token.setExpiry(Instant.now().plusSeconds(600));
        token.setUsed(true);
        token.setTokenType(VerificationToken.TokenType.PASSWORD_RESET);

        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));
        when(tokenRepository.findByUserAndTokenType(testUser, VerificationToken.TokenType.PASSWORD_RESET)).thenReturn(token);

        boolean result = userService.resetPassword("test@example.com", "used-otp", "NewPassword1!");

        assertFalse(result);
        verify(userRepository, never()).save(any());
    }

    @Test
    void testResetPassword_WrongEmail_ReturnsFalse() {
        when(userRepository.findFirstByEmailIgnoreCase("wrong@example.com")).thenReturn(Optional.empty());

        boolean result = userService.resetPassword("wrong@example.com", "valid-otp", "NewSecure@1");

        assertFalse(result);
        verify(tokenRepository, never()).save(any());
    }

    @Test
    void testResetPassword_WrongOtp_IncrementsAttemptsAndReturnsFalse() {
        VerificationToken token = new VerificationToken();
        token.setToken(hashToken("valid-otp"));
        token.setExpiry(Instant.now().plusSeconds(600));
        token.setUsed(false);
        token.setTokenType(VerificationToken.TokenType.PASSWORD_RESET);
        token.setAttempts(0);

        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));
        when(tokenRepository.findByUserAndTokenType(testUser, VerificationToken.TokenType.PASSWORD_RESET)).thenReturn(token);

        boolean result = userService.resetPassword("test@example.com", "wrong-otp", "NewSecure@1");

        assertFalse(result);
        assertEquals(1, token.getAttempts());
        verify(tokenRepository).save(token);
        verify(userRepository, never()).save(any());
    }

    @Test
    void testResetPassword_WrongOtpFiveTimes_InvalidatesToken() {
        VerificationToken token = new VerificationToken();
        token.setToken(hashToken("valid-otp"));
        token.setExpiry(Instant.now().plusSeconds(600));
        token.setUsed(false);
        token.setTokenType(VerificationToken.TokenType.PASSWORD_RESET);
        token.setAttempts(4); // 4 attempts already made

        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));
        when(tokenRepository.findByUserAndTokenType(testUser, VerificationToken.TokenType.PASSWORD_RESET)).thenReturn(token);

        boolean result = userService.resetPassword("test@example.com", "wrong-otp", "NewSecure@1");

        assertFalse(result);
        assertEquals(5, token.getAttempts());
        assertTrue(token.isUsed());
        verify(tokenRepository).save(token);
        verify(userRepository, never()).save(any());
    }

    @Test
    void testResetPassword_MaxAttemptsExceeded_ReturnsFalse() {
        VerificationToken token = new VerificationToken();
        token.setToken(hashToken("valid-otp"));
        token.setExpiry(Instant.now().plusSeconds(600));
        token.setUsed(false);
        token.setTokenType(VerificationToken.TokenType.PASSWORD_RESET);
        token.setAttempts(5);

        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));
        when(tokenRepository.findByUserAndTokenType(testUser, VerificationToken.TokenType.PASSWORD_RESET)).thenReturn(token);

        boolean result = userService.resetPassword("test@example.com", "valid-otp", "NewSecure@1");

        assertFalse(result);
        verify(tokenRepository, never()).save(any());
    }

    @Test
    void testRefreshTokens_ValidToken_ReturnsNewTokenPair() {
        testUser.setVerified(true);

        VerificationToken storedToken = new VerificationToken();
        storedToken.setUser(testUser);
        storedToken.setToken("old-jti");
        storedToken.setExpiry(Instant.now().plusSeconds(600));
        storedToken.setUsed(false);
        storedToken.setTokenType(VerificationToken.TokenType.REFRESH_TOKEN);

        when(jwtService.validateRefreshToken("old-refresh")).thenReturn("test@example.com");
        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));
        when(jwtService.extractJti("old-refresh")).thenReturn("old-jti");
        when(jwtService.extractJti("new-refresh")).thenReturn("new-jti");
        when(tokenRepository.findByTokenOrPreviousTokenAndTokenTypeForUpdate("old-jti", VerificationToken.TokenType.REFRESH_TOKEN))
                .thenReturn(Optional.of(storedToken));
        when(jwtService.generateToken(anyString(), anyString(), any())).thenReturn("new-access");
        when(jwtService.generateRefreshToken(anyString())).thenReturn("new-refresh");

        LoginResponse result = userService.refreshTokens("old-refresh");

        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertEquals("new-access", result.getToken());
        assertEquals("new-refresh", result.getRefreshToken());
        verify(tokenRepository).save(storedToken);
        assertEquals("new-jti", storedToken.getToken());
        assertEquals("old-jti", storedToken.getPreviousToken());
        assertNotNull(storedToken.getPreviousTokenExpiresAt());
    }

    @Test
    void testRefreshTokens_InvalidToken_ReturnsNull() {
        when(jwtService.validateRefreshToken(anyString())).thenThrow(new RuntimeException("Invalid token"));

        LoginResponse result = userService.refreshTokens("bad-token");

        assertNull(result);
    }

    @Test
    void testRefreshTokens_JtiMismatch_ReturnsNullWithoutRevokingCurrentToken() {
        testUser.setVerified(true);

        when(jwtService.validateRefreshToken("tampered-token")).thenReturn("test@example.com");
        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));
        when(jwtService.extractJti("tampered-token")).thenReturn("attacker-jti");
        when(tokenRepository.findByTokenOrPreviousTokenAndTokenTypeForUpdate("attacker-jti", VerificationToken.TokenType.REFRESH_TOKEN))
                .thenReturn(Optional.empty());

        LoginResponse result = userService.refreshTokens("tampered-token");

        assertNull(result);
        verify(tokenRepository, never()).delete(any());
    }

    @Test
    void testRefreshTokens_RecentPreviousJti_RotatesTokenPair() {
        testUser.setVerified(true);

        VerificationToken storedToken = new VerificationToken();
        storedToken.setUser(testUser);
        storedToken.setToken("current-jti");
        storedToken.setPreviousToken("old-jti");
        storedToken.setPreviousTokenExpiresAt(Instant.now().plusSeconds(5));
        storedToken.setExpiry(Instant.now().plusSeconds(600));
        storedToken.setUsed(false);
        storedToken.setTokenType(VerificationToken.TokenType.REFRESH_TOKEN);

        when(jwtService.validateRefreshToken("old-refresh")).thenReturn("test@example.com");
        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));
        when(jwtService.extractJti("old-refresh")).thenReturn("old-jti");
        when(jwtService.extractJti("new-refresh")).thenReturn("new-jti");
        when(tokenRepository.findByTokenOrPreviousTokenAndTokenTypeForUpdate("old-jti", VerificationToken.TokenType.REFRESH_TOKEN))
                .thenReturn(Optional.of(storedToken));
        when(jwtService.generateToken(anyString(), anyString(), any())).thenReturn("new-access");
        when(jwtService.generateRefreshToken(anyString())).thenReturn("new-refresh");

        LoginResponse result = userService.refreshTokens("old-refresh");

        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertEquals("new-access", result.getToken());
        assertEquals("new-refresh", result.getRefreshToken());
        verify(tokenRepository).save(argThat(token ->
                "new-jti".equals(token.getToken())
                        && "old-jti".equals(token.getPreviousToken())));
    }

    @Test
    void testRefreshTokens_UsedToken_ReturnsNull() {
        testUser.setVerified(true);

        VerificationToken storedToken = new VerificationToken();
        storedToken.setUser(testUser);
        storedToken.setToken("jti-123");
        storedToken.setExpiry(Instant.now().plusSeconds(600));
        storedToken.setUsed(true);
        storedToken.setTokenType(VerificationToken.TokenType.REFRESH_TOKEN);

        when(jwtService.validateRefreshToken("used-token")).thenReturn("test@example.com");
        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));
        when(jwtService.extractJti("used-token")).thenReturn("jti-123");
        when(tokenRepository.findByTokenOrPreviousTokenAndTokenTypeForUpdate("jti-123", VerificationToken.TokenType.REFRESH_TOKEN))
                .thenReturn(Optional.of(storedToken));

        LoginResponse result = userService.refreshTokens("used-token");

        assertNull(result);
    }

    @Test
    void testRevokeRefreshToken_WithToken_DeletesSpecificSession() {
        when(jwtService.extractJti("refresh-token-1")).thenReturn("jti-1");
        VerificationToken storedToken = new VerificationToken();
        storedToken.setToken("jti-1");
        when(tokenRepository.findByTokenOrPreviousTokenAndTokenTypeForUpdate("jti-1", VerificationToken.TokenType.REFRESH_TOKEN))
                .thenReturn(Optional.of(storedToken));

        userService.revokeRefreshToken("test@example.com", "refresh-token-1");

        verify(tokenRepository).delete(storedToken);
    }

    @Test
    void testRevokeRefreshToken_DeletesRefreshTokenRecords() {
        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));

        userService.revokeRefreshToken("test@example.com");

        verify(tokenRepository).deleteByUserAndTokenType(testUser, VerificationToken.TokenType.REFRESH_TOKEN);
    }

    @Test
    void testRevokeRefreshToken_NoUser_DoesNothing() {
        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.empty());

        userService.revokeRefreshToken("test@example.com");

        verify(tokenRepository, never()).delete(any());
        verify(tokenRepository, never()).deleteByUserAndTokenType(any(), any());
    }

    @Test
    void testGetUserByEmail_ValidEmail_ReturnsUser() {
        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));

        User result = userService.getUserByEmail("test@example.com");

        assertEquals(testUser, result);
    }

    @Test
    void testGetUserByEmail_BlankEmail_ThrowsException() {
        assertThrows(RuntimeException.class, () -> userService.getUserByEmail(""));
        assertThrows(RuntimeException.class, () -> userService.getUserByEmail(null));
    }

    @Test
    void testGetUserByEmail_NotFound_ThrowsException() {
        when(userRepository.findFirstByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> userService.getUserByEmail("missing@example.com"));
    }

    @Test
    void testUpdateUserDetails_ValidName_UpdatesFullName() {
        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));
        when(userRepository.save(testUser)).thenReturn(testUser);

        userService.updateUserDetails("test@example.com", "New Full Name");

        assertEquals("New Full Name", testUser.getFullName());
        verify(userRepository).save(testUser);
    }

    @Test
    void testUpdateUserDetails_EmptyName_ThrowsIllegalArgumentException() {
        when(userRepository.findFirstByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));

        assertThrows(IllegalArgumentException.class,
                () -> userService.updateUserDetails("test@example.com", ""));
        verify(userRepository, never()).save(any());
    }

    @Test
    void testGetAllUserDTOs_ExcludesSpecifiedEmail() {
        User other = new User();
        other.setEmail("other@example.com");
        other.setUsername("other");

        when(userRepository.findAll()).thenReturn(List.of(testUser, other));

        List<com.planora.backend.dto.UserResponseDTO> result =
                userService.getAllUserDTOs("test@example.com");

        assertEquals(1, result.size());
        assertEquals("other@example.com", result.get(0).getEmail());
    }

    @Test
    void testGetAllUserDTOs_NullExcludeEmail_ReturnsAll() {
        when(userRepository.findAll()).thenReturn(List.of(testUser));

        List<com.planora.backend.dto.UserResponseDTO> result =
                userService.getAllUserDTOs(null);

        assertEquals(1, result.size());
    }

    @Test
    void testIsValidImageType_ValidMimeTypes_ReturnsTrue() {
        assertTrue(userService.isValidImageType("image/jpeg"));
        assertTrue(userService.isValidImageType("image/png"));
        assertTrue(userService.isValidImageType("image/gif"));
        assertTrue(userService.isValidImageType("image/webp"));
    }

    @Test
    void testIsValidImageType_InvalidMimeType_ReturnsFalse() {
        assertFalse(userService.isValidImageType("application/pdf"));
        assertFalse(userService.isValidImageType("text/html"));
        assertFalse(userService.isValidImageType("image/svg+xml"));
    }

    @Test
    void testGeneratePresignedUrl_NullInput_ReturnsNull() {
        assertNull(userService.generatePresignedUrl(null));
    }

    @Test
    void uploadProfilePicture_evictsProfileAndPhotoUrlCaches() throws Exception {
        Caching caching = UserService.class
                .getMethod("uploadProfilePicture", String.class, org.springframework.web.multipart.MultipartFile.class)
                .getAnnotation(Caching.class);

        assertNotNull(caching);
        assertEquals(2, caching.evict().length);
        assertArrayEquals(new String[]{"userProfile"}, caching.evict()[0].value());
        assertEquals("#email", caching.evict()[0].key());
        assertArrayEquals(new String[]{"userPhotoUrls"}, caching.evict()[1].value());
        assertTrue(caching.evict()[1].allEntries());
    }

    @Test
    void uploadProfilePicture_acceptsExtensionlessCameraImage() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar",
                "image/png",
                onePixelPng());
        when(userRepository.findFirstByEmailIgnoreCase("test@example.com"))
                .thenReturn(Optional.of(testUser));
        when(userRepository.saveAndFlush(testUser)).thenReturn(testUser);

        String key = userService.uploadProfilePicture("test@example.com", file);

        assertTrue(key.endsWith(".png"));
        ArgumentCaptor<PutObjectRequest> request = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(request.capture(), any(RequestBody.class));
        assertEquals("profile-bucket", request.getValue().bucket());
        assertEquals(key, request.getValue().key());
        assertEquals(key, testUser.getProfilePicUrl());
    }

    @Test
    void uploadProfilePicture_keepsOldAvatarWhenReplacementUploadFails() {
        testUser.setProfilePicUrl("existing-avatar.png");
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "replacement.png",
                "image/png",
                onePixelPng());
        when(userRepository.findFirstByEmailIgnoreCase("test@example.com"))
                .thenReturn(Optional.of(testUser));
        doThrow(new RuntimeException("S3 unavailable"))
                .when(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));

        assertThrows(
                ProfilePhotoStorageException.class,
                () -> userService.uploadProfilePicture("test@example.com", file));

        assertEquals("existing-avatar.png", testUser.getProfilePicUrl());
        verify(s3Client, never()).deleteObject(any(DeleteObjectRequest.class));
        verify(userRepository, never()).saveAndFlush(any(User.class));
    }

    @Test
    void testGeneratePresignedUrl_ValidKey_ReturnsPresignedUrl() throws Exception {
        software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest presignedResponse =
                mock(software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest.class);
        when(presignedResponse.url()).thenReturn(URI.create("https://s3.example.com/pic.jpg?sig=abc").toURL());
        when(s3Presigner.presignGetObject(
                any(software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest.class)))
                .thenReturn(presignedResponse);

        String result = userService.generatePresignedUrl("profile/pic.jpg");

        assertEquals("https://s3.example.com/pic.jpg?sig=abc", result);
    }

    @Test
    void testGeneratePresignedUrlForUser_WithProfilePic_ReturnsUrl() throws Exception {
        testUser.setProfilePicUrl("user-pic.jpg");
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));

        software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest presignedResponse =
                mock(software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest.class);
        when(presignedResponse.url()).thenReturn(URI.create("https://s3.example.com/user-pic.jpg?sig=xyz").toURL());
        when(s3Presigner.presignGetObject(
                any(software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest.class)))
                .thenReturn(presignedResponse);

        String result = userService.generatePresignedUrlForUser(1L);

        assertEquals("https://s3.example.com/user-pic.jpg?sig=xyz", result);
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
            throw new RuntimeException(e);
        }
    }

    private byte[] onePixelPng() {
        return Base64.getDecoder().decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
    }
}
