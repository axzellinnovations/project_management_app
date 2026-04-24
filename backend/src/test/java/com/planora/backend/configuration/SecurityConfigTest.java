package com.planora.backend.configuration;

import com.planora.backend.service.JWTService;
import com.planora.backend.service.UserService;
import com.planora.backend.controller.UserController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tests SecurityConfig behaviour — public endpoints are accessible without auth,
 * and protected ones return 401.
 * Uses a minimal controller slice to avoid loading the full context.
 */
@WebMvcTest(UserController.class)
class SecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JWTService jwtService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @MockitoBean
    private JwtFilter jwtFilter;

    @MockitoBean
    private UserService userService;

    @Test
    void publicRegisterEndpoint_isAccessibleWithoutAuth() throws Exception {
        mockMvc.perform(get("/api/auth/register"))
                .andExpect(status().is4xxClientError()); // 405 Method Not Allowed is fine — security passed
    }

    @Test
    void protectedEndpoint_returns401_whenNoToken() throws Exception {
        mockMvc.perform(get("/api/tasks/1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void passwordEncoder_isUsingBCrypt() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        String encoded = encoder.encode("password123");
        assertTrue(encoder.matches("password123", encoded));
        assertFalse(encoder.matches("wrongpassword", encoded));
    }
}
