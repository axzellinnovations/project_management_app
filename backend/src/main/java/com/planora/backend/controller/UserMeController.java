package com.planora.backend.controller;

import com.planora.backend.dto.UserResponseDTO;
import com.planora.backend.model.User;
import com.planora.backend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/user")
public class UserMeController {

    @Autowired
    private UserService service;

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return new ResponseEntity<>("User is not authenticated", HttpStatus.UNAUTHORIZED);
        }

        try {
            String email = authentication.getName();
            User user = service.getUserByEmail(email);
            String presignedUrl = user.getProfilePicUrl() != null && !user.getProfilePicUrl().isEmpty()
                    ? service.generatePresignedUrl(user.getProfilePicUrl())
                    : null;
            
            UserResponseDTO dto = new UserResponseDTO(
                    user.getUserId(),
                    user.getUsername(),
                    user.getFullName(),
                    user.getEmail(),
                    user.isVerified(),
                    presignedUrl,
                    user.getLastActive(),
                    user.getFirstName(),
                    user.getLastName(),
                    user.getContactNumber(),
                    user.getCountryCode(),
                    user.getJobTitle(),
                    user.getCompany(),
                    user.getPosition(),
                    user.getBio()
            );
            return new ResponseEntity<>(dto, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>("Failed to fetch current user: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
