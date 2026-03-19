package com.planora.backend.repository;

import com.planora.backend.model.Document;
import com.planora.backend.model.DocumentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findByProjectIdAndStatusOrderByCreatedAtDesc(Long projectId, DocumentStatus status);

    List<Document> findByProjectIdOrderByCreatedAtDesc(Long projectId);

    List<Document> findByProjectIdAndFolderIdAndStatusOrderByCreatedAtDesc(Long projectId, Long folderId, DocumentStatus status);

    List<Document> findByProjectIdAndFolderIdOrderByCreatedAtDesc(Long projectId, Long folderId);

    Optional<Document> findByIdAndProjectId(Long id, Long projectId);

    long countByFolderIdAndStatus(Long folderId, DocumentStatus status);
}
