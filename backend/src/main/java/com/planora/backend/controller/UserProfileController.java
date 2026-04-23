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

// Handles operations specifically related to managing the authenticated user's profile.
@RestController
@RequestMapping("/api/user/profile")
public class UserProfileController {

    @Autowired
    UserService service;

    // Centralizing this extraction keeps the controller DRY.
    // If the token structure or authentication mechanism ever changes, we only update it here.
    private String getAuthenticatedUserEmail(Authentication authentication){
        return authentication.getName();
    }

    // Fetches the current user's full profile details.
    @GetMapping
    public ResponseEntity<?> getProfile(Authentication authentication) {
        try {
            UserResponseDTO response = service.getCurrentUserDTO(getAuthenticatedUserEmail(authentication));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return new ResponseEntity<>(e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    /* Updates the user's textual profile data (name,bio, company, etc.).
     * we return fully updated DTO so the frontend can immediately
     * refresh its state without having to make a secondary GET request to fetch the new data.
     */
    @PutMapping("/update")
    public ResponseEntity<?> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request,
            Authentication authentication) {
        try {
            UserResponseDTO response = service.updateUserProfileAndGetDTO(getAuthenticatedUserEmail(authentication), request);
            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (Exception e){
            return new ResponseEntity<>(e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    /* Handles multipart file uploads for user avatars.
    *  Validates the file securely before attempting external S3 operations.
    */
    @PostMapping("/photo")
    public ResponseEntity<?> uploadProfilePhoto(
            @RequestParam("file")MultipartFile file,
            Authentication authentication){
        try {
            // Fail fast: Prevent unnecessary processing or AWS calls for empty payloads.
            if(file.isEmpty()){
                PhotoUploadResponse response = new PhotoUploadResponse(false, "Please select file to upload", null, "EMPTY_FILE");
                return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
            }

            // Validating the MIME type prevents malicious executables or scripts
            String contentType = file.getContentType();
            if(contentType == null || !service.isValidImageType(contentType)) {
                // Returning a specific error code ("INVALID_FILE_TYPE") allows the frontend
                // to show a localized, friendly error message without parsing the raw string.
                PhotoUploadResponse response = new PhotoUploadResponse(false, "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed", null, "INVALID_FILE_TYPE");
                return new ResponseEntity<>(response, HttpStatus.UNSUPPORTED_MEDIA_TYPE);
            }

            String email = getAuthenticatedUserEmail(authentication);

            // This saves the file to S3, updates the DB, and returns the permanent locked URL
            String rawFileUrl = service.uploadProfilePicture(email, file);

            // Because our S3 bucket is private, the raw URL is useless to the frontend.
            // We immediately generate a temporary presigned URL so the user's UI can
            // instantly display the newly uploaded avatar.
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
