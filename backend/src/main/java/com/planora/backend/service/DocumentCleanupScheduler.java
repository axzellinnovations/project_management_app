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
 *  the SOFT_DELETED state for more than 30 days.
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

    /*
     * Executes the cleanup job.
     * CRON Expression ("0 0 3 * * *"): Runs exactly at 3:00 AM UTC every day.
     * We run this off-hours to prevent the heavy database deletes and S3 API calls
     * from slowing down the system during peak user activity.
     */
    @Scheduled(cron = "0 0 3 * * *")
    // Note: We use @Transactional here so if the DB crashes mid-delete,
    // we don't end up with orphaned versions.
    @Transactional
    public void cleanupSoftDeletedDocuments() {
        // Step 1. Define the cutoff threshold. Anything deleted at this exact moment ago
        // 30 days ago is marked for permanent execution.
        LocalDateTime cutoff = LocalDateTime.now().minusDays(30);

        // Step 2. Query the database for the execution list.
        List<Document> expired = documentRepository.findByStatusAndDeletedAtBefore(DocumentStatus.SOFT_DELETED, cutoff);

        // Step 3. Quick exit if the trash is empty. Saves processing power.
        if (expired.isEmpty()) {
            logger.info("DocumentCleanupScheduler: no expired soft-deleted documents found.");
            return;
        }

        int deleted = 0;

        // Step 4. Iterate through the expired documents.
        for (Document document : expired) {

            // FAULT TOLERANCE: Notice the try-catch INSIDE the loop.
            // If one document fails to delete (e.g., database lock), we catch the error,
            // log it, and move on to the next document. We DO NOT want one bad file
            // to crash the entire nightly cleanup job.
            try {
                // Step 5. Fetch all historical versions of this document.
                // We have to delete the physical files for EVERY version, not just the latest.
                List<DocumentVersion> versions =
                        documentVersionRepository.findByDocumentIdOrderByVersionNumberDesc(document.getId());

                for (DocumentVersion version : versions) {
                    try {
                        // Step 6. Physically delete the file from AWS S3.
                        s3StorageService.deleteObject(dmsBucket, version.getObjectKey());
                    } catch (Exception e) {
                        // We swallow S3 exceptions here. If the file is already gone from S3
                        // (maybe an admin deleted it manually), we still want to proceed
                        // and clean up the database records below.
                        logger.warn("DocumentCleanupScheduler: failed to delete S3 object {} — {}",
                                version.getObjectKey(), e.getMessage());
                    }
                }

                // Step 7. Wipe the database records.
                // We must delete the child versions FIRST to satisfy foreign key constraints,
                // then we delete the parent Document record.
                documentVersionRepository.deleteAll(versions);
                documentRepository.delete(document);
                deleted++;

            } catch (Exception e) {
                logger.error("DocumentCleanupScheduler: failed to permanently delete document id={} — {}",
                        document.getId(), e.getMessage());
            }
        }

        // Step 8. Log the final tally for the DevOps monitoring dashboards.
        logger.info("DocumentCleanupScheduler: permanently deleted {} document(s) older than 30 days.", deleted);
    }
}
