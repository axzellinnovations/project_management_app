package com.planora.backend.repository;

import com.planora.backend.model.DocumentFolder;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentFolderRepository extends JpaRepository<DocumentFolder, Long> {
    @EntityGraph(attributePaths = {"createdBy"})
    List<DocumentFolder> findByProjectIdAndDeletedAtIsNullOrderByCreatedAtAsc(Long projectId);

    boolean existsByProjectIdAndParentFolderIdAndNameIgnoreCaseAndDeletedAtIsNull(Long projectId, Long parentFolderId, String name);

    Optional<DocumentFolder> findByIdAndProjectId(Long id, Long projectId);

    long countByParentFolderIdAndDeletedAtIsNull(Long folderId);

    List<DocumentFolder> findByParentFolderIdAndDeletedAtIsNull(Long parentFolderId);
}
