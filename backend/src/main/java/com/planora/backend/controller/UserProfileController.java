package com.planora.backend.controller;

import com.planora.backend.dto.PhotoUploadResponse;
import com.planora.backend.dto.UpdateProfileRequest;
import com.planora.backend.model.User;
import com.planora.backend.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/user/profile")
public class UserProfileController {

    @Autowired
    UserService service;

    private String getAuthenticatedUserEmail(Authentication authentication){
        return authentication.getName();
    }


    @PutMapping("/update")
    public ResponseEntity<?> updateProfile(
            @RequestBody UpdateProfileRequest request,
            Authentication authentication) {
        try {
            String email = getAuthenticatedUserEmail(authentication);
            User updateUser = service.updateUserDetails(email, request.getFullName());
            return new ResponseEntity<>(updateUser, HttpStatus.OK);
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
            if(contentType == null || !isValidImageType(contentType)) {
                PhotoUploadResponse response = new PhotoUploadResponse(false, "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed", null, "INVALID_FILE_TYPE");
                return new ResponseEntity<>(response, HttpStatus.UNSUPPORTED_MEDIA_TYPE);
            }

            String email = getAuthenticatedUserEmail(authentication);
            String fileUrl = service.uploadProfilePicture(email, file);

            PhotoUploadResponse response = new PhotoUploadResponse(true, "File uploaded successfully", fileUrl, null);
            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (IllegalArgumentException e){
            PhotoUploadResponse response = new PhotoUploadResponse(false, e.getMessage(), null, "INVALID_FILE");
            return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
        } catch (Exception e){
            PhotoUploadResponse response = new PhotoUploadResponse(false, e.getMessage(), null, "UPLOAD_ERROR");
            return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private boolean isValidImageType(String contentType) {
        return contentType.equals("image/jpeg") || 
               contentType.equals("image/png") || 
               contentType.equals("image/gif") || 
               contentType.equals("image/webp");
    }
}
