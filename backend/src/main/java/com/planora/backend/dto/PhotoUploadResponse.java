package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class PhotoUploadResponse {
    private boolean success;
    private String message;
    private String photoUrl;
    private String errorCode;
}
