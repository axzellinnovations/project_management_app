package com.planora.backend.service;

import com.planora.backend.model.Document;
import com.planora.backend.model.DocumentStatus;
import com.planora.backend.model.DocumentVersion;
import com.planora.backend.repository.DocumentRepository;
import com.planora.backend.repository.DocumentVersionRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Runs daily at 03:00 UTC and permanently deletes documents that have been in
 * SOFT_DELETED state for more than 30 days.
 */
@Component
@EnableScheduling
@RequiredArgsConstructor
public class DocumentCleanupScheduler {

    private static final Logger logger = LoggerFactory.getLogger(DocumentCleanupScheduler.class);

    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository documentVersionRepository;
    private final S3StorageService s3StorageService;

    @Value("${aws.s3.dms-bucket}")
    private String dmsBucket;

    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void cleanupSoftDeletedDocuments() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(30);
        List<Document> expired = documentRepository.findByStatusAndDeletedAtBefore(DocumentStatus.SOFT_DELETED, cutoff);

        if (expired.isEmpty()) {
            logger.info("DocumentCleanupScheduler: no expired soft-deleted documents found.");
            return;
        }

        int deleted = 0;
        for (Document document : expired) {
            try {
                List<DocumentVersion> versions =
                        documentVersionRepository.findByDocumentIdOrderByVersionNumberDesc(document.getId());

                for (DocumentVersion version : versions) {
                    try {
                        s3StorageService.deleteObject(dmsBucket, version.getObjectKey());
                    } catch (Exception e) {
                        logger.warn("DocumentCleanupScheduler: failed to delete S3 object {} — {}",
                                version.getObjectKey(), e.getMessage());
                    }
                }

                documentVersionRepository.deleteAll(versions);
                documentRepository.delete(document);
                deleted++;
            } catch (Exception e) {
                logger.error("DocumentCleanupScheduler: failed to permanently delete document id={} — {}",
                        document.getId(), e.getMessage());
            }
        }

        logger.info("DocumentCleanupScheduler: permanently deleted {} document(s) older than 30 days.", deleted);
    }
}
