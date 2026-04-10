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
            return new ResponseEntity<>("Invalid or Expired OTP", HttpStatus.UNAUTHORIZED);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody User user) {
        LoginResponse response = service.loginUser(user);
        if (response.isSuccess()) {
            return new ResponseEntity<>(response, HttpStatus.OK);
        } else if ("UNVERIFIED_EMAIL".equals(response.getErrorCode())) {
            return new ResponseEntity<>(response, HttpStatus.FORBIDDEN);
        } else {
            return new ResponseEntity<>(response, HttpStatus.UNAUTHORIZED);
        }
    }

    @PostMapping("/resend")
    public ResponseEntity<String> resendOtp(@Valid @RequestBody OtpRequest otpRequest) {
        return new ResponseEntity<>(service.resendOtp(otpRequest.getEmail()), HttpStatus.OK);
    }

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

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        if (refreshToken == null || refreshToken.isBlank()) {
            return new ResponseEntity<>("Refresh token is required", HttpStatus.BAD_REQUEST);
        }
        LoginResponse response = service.refreshTokens(refreshToken);
        if (response != null && response.isSuccess()) {
            return new ResponseEntity<>(response, HttpStatus.OK);
        }
        return new ResponseEntity<>("Invalid or expired refresh token", HttpStatus.UNAUTHORIZED);
    }

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers(@RequestParam(required = false) String excludeEmail) {
        try {
            List<User> allUsers = service.getAllUsers();

            if (excludeEmail != null && !excludeEmail.isEmpty()) {
                allUsers = allUsers.stream()
                        .filter(user -> !user.getEmail().equalsIgnoreCase(excludeEmail))
                        .collect(Collectors.toList());
            }

            // BUG-2 fix: only generate a presigned URL for users that actually have a photo key.
            List<UserResponseDTO> userList = allUsers.stream()
                    .map(user -> new UserResponseDTO(
                            user.getUserId(),
                            user.getUsername(),
                            user.getFullName(),
                            user.getEmail(),
                            user.isVerified(),
                            user.getProfilePicUrl() != null && !user.getProfilePicUrl().isEmpty()
                                    ? service.generatePresignedUrl(user.getProfilePicUrl())
                                    : null,
                            user.getLastActive(),
                            null, null, null, null, null, null, null, null
                    ))
                    .collect(Collectors.toList());

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
                return new ResponseEntity<>(HttpStatus.NOT_FOUND);
            }
            return new ResponseEntity<>(Map.of("url", presignedUrl), HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>("Error fetching photo: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/try")
    public String myTry() {
        return "Try - Running Successfully";
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
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
                    null, null, null, null, null, null, null, null
            );
            return new ResponseEntity<>(dto, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>("Failed to fetch current user: " + e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

}
