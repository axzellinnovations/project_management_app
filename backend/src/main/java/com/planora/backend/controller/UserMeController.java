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
// Maintaining a dedicated controller or endpoint for the "current user"
// keeps user-context operations distinct from broader administrative actions (like fetching all users).
public class UserMeController {

    @Autowired
    private UserService service;

    /* Frontend calls this endpoint immediately after login or upon hard page refresh.
        It allows fronted to blindly send its auth token and "hydrate" the app state with the current
        user's profile, avatar, and permissions without needing to know ther user ID upfront */
    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return new ResponseEntity<>("User is not authenticated", HttpStatus.UNAUTHORIZED);
        }

        try {
            /* We extract the user's identifier (usually their email)
              directly from the cryptographically verified token. This prevents Insecure Direct
              Object Reference (IDOR) vulnerabilities, making it impossible for a malicious user
              to fetch someone else's profile by manipulating a request parameter */
            UserResponseDTO dto = service.getCurrentUserDTO(authentication.getName());
            return new ResponseEntity<>(dto, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>("Failed to fetch current user: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
