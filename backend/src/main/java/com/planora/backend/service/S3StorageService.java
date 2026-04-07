package com.planora.backend.service;

import com.planora.backend.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class S3StorageService {

    private final S3Presigner s3Presigner;
    private final S3Client s3Client;

    public String generatePresignedUploadUrl(String bucket, String objectKey, String contentType, Duration duration) {
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .contentType(contentType)
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(duration)
                .putObjectRequest(putObjectRequest)
                .build();

        return s3Presigner.presignPutObject(presignRequest).url().toString();
    }

    public String generatePresignedDownloadUrl(String bucket, String objectKey, Duration duration) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .build();

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(duration)
                .getObjectRequest(getObjectRequest)
                .build();

        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    public void verifyObjectExists(String bucket, String objectKey) {
        try {
            HeadObjectRequest headObjectRequest = HeadObjectRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .build();
            s3Client.headObject(headObjectRequest);
        } catch (NoSuchKeyException ex) {
            throw new ResourceNotFoundException("Uploaded object not found in storage");
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                throw new ResourceNotFoundException("Uploaded object not found in storage");
            }
            throw new RuntimeException("Failed to verify uploaded object");
        }
    }

    public void deleteObject(String bucket, String objectKey) {
        DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .build();
        s3Client.deleteObject(deleteObjectRequest);
    }

    public String resolveContentType(String contentType, String fileName) {
        if (contentType != null && !contentType.isBlank() && !"application/octet-stream".equalsIgnoreCase(contentType)) {
            return contentType;
        }

        String extension = "";
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex >= 0 && dotIndex < fileName.length() - 1) {
            extension = fileName.substring(dotIndex + 1).toLowerCase();
        }

        Map<String, String> mimeMap = Map.ofEntries(
                Map.entry("pdf", "application/pdf"),
                Map.entry("doc", "application/msword"),
                Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
                Map.entry("xls", "application/vnd.ms-excel"),
                Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
                Map.entry("txt", "text/plain"),
                Map.entry("jpeg", "image/jpeg"),
                Map.entry("jpg", "image/jpeg"),
                Map.entry("png", "image/png"),
                Map.entry("gif", "image/gif"),
                Map.entry("webp", "image/webp")
        );

        return mimeMap.getOrDefault(extension, "application/octet-stream");
    }

    public void validateFileRequest(String fileName, String contentType, Long fileSize,
                                    long maxBytes, Set<String> allowedTypes) {
        if (fileName == null || fileName.isBlank()) {
            throw new RuntimeException("fileName is required");
        }

        if (contentType == null || contentType.isBlank()) {
            throw new RuntimeException("contentType is required");
        }

        if (!allowedTypes.contains(contentType)) {
            throw new RuntimeException("Unsupported file type");
        }

        if (fileSize == null || fileSize <= 0 || fileSize > maxBytes) {
            throw new RuntimeException("fileSize must be between 1 byte and " + (maxBytes / (1024 * 1024)) + "MB");
        }
    }
}
