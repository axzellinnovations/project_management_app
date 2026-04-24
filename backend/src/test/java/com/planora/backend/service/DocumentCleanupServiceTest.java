package com.planora.backend.service;

import com.planora.backend.model.Document;
import com.planora.backend.model.DocumentStatus;
import com.planora.backend.model.DocumentVersion;
import com.planora.backend.repository.DocumentRepository;
import com.planora.backend.repository.DocumentVersionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentCleanupServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private DocumentVersionRepository documentVersionRepository;

    @Mock
    private S3StorageService s3StorageService;

    @InjectMocks
    private DocumentCleanupScheduler documentCleanupScheduler;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(documentCleanupScheduler, "dmsBucket", "test-dms-bucket");
    }

    @Test
    void cleanupSoftDeletedDocuments_doesNothingWhenNoExpiredDocs() {
        when(documentRepository.findByStatusAndDeletedAtBefore(eq(DocumentStatus.SOFT_DELETED), any()))
                .thenReturn(List.of());

        documentCleanupScheduler.cleanupSoftDeletedDocuments();

        verify(documentRepository, never()).delete(any());
        verifyNoInteractions(s3StorageService);
    }

    @Test
    void cleanupSoftDeletedDocuments_deletesExpiredDocumentsAndS3Objects() {
        Document doc = new Document();
        doc.setId(1L);
        doc.setStatus(DocumentStatus.SOFT_DELETED);
        doc.setDeletedAt(LocalDateTime.now().minusDays(31));

        DocumentVersion version = new DocumentVersion();
        version.setId(1L);
        version.setObjectKey("project-10/uuid-spec.pdf");

        when(documentRepository.findByStatusAndDeletedAtBefore(eq(DocumentStatus.SOFT_DELETED), any()))
                .thenReturn(List.of(doc));
        when(documentVersionRepository.findByDocumentIdOrderByVersionNumberDesc(1L))
                .thenReturn(List.of(version));
        doNothing().when(s3StorageService).deleteObject(anyString(), anyString());
        doNothing().when(documentVersionRepository).deleteAll(anyList());
        doNothing().when(documentRepository).delete(any());

        documentCleanupScheduler.cleanupSoftDeletedDocuments();

        verify(s3StorageService).deleteObject("test-dms-bucket", "project-10/uuid-spec.pdf");
        verify(documentVersionRepository).deleteAll(List.of(version));
        verify(documentRepository).delete(doc);
    }

    @Test
    void cleanupSoftDeletedDocuments_continuesWhenS3DeleteFails() {
        Document doc = new Document();
        doc.setId(1L);
        doc.setStatus(DocumentStatus.SOFT_DELETED);
        doc.setDeletedAt(LocalDateTime.now().minusDays(31));

        DocumentVersion version = new DocumentVersion();
        version.setId(1L);
        version.setObjectKey("broken-key");

        when(documentRepository.findByStatusAndDeletedAtBefore(eq(DocumentStatus.SOFT_DELETED), any()))
                .thenReturn(List.of(doc));
        when(documentVersionRepository.findByDocumentIdOrderByVersionNumberDesc(1L))
                .thenReturn(List.of(version));
        doThrow(new RuntimeException("S3 unavailable"))
                .when(s3StorageService).deleteObject(anyString(), eq("broken-key"));
        doNothing().when(documentVersionRepository).deleteAll(anyList());
        doNothing().when(documentRepository).delete(any());

        // Should not throw — S3 errors are swallowed per cleanup logic
        documentCleanupScheduler.cleanupSoftDeletedDocuments();

        verify(documentRepository).delete(doc);
    }
}
