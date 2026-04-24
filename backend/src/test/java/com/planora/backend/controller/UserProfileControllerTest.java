package com.planora.backend.controller;

import com.planora.backend.annotation.WithMockUserPrincipal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.PhotoUploadResponse;
import com.planora.backend.dto.UpdateProfileRequest;
import com.planora.backend.dto.UserResponseDTO;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserProfileController.class)
class UserProfileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService service;

    @MockitoBean
    private JWTService jwtService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    private UserResponseDTO sampleDTO;

    @BeforeEach
    void setUp() {
        sampleDTO = new UserResponseDTO();
        sampleDTO.setEmail("alice@example.com");
        sampleDTO.setUsername("alice");
        sampleDTO.setFullName("Alice Smith");
    }

    @Test
    @WithMockUserPrincipal(email = "alice@example.com")
    void getProfile_returns200WithUserDTO() throws Exception {
        when(service.getCurrentUserDTO("alice@example.com")).thenReturn(sampleDTO);

        mockMvc.perform(get("/api/user/profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("alice@example.com"))
                .andExpect(jsonPath("$.fullName").value("Alice Smith"));
    }

    @Test
    @WithMockUserPrincipal(email = "alice@example.com")
    void getProfile_returns400_whenServiceThrows() throws Exception {
        when(service.getCurrentUserDTO(anyString())).thenThrow(new RuntimeException("User not found"));

        mockMvc.perform(get("/api/user/profile"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUserPrincipal(email = "alice@example.com")
    void updateProfile_returns200WithUpdatedDTO() throws Exception {
        UpdateProfileRequest req = new UpdateProfileRequest();
        req.setFullName("Alice Updated");

        when(service.updateUserProfileAndGetDTO(anyString(), any())).thenReturn(sampleDTO);

        mockMvc.perform(put("/api/user/profile/update")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("alice@example.com"));
    }

    @Test
    @WithMockUserPrincipal(email = "alice@example.com")
    void updateProfile_returns400_whenServiceThrows() throws Exception {
        UpdateProfileRequest req = new UpdateProfileRequest();
        req.setFullName("Bad Data");
        when(service.updateUserProfileAndGetDTO(anyString(), any())).thenThrow(new RuntimeException("Duplicate username"));

        mockMvc.perform(put("/api/user/profile/update")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUserPrincipal(email = "alice@example.com")
    void uploadProfilePhoto_returns400_whenFileIsEmpty() throws Exception {
        MockMultipartFile emptyFile = new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[0]);

        mockMvc.perform(multipart("/api/user/profile/photo")
                        .file(emptyFile)
                        .with(csrf()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errorCode").value("EMPTY_FILE"));
    }

    @Test
    @WithMockUserPrincipal(email = "alice@example.com")
    void uploadProfilePhoto_returns415_whenContentTypeInvalid() throws Exception {
        MockMultipartFile badFile = new MockMultipartFile("file", "malicious.exe", "application/octet-stream", "data".getBytes());
        when(service.isValidImageType("application/octet-stream")).thenReturn(false);

        mockMvc.perform(multipart("/api/user/profile/photo")
                        .file(badFile)
                        .with(csrf()))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.errorCode").value("INVALID_FILE_TYPE"));
    }

    @Test
    @WithMockUserPrincipal(email = "alice@example.com")
    void uploadProfilePhoto_returns200_whenImageValid() throws Exception {
        MockMultipartFile validFile = new MockMultipartFile("file", "photo.jpg", "image/jpeg", "imagedata".getBytes());
        when(service.isValidImageType("image/jpeg")).thenReturn(true);
        when(service.uploadProfilePicture(anyString(), any())).thenReturn("s3://bucket/photo.jpg");
        when(service.generatePresignedUrl(anyString())).thenReturn("https://cdn.example.com/photo.jpg?sig=abc");

        mockMvc.perform(multipart("/api/user/profile/photo")
                        .file(validFile)
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.photoUrl").value("https://cdn.example.com/photo.jpg?sig=abc"));
    }
}
