package com.planora.backend.service;

import com.planora.backend.dto.LoginResponse;
import com.planora.backend.dto.UpdateProfileRequest;
import com.planora.backend.model.User;
import com.planora.backend.model.VerificationToken;
import com.planora.backend.repository.TokenRepository;
import com.planora.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

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

    @InjectMocks
    private UserService userService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setEmail("test@example.com");
        testUser.setPassword("password123");
        testUser.setUsername("testuser");
    }

    @Test
    void testRegister_NewUser() {
        when(userRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.empty());

        String result = userService.register(testUser);

        assertEquals("OTP send successfully", result);
        verify(userRepository).save(any(User.class));
        verify(tokenRepository).save(any(VerificationToken.class));
        verify(emailService).sendVerificationEmail(eq("test@example.com"), anyString());
    }

    @Test
    void testRegister_ExistingUnverifiedUser() {
        testUser.setVerified(false);
        when(userRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));

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
        when(userRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));

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

        when(userRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));
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

        when(userRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));
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

        when(userRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));
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

        when(userRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));
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
        when(userRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));
        when(jwtService.generateToken(anyString(), anyString())).thenReturn("mock-access-token");
        when(jwtService.generateRefreshToken(anyString())).thenReturn("mock-refresh-token");

        LoginResponse result = userService.loginUser(testUser);

        assertTrue(result.isSuccess());
        assertEquals("mock-access-token", result.getToken());
        assertEquals("mock-refresh-token", result.getRefreshToken());
        assertEquals("Login successful", result.getMessage());
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
        token.setToken("999999");
        token.setExpiry(Instant.now().plusSeconds(600));
        token.setUsed(false);
        token.setTokenType(VerificationToken.TokenType.VERIFICATION); // wrong type

        when(tokenRepository.findByToken("999999")).thenReturn(token);

        boolean result = userService.resetPassword("999999", "newPassword123");

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

        when(userRepository.findByEmailIgnoreCase("test@example.com")).thenReturn(Optional.of(testUser));
        when(userRepository.save(testUser)).thenReturn(testUser);

        User updated = userService.updateUserProfile("test@example.com", request);

        assertFalse(updated.isNotifyDueDateReminders());
        verify(userRepository).save(testUser);
    }
}
