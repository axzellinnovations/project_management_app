package com.planora.backend.controller;

import com.planora.backend.dto.UserResponseDTO;
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
@CrossOrigin(origins = "http://localhost:3000")
public class UserController {

    @Autowired
    private UserService service;

    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody User user){
        return new ResponseEntity<>(service.register(user), HttpStatus.OK);
    }

    @PostMapping("/reg/verify")
    public ResponseEntity<?> verifyEmail(@RequestBody VerifyRequest request){
        boolean isSuccess = service.verifyToken(request.getEmail(), request.getOtp());
        if(isSuccess){
            return new ResponseEntity<>("Verification Success!",HttpStatus.OK);
        }
        else {
            return new ResponseEntity<>("Invalid or Expired OTP",HttpStatus.UNAUTHORIZED);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody User user){
        LoginResponse response = service.loginUser(user);
        if(response.isSuccess()){
            return new ResponseEntity<>(response, HttpStatus.OK);
        } else if("UNVERIFIED_EMAIL".equals(response.getErrorCode())) {
            return new ResponseEntity<>(response, HttpStatus.FORBIDDEN);
        } else {
            return new ResponseEntity<>(response, HttpStatus.UNAUTHORIZED);
        }
    }

    @PostMapping("/resend")
    public ResponseEntity<String> resendOtp(@RequestBody OtpRequest otpRequest){
        return new ResponseEntity<>(service.resendOtp(otpRequest.getEmail()), HttpStatus.OK);
    }

    @PostMapping("/forgot")
    public ResponseEntity<String> forgotPassword(@RequestBody OtpRequest otpRequest){
        return new ResponseEntity<>(service.forgotPassword(otpRequest.getEmail()), HttpStatus.OK);
    }

    @PostMapping("/reset")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest request){
        boolean isSuccess = service.resetPassword(request.getEmail(), request.getOtp(), request.getNewPassword());
        if(isSuccess){
            return new ResponseEntity<>("Password reset successfully", HttpStatus.OK);
        }
        else {
            return new ResponseEntity<>("Invalid or expired OTP", HttpStatus.UNAUTHORIZED);
        }
    }

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers(@RequestParam(required = false) String excludeEmail) {
        try {
            List<User> allUsers = service.getAllUsers();

            // Filter out the current user if excludeEmail is provided
            if (excludeEmail != null && !excludeEmail.isEmpty()) {
                allUsers = allUsers.stream()
                        .filter(user -> !user.getEmail().equalsIgnoreCase(excludeEmail))
                        .collect(Collectors.toList());
            }

            // Return UserResponseDTO with complete user information
            List<UserResponseDTO> userList = allUsers.stream()
                    .map(user -> new UserResponseDTO(
                            user.getUserId(),
                            user.getUsername(),
                            user.getFullName(),
                            user.getEmail(),
                            user.isVerified(),
                            service.generatePresignedUrl(user.getProfilePicUrl())
                    ))
                    .collect(Collectors.toList());

            return new ResponseEntity<>(userList, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>("Error fetching users: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/try")
    public String myTry(){
        return "Try - Running Successfully";
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Authentication authentication) {
        try {
            String email = authentication.getName();
            User user = service.getUserByEmail(email);
            return new ResponseEntity<>(Map.of(
                    "email", user.getEmail(),
                    "username", user.getUsername() != null ? user.getUsername() : ""
            ), HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>("Failed to fetch current user: " + e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

}
