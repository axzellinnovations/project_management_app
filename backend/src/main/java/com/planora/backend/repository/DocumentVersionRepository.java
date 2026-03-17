package com.planora.backend.repository;

import com.planora.backend.model.DocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, Long> {
    List<DocumentVersion> findByDocumentIdOrderByVersionNumberDesc(Long documentId);

    Optional<DocumentVersion> findByObjectKey(String objectKey);

    Optional<DocumentVersion> findTopByDocumentIdOrderByVersionNumberDesc(Long documentId);
}
