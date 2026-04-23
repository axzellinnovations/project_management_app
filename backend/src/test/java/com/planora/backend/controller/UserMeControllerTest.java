package com.planora.backend.controller;

import com.planora.backend.annotation.WithMockUserPrincipal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.UserResponseDTO;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserMeController.class)
class UserMeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService service;

    @MockitoBean
    private JWTService jwtService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @Test
    @WithMockUserPrincipal(email = "alice@example.com")
    void getCurrentUser_returnsUserDTO_whenAuthenticated() throws Exception {
        UserResponseDTO dto = new UserResponseDTO();
        dto.setEmail("alice@example.com");
        dto.setUsername("alice");
        when(service.getCurrentUserDTO("alice@example.com")).thenReturn(dto);

        mockMvc.perform(get("/api/user/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("alice@example.com"))
                .andExpect(jsonPath("$.username").value("alice"));
    }

    @Test
    @WithMockUserPrincipal(email = "alice@example.com")
    void getCurrentUser_returns500_whenServiceThrows() throws Exception {
        when(service.getCurrentUserDTO(anyString())).thenThrow(new RuntimeException("DB error"));

        mockMvc.perform(get("/api/user/me"))
                .andExpect(status().isInternalServerError());
    }
}
