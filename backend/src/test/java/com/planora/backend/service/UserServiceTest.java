package com.planora.backend.service;

import com.planora.backend.dto.LoginResponse;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
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
        // Arrange
        when(userRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.empty());

        // Act
        String result = userService.register(testUser);

        // Assert
        assertEquals("OTP send successfully", result);
        verify(userRepository).save(any(User.class));
        verify(tokenRepository).save(any(VerificationToken.class));
        verify(emailService).sendVerificationEmail(eq("test@example.com"), anyString());
    }

    @Test
    void testRegister_ExistingUnverifiedUser() {
        // Arrange
        testUser.setVerified(false);
        when(userRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));

        // Act
        String result = userService.register(testUser);

        // Assert
        assertEquals("OTP send successfully", result);
        verify(tokenRepository).deleteByUser(testUser);
        verify(tokenRepository).save(any(VerificationToken.class));
        verify(emailService).sendVerificationEmail(eq("test@example.com"), anyString());
    }

    @Test
    void testVerifyToken_Success() {
        // Arrange
        String otp = "123456";
        VerificationToken token = new VerificationToken();
        token.setToken(otp);
        token.setExpiry(Instant.now().plusSeconds(600));
        token.setUsed(false);

        when(userRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));
        when(tokenRepository.findByUser(any())).thenReturn(token);

        // Act
        boolean result = userService.verifyToken("test@example.com", otp);

        // Assert
        assertTrue(result);
        assertTrue(testUser.isVerified());
        assertTrue(token.isUsed());
        verify(userRepository).save(testUser);
        verify(tokenRepository).save(token);
    }

    @Test
    void testVerifyToken_InvalidOtp() {
        // Arrange
        String correctOtp = "123456";
        String wrongOtp = "000000";
        VerificationToken token = new VerificationToken();
        token.setToken(correctOtp);
        token.setExpiry(Instant.now().plusSeconds(600));
        token.setAttempts(0);

        when(userRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));
        when(tokenRepository.findByUser(any())).thenReturn(token);

        // Act
        boolean result = userService.verifyToken("test@example.com", wrongOtp);

        // Assert
        assertFalse(result);
        assertEquals(1, token.getAttempts());
        verify(tokenRepository).save(token);
    }

    @Test
    void testLoginUser_Success() {
        // Arrange
        Authentication authentication = mock(Authentication.class);
        when(authentication.isAuthenticated()).thenReturn(true);
        when(authenticationManager.authenticate(any())).thenReturn(authentication);
        when(userRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.of(testUser));
        when(jwtService.generateToken(anyString(), anyString())).thenReturn("mock-jwt-token");

        // Act
        LoginResponse result = userService.loginUser(testUser);

        // Assert
        assertTrue(result.isSuccess());
        assertEquals("mock-jwt-token", result.getToken());
        assertEquals("Login successful", result.getMessage());
    }
}
