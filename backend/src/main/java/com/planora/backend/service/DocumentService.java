package com.planora.backend.service;

import com.planora.backend.dto.*;
import com.planora.backend.model.*;
import com.planora.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private static final Logger logger = LoggerFactory.getLogger(DocumentService.class);
    private static final long MAX_FILE_SIZE_BYTES = 25L * 1024 * 1024;
    private static final Duration URL_DURATION = Duration.ofMinutes(15);
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp"
    );

    private final DocumentRepository documentRepository;
    private final DocumentVersionRepository documentVersionRepository;
    private final DocumentFolderRepository documentFolderRepository;
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final S3Presigner s3Presigner;
    private final S3Client s3Client;

    @Value("${aws.s3.dms-bucket}")
    private String dmsBucket;

    @Transactional(readOnly = true)
    public DocumentUploadInitResponseDTO initUpload(Long projectId, Long userId, DocumentUploadInitRequestDTO request) {
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);

        validateFileRequest(request.getFileName(), request.getContentType(), request.getFileSize());

        Long folderId = request.getFolderId();
        if (folderId != null) {
            resolveFolder(projectId, folderId);
        }

        String objectKey = buildObjectKey(projectId, folderId, request.getFileName());
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(dmsBucket)
                .key(objectKey)
                .contentType(request.getContentType())
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(URL_DURATION)
                .putObjectRequest(putObjectRequest)
                .build();

        String uploadUrl = s3Presigner.presignPutObject(presignRequest).url().toString();

        return DocumentUploadInitResponseDTO.builder()
                .uploadUrl(uploadUrl)
                .objectKey(objectKey)
                .expiresInSeconds(URL_DURATION.getSeconds())
                .build();
    }

    @Transactional
    public DocumentResponseDTO finalizeUpload(Long projectId, Long userId, DocumentUploadFinalizeRequestDTO request) {
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);

        validateFileRequest(request.getFileName(), request.getContentType(), request.getFileSize());
        validateObjectKeyOwnership(projectId, request.getObjectKey());
        verifyObjectExists(request.getObjectKey());

        DocumentVersion existingVersion = documentVersionRepository.findByObjectKey(request.getObjectKey()).orElse(null);
        if (existingVersion != null) {
            return mapDocument(existingVersion.getDocument(), true);
        }

        Project project = getProject(projectId);
        User uploader = getUser(userId);
        DocumentFolder folder = resolveFolder(projectId, request.getFolderId());

        Document document = new Document();
        document.setProject(project);
        document.setUploadedBy(uploader);
        document.setFolder(folder);
        document.setName(normalizeFileName(request.getFileName()));
        document.setContentType(request.getContentType());
        document.setFileSize(request.getFileSize());
        document.setLatestVersionNumber(1);
        document.setLatestObjectKey(request.getObjectKey());
        document.setStatus(DocumentStatus.ACTIVE);

        Document savedDocument = documentRepository.save(document);

        DocumentVersion version = new DocumentVersion();
        version.setDocument(savedDocument);
        version.setVersionNumber(1);
        version.setObjectKey(request.getObjectKey());
        version.setContentType(request.getContentType());
        version.setFileSize(request.getFileSize());
        version.setUploadedBy(uploader);
        documentVersionRepository.save(version);

        return mapDocument(savedDocument, true);
    }

    @Transactional(readOnly = true)
    public DocumentUploadInitResponseDTO initNewVersionUpload(Long projectId, Long documentId, Long userId, DocumentUploadInitRequestDTO request) {
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);

        Document document = getDocument(projectId, documentId);
        if (document.getStatus() == DocumentStatus.SOFT_DELETED) {
            throw new RuntimeException("Cannot upload new version for a deleted document");
        }

        validateFileRequest(request.getFileName(), request.getContentType(), request.getFileSize());

        String objectKey = buildObjectKey(projectId, document.getFolder() != null ? document.getFolder().getId() : null, request.getFileName());

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(dmsBucket)
                .key(objectKey)
                .contentType(request.getContentType())
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(URL_DURATION)
                .putObjectRequest(putObjectRequest)
                .build();

        String uploadUrl = s3Presigner.presignPutObject(presignRequest).url().toString();

        return DocumentUploadInitResponseDTO.builder()
                .uploadUrl(uploadUrl)
                .objectKey(objectKey)
                .expiresInSeconds(URL_DURATION.getSeconds())
                .build();
    }

    @Transactional
    public DocumentResponseDTO finalizeNewVersionUpload(Long projectId, Long documentId, Long userId, DocumentUploadFinalizeRequestDTO request) {
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);

        Document document = getDocument(projectId, documentId);
        if (document.getStatus() == DocumentStatus.SOFT_DELETED) {
            throw new RuntimeException("Cannot create new version for a deleted document");
        }

        validateFileRequest(request.getFileName(), request.getContentType(), request.getFileSize());
        validateObjectKeyOwnership(projectId, request.getObjectKey());
        verifyObjectExists(request.getObjectKey());

        DocumentVersion existingVersion = documentVersionRepository.findByObjectKey(request.getObjectKey()).orElse(null);
        if (existingVersion != null) {
            if (!existingVersion.getDocument().getId().equals(documentId)) {
                throw new RuntimeException("Provided object key already belongs to another document");
            }
            return mapDocument(existingVersion.getDocument(), true);
        }

        User uploader = getUser(userId);

        int nextVersion = documentVersionRepository.findTopByDocumentIdOrderByVersionNumberDesc(documentId)
                .map(v -> v.getVersionNumber() + 1)
                .orElse(document.getLatestVersionNumber() + 1);

        DocumentVersion version = new DocumentVersion();
        version.setDocument(document);
        version.setVersionNumber(nextVersion);
        version.setObjectKey(request.getObjectKey());
        version.setContentType(request.getContentType());
        version.setFileSize(request.getFileSize());
        version.setUploadedBy(uploader);
        documentVersionRepository.save(version);

        document.setLatestVersionNumber(nextVersion);
        document.setLatestObjectKey(request.getObjectKey());
        document.setContentType(request.getContentType());
        document.setFileSize(request.getFileSize());
        document.setUploadedBy(uploader);
        documentRepository.save(document);

        return mapDocument(document, true);
    }

    @Transactional(readOnly = true)
    public List<DocumentResponseDTO> listDocuments(Long projectId, Long userId, Long folderId, boolean includeDeleted) {
        getProjectMember(projectId, userId);

        List<Document> documents;
        if (folderId != null) {
            resolveFolder(projectId, folderId);
            documents = includeDeleted
                    ? documentRepository.findByProjectIdAndFolderIdOrderByCreatedAtDesc(projectId, folderId)
                    : documentRepository.findByProjectIdAndFolderIdAndStatusOrderByCreatedAtDesc(projectId, folderId, DocumentStatus.ACTIVE);
        } else {
            documents = includeDeleted
                    ? documentRepository.findByProjectIdOrderByCreatedAtDesc(projectId)
                    : documentRepository.findByProjectIdAndStatusOrderByCreatedAtDesc(projectId, DocumentStatus.ACTIVE);
        }

        return documents.stream().map(document -> mapDocument(document, true)).toList();
    }

    @Transactional(readOnly = true)
    public DocumentResponseDTO getDocumentById(Long projectId, Long documentId, Long userId) {
        getProjectMember(projectId, userId);
        return mapDocument(getDocument(projectId, documentId), true);
    }

    @Transactional(readOnly = true)
    public String getDownloadUrl(Long projectId, Long documentId, Long userId) {
        getProjectMember(projectId, userId);

        Document document = getDocument(projectId, documentId);
        if (document.getStatus() == DocumentStatus.SOFT_DELETED) {
            throw new RuntimeException("Document is deleted");
        }

        return generateDownloadUrl(document.getLatestObjectKey());
    }

    @Transactional(readOnly = true)
    public List<DocumentVersionResponseDTO> getVersions(Long projectId, Long documentId, Long userId) {
        getProjectMember(projectId, userId);
        getDocument(projectId, documentId);

        return documentVersionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId)
                .stream()
                .map(this::mapVersion)
                .toList();
    }

    @Transactional
    public DocumentResponseDTO updateMetadata(Long projectId, Long documentId, Long userId, DocumentMetadataUpdateRequestDTO request) {
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);

        Document document = getDocument(projectId, documentId);
        if (document.getStatus() == DocumentStatus.SOFT_DELETED) {
            throw new RuntimeException("Cannot update deleted document");
        }

        if (request.getName() != null && !request.getName().isBlank()) {
            document.setName(normalizeFileName(request.getName()));
        }

        if (request.getFolderId() != null) {
            DocumentFolder folder = resolveFolder(projectId, request.getFolderId());
            document.setFolder(folder);
        }

        documentRepository.save(document);
        return mapDocument(document, true);
    }

    @Transactional
    public void softDelete(Long projectId, Long documentId, Long userId) {
        TeamMember member = getProjectMember(projectId, userId);
        requireOwnerOrAdmin(member);

        Document document = getDocument(projectId, documentId);
        if (document.getStatus() == DocumentStatus.SOFT_DELETED) {
            return;
        }

        document.setStatus(DocumentStatus.SOFT_DELETED);
        document.setDeletedAt(LocalDateTime.now());
        documentRepository.save(document);
    }

    @Transactional
    public DocumentResponseDTO restore(Long projectId, Long documentId, Long userId) {
        TeamMember member = getProjectMember(projectId, userId);
        requireOwnerOrAdmin(member);

        Document document = getDocument(projectId, documentId);
        document.setStatus(DocumentStatus.ACTIVE);
        document.setDeletedAt(null);
        documentRepository.save(document);

        return mapDocument(document, true);
    }

    @Transactional
    public void permanentDelete(Long projectId, Long documentId, Long userId) {
        TeamMember member = getProjectMember(projectId, userId);
        requireOwnerOrAdmin(member);

        Document document = getDocument(projectId, documentId);
        List<DocumentVersion> versions = documentVersionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId);

        for (DocumentVersion version : versions) {
            try {
                DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                        .bucket(dmsBucket)
                        .key(version.getObjectKey())
                        .build();
                s3Client.deleteObject(deleteObjectRequest);
            } catch (Exception e) {
                logger.warn("Failed to delete object from S3 for key {}: {}", version.getObjectKey(), e.getMessage());
            }
        }

        documentVersionRepository.deleteAll(versions);
        documentRepository.delete(document);
    }

    @Transactional
    public DocumentFolderResponseDTO createFolder(Long projectId, Long userId, DocumentFolderCreateRequestDTO request) {
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);

        Project project = getProject(projectId);
        User user = getUser(userId);
        DocumentFolder parent = resolveFolder(projectId, request.getParentFolderId());
        String normalizedName = normalizeFolderName(request.getName());

        boolean exists = documentFolderRepository.existsByProjectIdAndParentFolderIdAndNameIgnoreCaseAndDeletedAtIsNull(
                projectId,
                parent != null ? parent.getId() : null,
                normalizedName
        );
        if (exists) {
            throw new RuntimeException("A folder with the same name already exists at this level");
        }

        DocumentFolder folder = new DocumentFolder();
        folder.setName(normalizedName);
        folder.setProject(project);
        folder.setParentFolder(parent);
        folder.setCreatedBy(user);

        return mapFolder(documentFolderRepository.save(folder));
    }

    @Transactional(readOnly = true)
    public List<DocumentFolderResponseDTO> listFolders(Long projectId, Long userId) {
        getProjectMember(projectId, userId);
        return documentFolderRepository.findByProjectIdAndDeletedAtIsNullOrderByCreatedAtAsc(projectId)
                .stream()
                .map(this::mapFolder)
                .toList();
    }

    @Transactional
    public DocumentFolderResponseDTO updateFolder(Long projectId, Long folderId, Long userId, DocumentFolderUpdateRequestDTO request) {
        TeamMember member = getProjectMember(projectId, userId);
        requireNotViewer(member);

        DocumentFolder folder = resolveFolder(projectId, folderId);
        String normalizedName = normalizeFolderName(request.getName());

        DocumentFolder parent = null;
        if (request.getParentFolderId() != null) {
            parent = resolveFolder(projectId, request.getParentFolderId());
            if (parent.getId().equals(folderId)) {
                throw new RuntimeException("Folder cannot be its own parent");
            }
        }

        boolean exists = documentFolderRepository.existsByProjectIdAndParentFolderIdAndNameIgnoreCaseAndDeletedAtIsNull(
                projectId,
                parent != null ? parent.getId() : null,
                normalizedName
        );

        if (exists && !(normalizedName.equalsIgnoreCase(folder.getName())
                && ((folder.getParentFolder() == null && parent == null)
                || (folder.getParentFolder() != null && parent != null && folder.getParentFolder().getId().equals(parent.getId()))))) {
            throw new RuntimeException("A folder with the same name already exists at this level");
        }

        folder.setName(normalizedName);
        folder.setParentFolder(parent);
        return mapFolder(documentFolderRepository.save(folder));
    }

    @Transactional
    public void deleteFolder(Long projectId, Long folderId, Long userId) {
        TeamMember member = getProjectMember(projectId, userId);
        requireOwnerOrAdmin(member);

        DocumentFolder folder = resolveFolder(projectId, folderId);

        long childFolders = documentFolderRepository.countByParentFolderIdAndDeletedAtIsNull(folderId);
        if (childFolders > 0) {
            throw new RuntimeException("Cannot delete folder with child folders");
        }

        long activeDocs = documentRepository.countByFolderIdAndStatus(folderId, DocumentStatus.ACTIVE);
        if (activeDocs > 0) {
            throw new RuntimeException("Cannot delete folder with active documents");
        }

        folder.setDeletedAt(LocalDateTime.now());
        documentFolderRepository.save(folder);
    }

    private TeamMember getProjectMember(Long projectId, Long userId) {
        Project project = getProject(projectId);
        return teamMemberRepository.findByTeamIdAndUserUserId(project.getTeam().getId(), userId)
                .orElseThrow(() -> new AccessDeniedException("You are not a member of this project team"));
    }

    private void requireNotViewer(TeamMember member) {
        if (member.getRole() == TeamRole.VIEWER) {
            throw new AccessDeniedException("Viewer role does not have permission for this action");
        }
    }

    private void requireOwnerOrAdmin(TeamMember member) {
        if (member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.ADMIN) {
            throw new AccessDeniedException("Only OWNER or ADMIN can perform this action");
        }
    }

    private void validateFileRequest(String fileName, String contentType, Long fileSize) {
        if (fileName == null || fileName.isBlank()) {
            throw new RuntimeException("fileName is required");
        }

        if (contentType == null || contentType.isBlank()) {
            throw new RuntimeException("contentType is required");
        }

        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new RuntimeException("Unsupported file type");
        }

        if (fileSize == null || fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
            throw new RuntimeException("fileSize must be between 1 byte and 25MB");
        }
    }

    private String buildObjectKey(Long projectId, Long folderId, String fileName) {
        String safeName = normalizeFileName(fileName).replace(" ", "_");
        String folderPart = folderId != null ? "folder-" + folderId : "root";
        return "project-" + projectId + "/" + folderPart + "/" + UUID.randomUUID() + "-" + safeName;
    }

    private String normalizeFileName(String fileName) {
        String trimmed = fileName.trim();
        String withoutPath = trimmed.replace("\\", "/");
        String nameOnly = withoutPath.substring(withoutPath.lastIndexOf("/") + 1);
        if (nameOnly.isBlank()) {
            throw new RuntimeException("Invalid file name");
        }
        return nameOnly;
    }

    private String normalizeFolderName(String name) {
        String normalized = name == null ? "" : name.trim();
        if (normalized.isBlank()) {
            throw new RuntimeException("Folder name is required");
        }
        return normalized;
    }

    private void validateObjectKeyOwnership(Long projectId, String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            throw new RuntimeException("objectKey is required");
        }

        String expectedPrefix = "project-" + projectId + "/";
        if (!objectKey.startsWith(expectedPrefix)) {
            throw new RuntimeException("Invalid object key for this project");
        }
    }

    private void verifyObjectExists(String objectKey) {
        try {
            HeadObjectRequest headObjectRequest = HeadObjectRequest.builder()
                    .bucket(dmsBucket)
                    .key(objectKey)
                    .build();
            s3Client.headObject(headObjectRequest);
        } catch (NoSuchKeyException ex) {
            throw new RuntimeException("Uploaded object not found in storage");
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) {
                throw new RuntimeException("Uploaded object not found in storage");
            }
            throw new RuntimeException("Failed to verify uploaded object");
        }
    }

    private String generateDownloadUrl(String objectKey) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(dmsBucket)
                .key(objectKey)
                .build();

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(URL_DURATION)
                .getObjectRequest(getObjectRequest)
                .build();

        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    private Project getProject(Long projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found with id: " + projectId));
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + userId));
    }

    private Document getDocument(Long projectId, Long documentId) {
        return documentRepository.findByIdAndProjectId(documentId, projectId)
                .orElseThrow(() -> new RuntimeException("Document not found with id: " + documentId));
    }

    private DocumentFolder resolveFolder(Long projectId, Long folderId) {
        if (folderId == null) {
            return null;
        }

        DocumentFolder folder = documentFolderRepository.findByIdAndProjectId(folderId, projectId)
                .orElseThrow(() -> new RuntimeException("Folder not found with id: " + folderId));

        if (folder.getDeletedAt() != null) {
            throw new RuntimeException("Folder is deleted");
        }

        return folder;
    }

    private DocumentResponseDTO mapDocument(Document document, boolean includeDownloadUrl) {
        return DocumentResponseDTO.builder()
                .id(document.getId())
                .name(document.getName())
                .contentType(document.getContentType())
                .fileSize(document.getFileSize())
                .status(document.getStatus())
                .projectId(document.getProject().getId())
                .folderId(document.getFolder() != null ? document.getFolder().getId() : null)
                .latestVersionNumber(document.getLatestVersionNumber())
                .downloadUrl(includeDownloadUrl && document.getStatus() == DocumentStatus.ACTIVE
                        ? generateDownloadUrl(document.getLatestObjectKey())
                        : null)
                .uploadedById(document.getUploadedBy().getUserId())
                .uploadedByName(document.getUploadedBy().getUsername())
                .createdAt(document.getCreatedAt())
                .updatedAt(document.getUpdatedAt())
                .deletedAt(document.getDeletedAt())
                .build();
    }

    private DocumentVersionResponseDTO mapVersion(DocumentVersion version) {
        return DocumentVersionResponseDTO.builder()
                .id(version.getId())
                .versionNumber(version.getVersionNumber())
                .contentType(version.getContentType())
                .fileSize(version.getFileSize())
                .uploadedById(version.getUploadedBy().getUserId())
                .uploadedByName(version.getUploadedBy().getUsername())
                .uploadedAt(version.getCreatedAt())
                .downloadUrl(generateDownloadUrl(version.getObjectKey()))
                .build();
    }

    private DocumentFolderResponseDTO mapFolder(DocumentFolder folder) {
        return DocumentFolderResponseDTO.builder()
                .id(folder.getId())
                .name(folder.getName())
                .projectId(folder.getProject().getId())
                .parentFolderId(folder.getParentFolder() != null ? folder.getParentFolder().getId() : null)
                .createdById(folder.getCreatedBy().getUserId())
                .createdAt(folder.getCreatedAt())
                .updatedAt(folder.getUpdatedAt())
                .build();
    }
}
