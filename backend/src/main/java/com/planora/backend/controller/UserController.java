package com.planora.backend.controller;

import com.planora.backend.dto.UserResponseDTO;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.planora.backend.dto.LoginResponse;
import com.planora.backend.dto.LoginRequest;
import com.planora.backend.dto.OtpRequest;
import com.planora.backend.dto.RegisterRequest;
import com.planora.backend.dto.RefreshRequest;
import com.planora.backend.dto.ResetPasswordRequest;
import com.planora.backend.dto.VerifyRequest;
import com.planora.backend.model.User;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.UserService;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.CookieValue;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
// CORS is configured globally in SecurityConfig — no @CrossOrigin annotation needed here.
public class UserController {

    private final UserService service;
    private final JWTService jwtService;

    @Value("${app.cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${app.cookie.samesite:None}")
    private String cookieSameSite;


    //@Valid is used here to fail fast. It catches the bad data (like malformed emails or short passwords)
    //at the controller level before we waste resources hitting the database or service layer.
    @PostMapping("/register")
    public ResponseEntity<String> register(@Valid @RequestBody RegisterRequest request) {
        User user = new User();
        user.setUsername(request.getUsername());
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPassword(request.getPassword());
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
    public ResponseEntity<?> login(
            @Valid @RequestBody LoginRequest request,
            @RequestHeader(value = "Origin", required = false) String origin,
            @RequestHeader(value = "Sec-Fetch-Site", required = false) String fetchSite) {
        User user = new User();
        user.setEmail(request.getEmail());
        user.setPassword(request.getPassword());
        LoginResponse response = service.loginUser(user);
        if (response.isSuccess()) {
            boolean browserRequest = origin != null || (fetchSite != null && !fetchSite.isBlank());
            if (!browserRequest) {
                // Preserve the established native response shape: the app stores
                // the rotated token in platform secure storage.
                return ResponseEntity.ok(response);
            }

            ResponseCookie cookie = ResponseCookie.from("planora_refresh_token", response.getRefreshToken())
                    .httpOnly(true)
                    .secure(cookieSecure)
                    .path("/")
                    .maxAge(30 * 24 * 60 * 60) // 30 days
                    .sameSite(cookieSameSite)
                    .build();
            response.setRefreshToken(null);
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, cookie.toString())
                    .body(response);
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
        boolean isSuccess = service.resetPassword(request.getEmail(), request.getToken(), request.getNewPassword());
        if (isSuccess) {
            return new ResponseEntity<>("Password reset successfully", HttpStatus.OK);
        } else {
            return new ResponseEntity<>("Invalid or expired OTP", HttpStatus.UNAUTHORIZED);
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(
            @CookieValue(name = "planora_refresh_token", required = false) String cookieRefreshToken,
            @Valid @RequestBody(required = false) RefreshRequest request,
            @RequestHeader(value = "Origin", required = false) String origin,
            @RequestHeader(value = "Sec-Fetch-Site", required = false) String fetchSite) {

        boolean browserRequest = origin != null || (fetchSite != null && !fetchSite.isBlank());
        String bodyRefreshToken = request == null ? null : request.getRefreshToken();

        // A browser must use the HttpOnly cookie. Accepting a body token here would
        // reintroduce script-readable refresh credentials into the browser flow.
        if (browserRequest && bodyRefreshToken != null && !bodyRefreshToken.isBlank()) {
            return new ResponseEntity<>("Browser refresh requests must use the refresh cookie", HttpStatus.BAD_REQUEST);
        }

        String refreshToken = browserRequest ? cookieRefreshToken
                : (cookieRefreshToken != null && !cookieRefreshToken.isBlank() ? cookieRefreshToken : bodyRefreshToken);

        // Fail fast if the client didn't send the token, preventing unnecessary DB queries.
        if (refreshToken == null || refreshToken.isBlank()) {
            return new ResponseEntity<>(browserRequest ? "Refresh token cookie is required" : "Refresh token is required",
                    HttpStatus.BAD_REQUEST);
        }

        LoginResponse response = service.refreshTokens(refreshToken);
        if (response != null && response.isSuccess()) {
            if (!browserRequest) {
                // Preserve the established native response shape: the app stores
                // the rotated token in platform secure storage.
                return ResponseEntity.ok(response);
            }

            ResponseCookie cookie = ResponseCookie.from("planora_refresh_token", response.getRefreshToken())
                    .httpOnly(true).secure(cookieSecure).path("/")
                    .maxAge(30 * 24 * 60 * 60).sameSite(cookieSameSite).build();
            response.setRefreshToken(null);
            return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString()).body(response);
        }
        return new ResponseEntity<>("Invalid or expired refresh token", HttpStatus.UNAUTHORIZED);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            @CookieValue(name = "planora_refresh_token", required = false) String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            try {
                jwtService.validateRefreshToken(refreshToken);
                String email = jwtService.extractEmail(refreshToken);
                service.revokeRefreshToken(email, refreshToken);
            } catch (Exception ignored) {
                // Logout remains idempotent: always clear the client cookie even if the
                // submitted refresh token is malformed, expired, or already invalid.
            }
        }

        ResponseCookie cookie = ResponseCookie.from("planora_refresh_token", "")
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(0) // immediately expire
                .sameSite(cookieSameSite)
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(Map.of("success", true, "message", "Logged out successfully"));
    }

    // The 'excludeEmail' parameter allows clients to fetch a list of peers without
    // the currently logged-in user appearing in their own dropdowns.
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers(@RequestParam(required = false) String excludeEmail) {
        List<UserResponseDTO> userList = service.getAllUserDTOs(excludeEmail);
        return new ResponseEntity<>(userList, HttpStatus.OK);
    }

    /**
     * On-demand presigned URL for a single user's profile photo. Consumers that only
     * need the avatar for one user should call this endpoint instead of fetching the
     * full user list (avoids O(N) S3 presigner calls on the list endpoint).
     */
    @GetMapping("/users/{userId}/photo")
    public ResponseEntity<?> getUserPhoto(@PathVariable Long userId) {
        String presignedUrl = service.generatePresignedUrlForUser(userId);
        if (presignedUrl == null) {
            // Return 404 so the frontend knows to gracefully fallback to the default avatar.
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }
        return new ResponseEntity<>(Map.of("url", presignedUrl), HttpStatus.OK);
    }

    @Deprecated
    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        // While Spring security usually blocks unauthenticated traffic before it hits the controller,
        // this explicit check prevents NullPointerExceptions if security configuration changes
        // or if the endpoint accidentally exposed.
        if (authentication == null || !authentication.isAuthenticated()) {
            return new ResponseEntity<>("User is not authenticated", HttpStatus.UNAUTHORIZED);
        }
        UserResponseDTO dto = service.getCurrentUserDTO(authentication.getName());
        return new ResponseEntity<>(dto, HttpStatus.OK);
    }

}
