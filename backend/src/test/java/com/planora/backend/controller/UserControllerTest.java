package com.planora.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.LoginResponse;
import com.planora.backend.dto.OtpRequest;
import com.planora.backend.dto.ResetPasswordRequest;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
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
        testUser.setPassword("password123");
        testUser.setUsername("testuser");
    }

    @Test
    @WithMockUser
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
    @WithMockUser
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
    @WithMockUser
    void testLogin_Success() throws Exception {
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
                .andExpect(jsonPath("$.refreshToken").value("mock-refresh-token"));
    }

    // (d) Login with unverified account returns 403 with UNVERIFIED_EMAIL errorCode
    @Test
    @WithMockUser
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
    @WithMockUser
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
    @WithMockUser
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
    @WithMockUser
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
    @WithMockUser
    void testResetPassword_InvalidToken_Returns401() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("999999");
        request.setNewPassword("newPassword123");
        when(userService.resetPassword(anyString(), anyString())).thenReturn(false);

        mockMvc.perform(post("/api/auth/reset")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    // Refresh token endpoint returns new tokens on valid refresh token
    @Test
    @WithMockUser
    void testRefresh_ValidToken_ReturnsNewTokens() throws Exception {
        LoginResponse response = new LoginResponse();
        response.setSuccess(true);
        response.setToken("new-access-token");
        response.setRefreshToken("new-refresh-token");
        when(userService.refreshTokens(anyString())).thenReturn(response);

        mockMvc.perform(post("/api/auth/refresh")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"old-refresh-token\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("new-access-token"))
                .andExpect(jsonPath("$.refreshToken").value("new-refresh-token"));
    }
}
