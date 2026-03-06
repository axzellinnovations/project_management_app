package com.planora.backend.controller;

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
                return new ResponseEntity<>("Please select file to upload", HttpStatus.BAD_REQUEST);
            }

            String email = getAuthenticatedUserEmail(authentication);
            String fileUrl = service.uploadProfilePicture(email, file);

            return new ResponseEntity<>("File uploaded successfully"+ fileUrl, HttpStatus.OK);
        } catch (Exception e){
            return new ResponseEntity<>(e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }
}
