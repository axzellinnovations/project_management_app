package com.planora.backend.service;

import java.time.Duration;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import lombok.RequiredArgsConstructor;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

@Service
@RequiredArgsConstructor
public class ChatDocumentService {
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    @Value("${aws.s3.chat-bucket:planaro-chat}")
    private String chatBucket;

    // Pre-signed URL valid for 15 minutes
    private static final Duration URL_DURATION = Duration.ofMinutes(15);

    public String uploadChatDocument(MultipartFile file, String key) {
        try {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(chatBucket)
                    .key(key)
                    .contentType(file.getContentType())
                    .build();
            s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

            // Generate pre-signed URL for download
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(chatBucket)
                    .key(key)
                    .build();
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(URL_DURATION)
                    .getObjectRequest(getObjectRequest)
                    .build();
            return s3Presigner.presignGetObject(presignRequest).url().toString();
        } catch (Exception e) {
            throw new RuntimeException("Failed to upload chat document", e);
        }
    }

    public String refreshPresignedUrl(String expiredUrl) {
        try {
            URL url = new URL(expiredUrl);
            String path = url.getPath();
            
            // Remove leading slash if present
            if (path.startsWith("/")) {
                path = path.substring(1);
            }
            
            // The path might contain the bucket name depending on how S3 is configured
            // e.g. /planaro-chat/19/... vs /19/...
            String key = URLDecoder.decode(path, StandardCharsets.UTF_8.name());
            if (key.startsWith(chatBucket + "/")) {
                key = key.substring(chatBucket.length() + 1);
            }

            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(chatBucket)
                    .key(key)
                    .build();
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(URL_DURATION)
                    .getObjectRequest(getObjectRequest)
                    .build();
            return s3Presigner.presignGetObject(presignRequest).url().toString();
        } catch (Exception e) {
            throw new RuntimeException("Failed to refresh chat document URL", e);
        }
    }
}
