package com.planora.backend.controller;

import com.planora.backend.dto.UserResponseDTO;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.planora.backend.dto.LoginResponse;
import com.planora.backend.dto.OtpRequest;
import com.planora.backend.dto.ResetPasswordRequest;
import com.planora.backend.dto.VerifyRequest;
import com.planora.backend.model.User;
import com.planora.backend.service.UserService;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;

@RestController
@RequestMapping("/api/auth")
// CORS is configured globally in SecurityConfig — no @CrossOrigin annotation needed here.
public class UserController {

    @Autowired
    private UserService service;

    //@Valid is used here to fail fast. It catches the bad data (like malformed emails or short passwords)
    //at the controller level before we waste resources hitting the database or service layer.
    @PostMapping("/register")
    public ResponseEntity<String> register(@Valid @RequestBody User user) {
        return new ResponseEntity<>(service.register(user), HttpStatus.OK);
    }

    @PostMapping("/reg/verify")
    public ResponseEntity<?> verifyEmail(@Valid @RequestBody VerifyRequest request) {
        boolean isSuccess = service.verifyToken(request.getEmail(), request.getOtp());
        if (isSuccess) {
            return new ResponseEntity<>("Verification Success!", HttpStatus.OK);
        } else {
            //Returning UNAUTHORIZED (401) because failing to verify means the user
            // cannot be granted access to the system.
            return new ResponseEntity<>("Invalid or Expired OTP", HttpStatus.UNAUTHORIZED);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody User user) {
        LoginResponse response = service.loginUser(user);
        if (response.isSuccess()) {
            return new ResponseEntity<>(response, HttpStatus.OK);
        } else if ("UNVERIFIED_EMAIL".equals(response.getErrorCode())) {
            // We return a specific FORBIDDEN (403) status and error code here so the frontend
            // client knows to redirect the user to the OTP verification page,
            // rather than just showing a generic "bad credentials" error.
            return new ResponseEntity<>(response, HttpStatus.FORBIDDEN);
        } else {
            return new ResponseEntity<>(response, HttpStatus.UNAUTHORIZED);
        }
    }

    @PostMapping("/resend")
    public ResponseEntity<String> resendOtp(@Valid @RequestBody OtpRequest otpRequest) {
        return new ResponseEntity<>(service.resendOtp(otpRequest.getEmail()), HttpStatus.OK);
    }

    // Maintained as an alias to support older mobile app versions
    @PostMapping("/resend-otp")
    public ResponseEntity<String> resendOtpAlias(@Valid @RequestBody OtpRequest otpRequest) {
        return new ResponseEntity<>(service.resendOtp(otpRequest.getEmail()), HttpStatus.OK);
    }

    @PostMapping("/forgot")
    public ResponseEntity<String> forgotPassword(@Valid @RequestBody OtpRequest otpRequest) {
        return new ResponseEntity<>(service.forgotPassword(otpRequest.getEmail()), HttpStatus.OK);
    }

    @PostMapping("/reset")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        boolean isSuccess = service.resetPassword(request.getToken(), request.getNewPassword());
        if (isSuccess) {
            return new ResponseEntity<>("Password reset successfully", HttpStatus.OK);
        } else {
            return new ResponseEntity<>("Invalid or expired OTP", HttpStatus.UNAUTHORIZED);
        }
    }

    // Using a Map for the body allows to quickly extract just the refreshToken without
    // needing to build and maintain a dedicated DTO class.
    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");

        // Fail fast if the client didn't send the token, preventing unnecessary DB queries.
        if (refreshToken == null || refreshToken.isBlank()) {
            return new ResponseEntity<>("Refresh token is required", HttpStatus.BAD_REQUEST);
        }

        LoginResponse response = service.refreshTokens(refreshToken);
        if (response != null && response.isSuccess()) {
            return new ResponseEntity<>(response, HttpStatus.OK);
        }
        return new ResponseEntity<>("Invalid or expired refresh token", HttpStatus.UNAUTHORIZED);
    }

    // The 'excludeEmail' parameter allows clients to fetch a list of peers without
    // the currently logged-in user appearing in their own dropdowns.
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers(@RequestParam(required = false) String excludeEmail) {
        try {
            List<UserResponseDTO> userList = service.getAllUserDTOs(excludeEmail);
            return new ResponseEntity<>(userList, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>("Error fetching users: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * On-demand presigned URL for a single user's profile photo. Consumers that only
     * need the avatar for one user should call this endpoint instead of fetching the
     * full user list (avoids O(N) S3 presigner calls on the list endpoint).
     */
    @GetMapping("/users/{userId}/photo")
    public ResponseEntity<?> getUserPhoto(@PathVariable Long userId) {
        try {
            String presignedUrl = service.generatePresignedUrlForUser(userId);
            if (presignedUrl == null) {
                // Return 404 so the frontend knows to gracefully fallback to the default avatar.
                return new ResponseEntity<>(HttpStatus.NOT_FOUND);
            }
            return new ResponseEntity<>(Map.of("url", presignedUrl), HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>("Error fetching photo: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // Testing endpoint
    @GetMapping("/try")
    public String myTry() {
        return "Try - Running Successfully";
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        // While Spring security usually blocks unauthenticated traffic before it hits the controller,
        // this explicit check prevents NullPointerExceptions if security configuration changes
        // or if the endpoint accidentally exposed.
        if (authentication == null || !authentication.isAuthenticated()) {
            return new ResponseEntity<>("User is not authenticated", HttpStatus.UNAUTHORIZED);
        }
        try {
            UserResponseDTO dto = service.getCurrentUserDTO(authentication.getName());
            return new ResponseEntity<>(dto, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>("Failed to fetch current user: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

}
