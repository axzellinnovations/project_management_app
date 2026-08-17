package com.planora.backend.controller;

import com.planora.backend.annotation.WithMockUserPrincipal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.LoginResponse;
import com.planora.backend.dto.OtpRequest;
import com.planora.backend.dto.ResetPasswordRequest;
import com.planora.backend.dto.UserResponseDTO;
import com.planora.backend.dto.VerifyRequest;
import com.planora.backend.model.User;
import com.planora.backend.service.UserService;
import com.planora.backend.service.JWTService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import org.springframework.test.context.TestPropertySource;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
@TestPropertySource(properties = {
        "app.cookie.secure=true",
        "app.cookie.samesite=None"
})
public class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @MockBean
    private JWTService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setEmail("test@example.com");
        testUser.setPassword("Test@1234");
        testUser.setUsername("testuser");
    }

    @Test
    @WithMockUserPrincipal
    void testRegister_Success() throws Exception {
        when(userService.register(any())).thenReturn("OTP send successfully");

        mockMvc.perform(post("/api/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testUser)))
                .andExpect(status().isOk())
                .andExpect(content().string("OTP send successfully"));
    }

    // (a) Register with already-verified email returns the "already verified" message
    @Test
    @WithMockUserPrincipal
    void testRegister_AlreadyVerifiedUser_ReturnsAlreadyVerifiedMessage() throws Exception {
        when(userService.register(any())).thenReturn("User already verified. Please login.");

        mockMvc.perform(post("/api/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testUser)))
                .andExpect(status().isOk())
                .andExpect(content().string("User already verified. Please login."));
    }

    @Test
    @WithMockUserPrincipal
    void testLogin_Success() throws Exception {
        LoginResponse response = new LoginResponse();
        response.setSuccess(true);
        response.setMessage("Login successful");
        response.setToken("mock-access-token");
        response.setRefreshToken("mock-refresh-token");
        when(userService.loginUser(any())).thenReturn(response);

        mockMvc.perform(post("/api/auth/login")
                .with(csrf())
                .header("Origin", "http://localhost:3000")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.token").value("mock-access-token"))
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(header().exists("Set-Cookie"))
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("planora_refresh_token=mock-refresh-token")))
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("SameSite=None")));
    }

    @Test
    @WithMockUserPrincipal
    void testLogin_NativeClient_ReturnsRefreshTokenInBodyWithoutCookie() throws Exception {
        LoginResponse response = new LoginResponse();
        response.setSuccess(true);
        response.setMessage("Login successful");
        response.setToken("mock-access-token");
        response.setRefreshToken("mock-refresh-token");
        when(userService.loginUser(any())).thenReturn(response);

        mockMvc.perform(post("/api/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.token").value("mock-access-token"))
                .andExpect(jsonPath("$.refreshToken").value("mock-refresh-token"))
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    // (d) Login with unverified account returns 403 with UNVERIFIED_EMAIL errorCode
    @Test
    @WithMockUserPrincipal
    void testLogin_UnverifiedAccount_ReturnsUnverifiedEmailErrorCode() throws Exception {
        LoginResponse response = new LoginResponse();
        response.setSuccess(false);
        response.setErrorCode("UNVERIFIED_EMAIL");
        response.setMessage("Email is not verified");
        when(userService.loginUser(any())).thenReturn(response);

        mockMvc.perform(post("/api/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testUser)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("UNVERIFIED_EMAIL"));
    }

    @Test
    @WithMockUserPrincipal
    void testVerifyEmail_Success() throws Exception {
        VerifyRequest request = new VerifyRequest();
        request.setEmail("test@example.com");
        request.setOtp("123456");
        when(userService.verifyToken(anyString(), anyString())).thenReturn(true);

        mockMvc.perform(post("/api/auth/reg/verify")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(content().string("Verification Success!"));
    }

    // (b) verifyEmail with expired/invalid OTP returns 401 (controller behaviour)
    @Test
    @WithMockUserPrincipal
    void testVerifyEmail_InvalidOtp_Returns401() throws Exception {
        VerifyRequest request = new VerifyRequest();
        request.setEmail("test@example.com");
        request.setOtp("000000");
        when(userService.verifyToken(anyString(), anyString())).thenReturn(false);

        mockMvc.perform(post("/api/auth/reg/verify")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    // (e) forgotPassword with unknown email still returns 200 (safe response, no user enumeration)
    @Test
    @WithMockUserPrincipal
    void testForgotPassword_UnknownEmail_Returns200SafeMessage() throws Exception {
        OtpRequest request = new OtpRequest();
        request.setEmail("unknown@example.com");
        when(userService.forgotPassword(anyString())).thenReturn("If that email exists, an OTP has been sent.");

        mockMvc.perform(post("/api/auth/forgot")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(content().string("If that email exists, an OTP has been sent."));
    }

    // (f) resetPassword with wrong token returns 401 (controller behaviour)
    @Test
    @WithMockUserPrincipal
    void testResetPassword_InvalidToken_Returns401() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setEmail("test@example.com");
        request.setToken("999999");
        request.setNewPassword("NewPassword1!");
        when(userService.resetPassword(anyString(), anyString(), anyString())).thenReturn(false);

        mockMvc.perform(post("/api/auth/reset")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    // Password complexity: register with a password missing uppercase and special char returns 400
    @Test
    @WithMockUserPrincipal
    void testRegister_WeakPassword_Returns400() throws Exception {
        User weakUser = new User();
        weakUser.setEmail("weak@example.com");
        weakUser.setUsername("weakuser");
        weakUser.setPassword("password123");

        mockMvc.perform(post("/api/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(weakUser)))
                .andExpect(status().isBadRequest());
    }

    // Password complexity: resetPassword with a weak newPassword returns 400 before reaching service
    @Test
    @WithMockUserPrincipal
    void testResetPassword_WeakNewPassword_Returns400() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setEmail("test@example.com");
        request.setToken("123456");
        request.setNewPassword("weakpass");

        mockMvc.perform(post("/api/auth/reset")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
    // Refresh token endpoint returns new tokens on valid refresh token
    @Test
    @WithMockUserPrincipal
    void testRefresh_ValidToken_ReturnsNewTokens() throws Exception {
        LoginResponse response = new LoginResponse();
        response.setSuccess(true);
        response.setToken("new-access-token");
        response.setRefreshToken("new-refresh-token");
        when(userService.refreshTokens(anyString())).thenReturn(response);

        mockMvc.perform(post("/api/auth/refresh")
                .with(csrf())
                .header("Origin", "http://localhost:3000")
                .cookie(new jakarta.servlet.http.Cookie("planora_refresh_token", "old-refresh-token")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("new-access-token"))
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(header().exists("Set-Cookie"))
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("planora_refresh_token=new-refresh-token")))
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("SameSite=None")));
    }

    @Test
    @WithMockUserPrincipal
    void testRefresh_NativeBodyToken_ReturnsRotatedTokenWithoutCookie() throws Exception {
        LoginResponse response = new LoginResponse();
        response.setSuccess(true);
        response.setToken("new-access-token");
        response.setRefreshToken("new-refresh-token");
        when(userService.refreshTokens("old-native-refresh-token")).thenReturn(response);

        mockMvc.perform(post("/api/auth/refresh")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"old-native-refresh-token\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("new-access-token"))
                .andExpect(jsonPath("$.refreshToken").value("new-refresh-token"))
                .andExpect(header().doesNotExist("Set-Cookie"));
    }

    @Test
    @WithMockUserPrincipal
    void testRefresh_BrowserBodyToken_IsRejected() throws Exception {
        mockMvc.perform(post("/api/auth/refresh")
                .with(csrf())
                .header("Origin", "http://localhost:3000")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"script-readable-token\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUserPrincipal
    void testLogout_ClearsCookie() throws Exception {
        mockMvc.perform(post("/api/auth/logout")
                .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(header().exists("Set-Cookie"))
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("planora_refresh_token=;")));
    }

    @Test
    @WithMockUserPrincipal
    void testLogout_WithRefreshCookie_RevokesStoredRefreshToken() throws Exception {
        when(jwtService.validateRefreshToken("old-refresh-token")).thenReturn("test@example.com");
        when(jwtService.extractEmail("old-refresh-token")).thenReturn("test@example.com");

        mockMvc.perform(post("/api/auth/logout")
                .with(csrf())
                .cookie(new jakarta.servlet.http.Cookie("planora_refresh_token", "old-refresh-token")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("planora_refresh_token=;")));

        verify(userService).revokeRefreshToken("test@example.com", "old-refresh-token");
    }

    @Test
    @WithMockUserPrincipal
    void testLogout_WithMalformedRefreshCookie_StillClearsCookie() throws Exception {
        when(jwtService.validateRefreshToken("bad-refresh-token")).thenThrow(new RuntimeException("Invalid token"));

        mockMvc.perform(post("/api/auth/logout")
                .with(csrf())
                .cookie(new jakarta.servlet.http.Cookie("planora_refresh_token", "bad-refresh-token")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("planora_refresh_token=;")));

        verify(userService, never()).revokeRefreshToken(anyString(), anyString());
    }

    @Test
    @WithMockUserPrincipal
    void testLoginLogoutThenRefreshWithOldCookie_Returns401() throws Exception {
        LoginResponse loginResponse = new LoginResponse();
        loginResponse.setSuccess(true);
        loginResponse.setMessage("Login successful");
        loginResponse.setToken("mock-access-token");
        loginResponse.setRefreshToken("old-refresh-token");
        when(userService.loginUser(any())).thenReturn(loginResponse);
        when(jwtService.validateRefreshToken("old-refresh-token")).thenReturn("test@example.com");
        when(jwtService.extractEmail("old-refresh-token")).thenReturn("test@example.com");
        when(userService.refreshTokens("old-refresh-token")).thenReturn(null);

        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                .with(csrf())
                .header("Origin", "http://localhost:3000")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(testUser)))
                .andExpect(status().isOk())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("planora_refresh_token=old-refresh-token")))
                .andReturn();

        jakarta.servlet.http.Cookie oldRefreshCookie = new jakarta.servlet.http.Cookie(
                "planora_refresh_token",
                loginResult.getResponse().getCookie("planora_refresh_token").getValue());

        mockMvc.perform(post("/api/auth/logout")
                .with(csrf())
                .cookie(oldRefreshCookie))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/refresh")
                .with(csrf())
                .header("Origin", "http://localhost:3000")
                .cookie(oldRefreshCookie))
                .andExpect(status().isUnauthorized());

        verify(userService).revokeRefreshToken("test@example.com", "old-refresh-token");
    }

    @Test
    @WithMockUserPrincipal(email = "test@example.com")
    void testGetCurrentUser_ReturnsFullUserResponseDTO() throws Exception {
        UserResponseDTO dto = new UserResponseDTO();
        dto.setUserId(42L);
        dto.setEmail("test@example.com");
        dto.setUsername("testuser");
        dto.setVerified(true);
        
        when(userService.getCurrentUserDTO(anyString())).thenReturn(dto);

        mockMvc.perform(get("/api/auth/me").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("test@example.com"))
                .andExpect(jsonPath("$.username").value("testuser"))
                .andExpect(jsonPath("$.verified").value(true));
    }

    // BUG-2: GET /api/auth/users/{userId}/photo returns 404 when user has no profile picture
    @Test
    @WithMockUserPrincipal
    void testGetUserPhoto_NoPicture_Returns404() throws Exception {
        when(userService.generatePresignedUrlForUser(anyLong())).thenReturn(null);

        mockMvc.perform(get("/api/auth/users/99/photo").with(csrf()))
                .andExpect(status().isNotFound());
    }

    // BUG-2: GET /api/auth/users/{userId}/photo returns presigned URL when photo exists
    @Test
    @WithMockUserPrincipal
    void testGetUserPhoto_WithPicture_ReturnsPresignedUrl() throws Exception {
        when(userService.generatePresignedUrlForUser(anyLong()))
                .thenReturn("https://s3.amazonaws.com/bucket/photo.jpg?Signature=abc");

        mockMvc.perform(get("/api/auth/users/1/photo").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("https://s3.amazonaws.com/bucket/photo.jpg?Signature=abc"));
    }

    @Test
    @WithMockUserPrincipal
    void testGetAllUsers_Exception_Returns500AndStandardShape() throws Exception {
        when(userService.getAllUserDTOs(any())).thenThrow(new RuntimeException("Database error"));

        mockMvc.perform(get("/api/auth/users").with(csrf()))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.errorCode").value("INTERNAL_SERVER_ERROR"))
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"))
                .andExpect(jsonPath("$.path").value("/api/auth/users"));
    }

    @Test
    @WithMockUserPrincipal
    void testGetUserPhoto_Exception_Returns500AndStandardShape() throws Exception {
        when(userService.generatePresignedUrlForUser(anyLong())).thenThrow(new RuntimeException("AWS configuration issue"));

        mockMvc.perform(get("/api/auth/users/1/photo").with(csrf()))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.errorCode").value("INTERNAL_SERVER_ERROR"))
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"))
                .andExpect(jsonPath("$.path").value("/api/auth/users/1/photo"));
    }

    @Test
    @WithMockUserPrincipal(email = "test@example.com")
    void testGetCurrentUser_Exception_Returns500AndStandardShape() throws Exception {
        when(userService.getCurrentUserDTO(anyString())).thenThrow(new RuntimeException("Some internal failure"));

        mockMvc.perform(get("/api/auth/me").with(csrf()))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.errorCode").value("INTERNAL_SERVER_ERROR"))
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"))
                .andExpect(jsonPath("$.path").value("/api/auth/me"));
    }
}
