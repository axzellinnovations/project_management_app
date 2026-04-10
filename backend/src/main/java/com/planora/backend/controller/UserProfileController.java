package com.planora.backend.controller;

import com.planora.backend.dto.PhotoUploadResponse;
import com.planora.backend.dto.UpdateProfileRequest;
import com.planora.backend.dto.UserResponseDTO;
import com.planora.backend.model.User;
import com.planora.backend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/user/profile")
public class UserProfileController {

    @Autowired
    UserService service;

    private String getAuthenticatedUserEmail(Authentication authentication){
        return authentication.getName();
    }

    private UserResponseDTO buildUserResponse(User user, String presignedUrl) {
        UserResponseDTO dto = new UserResponseDTO();
        dto.setUserId(user.getUserId());
        dto.setUsername(user.getUsername());
        dto.setFullName(user.getFullName());
        dto.setEmail(user.getEmail());
        dto.setVerified(user.isVerified());
        dto.setProfilePicUrl(presignedUrl);
        dto.setLastActive(user.getLastActive());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setContactNumber(user.getContactNumber());
        dto.setCountryCode(user.getCountryCode());
        dto.setJobTitle(user.getJobTitle());
        dto.setCompany(user.getCompany());
        dto.setPosition(user.getPosition());
        dto.setBio(user.getBio());
        return dto;
    }

    @GetMapping
    public ResponseEntity<?> getProfile(Authentication authentication) {
        try {
            String email = getAuthenticatedUserEmail(authentication);
            User user = service.getUserByEmail(email);
            String presignedUrl = service.generatePresignedUrl(user.getProfilePicUrl());
            UserResponseDTO response = buildUserResponse(user, presignedUrl);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return new ResponseEntity<>(e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    @PutMapping("/update")
    public ResponseEntity<?> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request,
            Authentication authentication) {
        try {
            String email = getAuthenticatedUserEmail(authentication);
            User updatedUser = service.updateUserProfile(email, request);

            String presignedUrl = service.generatePresignedUrl(updatedUser.getProfilePicUrl());

            UserResponseDTO response = buildUserResponse(updatedUser, presignedUrl);
            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (Exception e){
            return new ResponseEntity<>(e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    @PostMapping("/photo")
    public ResponseEntity<?> uploadProfilePhoto(
            @RequestParam("file")MultipartFile file,
            Authentication authentication){
        try {
            if(file.isEmpty()){
                PhotoUploadResponse response = new PhotoUploadResponse(false, "Please select file to upload", null, "EMPTY_FILE");
                return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
            }

            // Validate content type
            String contentType = file.getContentType();
            if(contentType == null || !service.isValidImageType(contentType)) {
                PhotoUploadResponse response = new PhotoUploadResponse(false, "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed", null, "INVALID_FILE_TYPE");
                return new ResponseEntity<>(response, HttpStatus.UNSUPPORTED_MEDIA_TYPE);
            }

            String email = getAuthenticatedUserEmail(authentication);

            // This saves the file to S3, updates the DB, and returns the permanent locked URL
            String rawFileUrl = service.uploadProfilePicture(email, file);

            // Generate the secure, temporary URL so the frontend can display it immediately
            String presignedUrl = service.generatePresignedUrl(rawFileUrl);

            // Send the presigned URL back to the frontend
            PhotoUploadResponse response = new PhotoUploadResponse(true, "File uploaded successfully", presignedUrl, null);
            return new ResponseEntity<>(response, HttpStatus.OK);

        } catch (IllegalArgumentException e){
            PhotoUploadResponse response = new PhotoUploadResponse(false, e.getMessage(), null, "INVALID_FILE");
            return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
        } catch (Exception e){
            PhotoUploadResponse response = new PhotoUploadResponse(false, e.getMessage(), null, "UPLOAD_ERROR");
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
