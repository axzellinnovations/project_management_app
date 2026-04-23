package com.planora.backend.service;

import com.planora.backend.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.InputStream;
import java.time.Duration;
import java.util.Map;
import java.util.Set;

// By keeping all AWS-specific logic in this single service, we prevent
// S3 dependencies from bleeding into our core business logic.
@Service
@RequiredArgsConstructor
public class S3StorageService {

    private final S3Presigner s3Presigner;
    private final S3Client s3Client;

    /*
     * Generates a cryptographic ticket allowing a frontend client to upload a file directly to S3.
     * WHY: This bypasses our backend entirely for the heavy lifting, saving us massive
     * amounts of server RAM and bandwidth.
     */
    public String generatePresignedUploadUrl(String bucket, String objectKey, String contentType, Duration duration) {
        // Step 1: Define exactly what the client is allowed to upload.
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .contentType(contentType) // Forces the client to upload exactly this file type.
                .build();

        // Step 2: Wrap it in a presign request with a strict expiration timer.
        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(duration)
                .putObjectRequest(putObjectRequest)
                .build();

        // Step 3: Ask AWS to generate the signed URL string.
        return s3Presigner.presignPutObject(presignRequest).url().toString();
    }

    /*
     * Generates a temporary, secure link to download a private file.
     * Keeps our bucket completely locked down from the public internet.
     */
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

    /*
     * Checks if a file actually exists in S3.
     * OPTIMIZATION: We use "HeadObject" instead of "GetObject". HeadObject only downloads
     * the file's metadata (a few bytes), saving us money and time compared to downloading the whole file.
     */
    public void verifyObjectExists(String bucket, String objectKey) {
        try {
            HeadObjectRequest headObjectRequest = HeadObjectRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .build();

            // If the key exists, this returns silently. If not, it throws an exception.
            s3Client.headObject(headObjectRequest);
        } catch (NoSuchKeyException ex) {
            throw new ResourceNotFoundException("Uploaded object not found in storage");
        } catch (S3Exception ex) {
            // S3 sometimes throws a generic exception with a 404 status instead of a specific NoSuchKeyException.
            if (ex.statusCode() == 404) {
                throw new ResourceNotFoundException("Uploaded object not found in storage");
            }
            throw new RuntimeException("Failed to verify uploaded object");
        }
    }

    // Issues a hard delete command to S3.
    public void deleteObject(String bucket, String objectKey) {
        DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .build();
        s3Client.deleteObject(deleteObjectRequest);
    }

    /*
     * Sometimes browsers/OS's get lazy and send files with a generic "application/octet-stream"
     * content type. If we save it like that, when users download it later, their computer won't
     * know how to open it. This manually fixes the content type based on the file extension.
     */
    public String resolveContentType(String contentType, String fileName) {
        // Step 1: If the client provided a valid, specific content type, trust it.
        if (contentType != null && !contentType.isBlank() && !"application/octet-stream".equalsIgnoreCase(contentType)) {
            return contentType;
        }

        // Step 2: Extract the extension (e.g., "report.pdf" -> "pdf").
        String extension = "";
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex >= 0 && dotIndex < fileName.length() - 1) {
            extension = fileName.substring(dotIndex + 1).toLowerCase();
        }

        // Step 3: Map the extension to the correct MIME type.
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

        // Step 4: Return the mapped type, or default back to octet-stream if unknown.
        return mimeMap.getOrDefault(extension, "application/octet-stream");
    }

    /*
     * Centralized security validation for files.
     * Putting this here ensures that whether a user uploads an Avatar or a Project Document,
     * the exact same security rules are applied.
     */
    public void validateFileRequest(String fileName, String contentType, Long fileSize,
                                    long maxBytes, Set<String> allowedTypes) {
        if (fileName == null || fileName.isBlank()) {
            throw new RuntimeException("fileName is required");
        }

        if (contentType == null || contentType.isBlank()) {
            throw new RuntimeException("contentType is required");
        }

        // Security: Prevent malicious uploads (like scripts or executables).
        if (!allowedTypes.contains(contentType)) {
            throw new RuntimeException("Unsupported file type");
        }

        // Security: Prevent server memory exhaustion attacks by enforcing strict size limits.
        if (fileSize == null || fileSize <= 0 || fileSize > maxBytes) {
            throw new RuntimeException("fileSize must be between 1 byte and " + (maxBytes / (1024 * 1024)) + "MB");
        }
    }

    /**
     * Upload raw bytes from an InputStream directly to S3 (used by the back-end proxy
     * upload path where the client sends the file to the server rather than directly
     * to S3 via a presigned URL).
     */
    public void putObject(String bucket, String objectKey, String contentType,
                          InputStream inputStream, long contentLength) {
        // Step 1: Define the target destination and metadata.
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .contentType(contentType)
                .build();

        // Step 2: Stream the bytes from our server's memory directly into the S3 bucket.
        s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(inputStream, contentLength));
    }
}
