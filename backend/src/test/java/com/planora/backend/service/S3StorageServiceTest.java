package com.planora.backend.service;

import com.planora.backend.exception.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.ByteArrayInputStream;
import java.net.MalformedURLException;
import java.net.URL;
import java.time.Duration;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class S3StorageServiceTest {

    @Mock
    private S3Presigner s3Presigner;

    @Mock
    private S3Client s3Client;

    @InjectMocks
    private S3StorageService s3StorageService;

    @Test
    void generatePresignedUploadUrl_returnsUrlString() throws MalformedURLException {
        PresignedPutObjectRequest presignedRequest = mock(PresignedPutObjectRequest.class);
        when(presignedRequest.url()).thenReturn(new URL("https://s3.example.com/presigned-put?sig=abc"));
        when(s3Presigner.presignPutObject(any(PutObjectPresignRequest.class))).thenReturn(presignedRequest);

        String url = s3StorageService.generatePresignedUploadUrl("my-bucket", "key.pdf", "application/pdf", Duration.ofMinutes(15));

        assertEquals("https://s3.example.com/presigned-put?sig=abc", url);
    }

    @Test
    void generatePresignedDownloadUrl_returnsUrlString() throws MalformedURLException {
        PresignedGetObjectRequest presignedRequest = mock(PresignedGetObjectRequest.class);
        when(presignedRequest.url()).thenReturn(new URL("https://s3.example.com/presigned-get?sig=abc"));
        when(s3Presigner.presignGetObject(any(GetObjectPresignRequest.class))).thenReturn(presignedRequest);

        String url = s3StorageService.generatePresignedDownloadUrl("my-bucket", "key.pdf", Duration.ofMinutes(15));

        assertEquals("https://s3.example.com/presigned-get?sig=abc", url);
    }

    @Test
    void verifyObjectExists_doesNotThrowWhenObjectExists() {
        when(s3Client.headObject(any(HeadObjectRequest.class))).thenReturn(HeadObjectResponse.builder().build());

        assertDoesNotThrow(() -> s3StorageService.verifyObjectExists("my-bucket", "key.pdf"));
    }

    @Test
    void verifyObjectExists_throwsResourceNotFoundException_whenKeyMissing() {
        when(s3Client.headObject(any(HeadObjectRequest.class))).thenThrow(NoSuchKeyException.builder().build());

        assertThrows(ResourceNotFoundException.class,
                () -> s3StorageService.verifyObjectExists("my-bucket", "missing.pdf"));
    }

    @Test
    void deleteObject_callsS3ClientDelete() {
        when(s3Client.deleteObject(any(DeleteObjectRequest.class))).thenReturn(DeleteObjectResponse.builder().build());

        assertDoesNotThrow(() -> s3StorageService.deleteObject("my-bucket", "key.pdf"));
        verify(s3Client).deleteObject(any(DeleteObjectRequest.class));
    }

    @Test
    void resolveContentType_returnsMappedType_forKnownExtension() {
        String contentType = s3StorageService.resolveContentType("application/octet-stream", "report.pdf");
        assertEquals("application/pdf", contentType);
    }

    @Test
    void resolveContentType_returnsOriginalContentType_whenNotOctetStream() {
        String contentType = s3StorageService.resolveContentType("image/jpeg", "photo.jpg");
        assertEquals("image/jpeg", contentType);
    }

    @Test
    void resolveContentType_returnsOctetStream_forUnknownExtension() {
        String contentType = s3StorageService.resolveContentType("application/octet-stream", "file.xyz");
        assertEquals("application/octet-stream", contentType);
    }

    @Test
    void validateFileRequest_throwsWhenFileNameBlank() {
        assertThrows(RuntimeException.class, () ->
                s3StorageService.validateFileRequest("", "application/pdf", 100L,
                        10_000_000L, Set.of("application/pdf")));
    }

    @Test
    void validateFileRequest_throwsWhenContentTypeNotAllowed() {
        assertThrows(RuntimeException.class, () ->
                s3StorageService.validateFileRequest("file.pdf", "application/exe", 100L,
                        10_000_000L, Set.of("application/pdf")));
    }

    @Test
    void validateFileRequest_throwsWhenFileSizeExceedsMax() {
        assertThrows(RuntimeException.class, () ->
                s3StorageService.validateFileRequest("file.pdf", "application/pdf", 50_000_000L,
                        10_000_000L, Set.of("application/pdf")));
    }

    @Test
    void validateFileRequest_doesNotThrowForValidRequest() {
        assertDoesNotThrow(() ->
                s3StorageService.validateFileRequest("file.pdf", "application/pdf", 500_000L,
                        10_000_000L, Set.of("application/pdf")));
    }
}
