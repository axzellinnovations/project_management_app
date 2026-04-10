package com.planora.backend.service;

import com.planora.backend.dto.DocumentFolderCreateRequestDTO;
import com.planora.backend.dto.DocumentFolderResponseDTO;
import com.planora.backend.dto.DocumentResponseDTO;
import com.planora.backend.dto.DocumentUploadFinalizeRequestDTO;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.Document;
import com.planora.backend.model.DocumentFolder;
import com.planora.backend.model.DocumentStatus;
import com.planora.backend.model.DocumentVersion;
import com.planora.backend.model.Project;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.DocumentFolderRepository;
import com.planora.backend.repository.DocumentRepository;
import com.planora.backend.repository.DocumentVersionRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentServiceTest {

    @Mock
    private DocumentRepository documentRepository;
    @Mock
    private DocumentVersionRepository documentVersionRepository;
    @Mock
    private DocumentFolderRepository documentFolderRepository;
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private TeamMemberRepository teamMemberRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private S3StorageService s3StorageService;

    @InjectMocks
    private DocumentService documentService;

    private Project project;

    @BeforeEach
    void setUp() {
        Team team = new Team();
        team.setId(12L);

        project = new Project();
        project.setId(5L);
        project.setTeam(team);
    }

    @Test
    void createFolder_normalizesNameAndPersists() {
        TeamMember member = new TeamMember();
        member.setRole(TeamRole.MEMBER);

        User user = new User();
        user.setUserId(55L);

        DocumentFolderCreateRequestDTO request = new DocumentFolderCreateRequestDTO();
        request.setName("  Product Docs  ");

        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(12L, 55L)).thenReturn(Optional.of(member));
        when(userRepository.findById(55L)).thenReturn(Optional.of(user));
        when(documentFolderRepository.existsByProjectIdAndParentFolderIdAndNameIgnoreCaseAndDeletedAtIsNull(5L, null, "Product Docs"))
                .thenReturn(false);
        when(documentFolderRepository.save(any(DocumentFolder.class))).thenAnswer(invocation -> {
            DocumentFolder folder = invocation.getArgument(0);
            folder.setId(999L);
            return folder;
        });

        DocumentFolderResponseDTO result = documentService.createFolder(5L, 55L, request);

        assertEquals(999L, result.getId());
        assertEquals("Product Docs", result.getName());
        assertEquals(5L, result.getProjectId());
    }

    @Test
    void createFolder_viewerDenied() {
        TeamMember viewer = new TeamMember();
        viewer.setRole(TeamRole.VIEWER);

        DocumentFolderCreateRequestDTO request = new DocumentFolderCreateRequestDTO();
        request.setName("Docs");

        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(12L, 55L)).thenReturn(Optional.of(viewer));

        AccessDeniedException exception = assertThrows(AccessDeniedException.class,
                () -> documentService.createFolder(5L, 55L, request));

        assertEquals("Viewer role does not have permission for this action", exception.getMessage());
    }

    @Test
    void deleteFolder_withActiveDocuments_cascadesSoftDeletes() {
        TeamMember admin = new TeamMember();
        admin.setRole(TeamRole.ADMIN);

        DocumentFolder folder = new DocumentFolder();
        folder.setId(300L);
        folder.setProject(project);

        User uploader = new User();
        uploader.setUserId(55L);

        Document activeDoc = new Document();
        activeDoc.setId(1L);
        activeDoc.setStatus(DocumentStatus.ACTIVE);
        activeDoc.setProject(project);
        activeDoc.setUploadedBy(uploader);

        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(12L, 55L)).thenReturn(Optional.of(admin));
        when(documentFolderRepository.findByIdAndProjectId(300L, 5L)).thenReturn(Optional.of(folder));
        when(documentFolderRepository.findByParentFolderIdAndDeletedAtIsNull(300L)).thenReturn(List.of());
        when(documentRepository.findByFolderIdAndStatus(300L, DocumentStatus.ACTIVE)).thenReturn(List.of(activeDoc));

        assertDoesNotThrow(() -> documentService.deleteFolder(5L, 300L, 55L));

        assertEquals(DocumentStatus.SOFT_DELETED, activeDoc.getStatus());
        assertNotNull(activeDoc.getDeletedAt());
        verify(documentRepository).saveAll(List.of(activeDoc));
        verify(documentFolderRepository).save(folder);
    }

    @Test
    void deleteFolder_withChildFolders_cascadesRecursively() {
        TeamMember admin = new TeamMember();
        admin.setRole(TeamRole.ADMIN);

        DocumentFolder parent = new DocumentFolder();
        parent.setId(300L);
        parent.setProject(project);

        DocumentFolder child = new DocumentFolder();
        child.setId(301L);
        child.setProject(project);

        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(12L, 55L)).thenReturn(Optional.of(admin));
        when(documentFolderRepository.findByIdAndProjectId(300L, 5L)).thenReturn(Optional.of(parent));
        when(documentFolderRepository.findByParentFolderIdAndDeletedAtIsNull(300L)).thenReturn(List.of(child));
        when(documentFolderRepository.findByParentFolderIdAndDeletedAtIsNull(301L)).thenReturn(List.of());
        when(documentRepository.findByFolderIdAndStatus(300L, DocumentStatus.ACTIVE)).thenReturn(List.of());
        when(documentRepository.findByFolderIdAndStatus(301L, DocumentStatus.ACTIVE)).thenReturn(List.of());

        assertDoesNotThrow(() -> documentService.deleteFolder(5L, 300L, 55L));

        assertNotNull(child.getDeletedAt());
        assertNotNull(parent.getDeletedAt());
        verify(documentFolderRepository, times(2)).save(any(DocumentFolder.class));
    }

    @Test
    void finalizeUpload_withDuplicateObjectKey_returnsExistingDocument() {
        TeamMember member = new TeamMember();
        member.setRole(TeamRole.MEMBER);

        User uploader = new User();
        uploader.setUserId(55L);
        uploader.setUsername("alice");

        Document existingDoc = new Document();
        existingDoc.setId(42L);
        existingDoc.setName("file.pdf");
        existingDoc.setStatus(DocumentStatus.ACTIVE);
        existingDoc.setProject(project);
        existingDoc.setUploadedBy(uploader);
        existingDoc.setLatestObjectKey("project-5/root/uuid-file.pdf");
        existingDoc.setLatestVersionNumber(1);

        DocumentVersion existingVersion = new DocumentVersion();
        existingVersion.setDocument(existingDoc);
        existingVersion.setVersionNumber(1);
        existingVersion.setObjectKey("project-5/root/uuid-file.pdf");
        existingVersion.setUploadedBy(uploader);

        DocumentUploadFinalizeRequestDTO request = new DocumentUploadFinalizeRequestDTO();
        request.setFileName("file.pdf");
        request.setContentType("application/pdf");
        request.setFileSize(1024L);
        request.setObjectKey("project-5/root/uuid-file.pdf");

        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(12L, 55L)).thenReturn(Optional.of(member));
        doNothing().when(s3StorageService).validateFileRequest(any(), any(), any(), anyLong(), any());
        doNothing().when(s3StorageService).verifyObjectExists(any(), any());
        when(documentVersionRepository.findByObjectKey("project-5/root/uuid-file.pdf")).thenReturn(Optional.of(existingVersion));

        DocumentResponseDTO result = documentService.finalizeUpload(5L, 55L, request);

        assertEquals(42L, result.getId());
        verify(documentRepository, never()).save(any());
    }

    @Test
    void softDelete_onAlreadyDeletedDocument_returnsWithoutError() {
        TeamMember admin = new TeamMember();
        admin.setRole(TeamRole.ADMIN);

        User uploader = new User();
        uploader.setUserId(55L);

        Document deletedDoc = new Document();
        deletedDoc.setId(10L);
        deletedDoc.setStatus(DocumentStatus.SOFT_DELETED);
        deletedDoc.setDeletedAt(LocalDateTime.now().minusDays(1));
        deletedDoc.setProject(project);
        deletedDoc.setUploadedBy(uploader);

        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(12L, 55L)).thenReturn(Optional.of(admin));
        when(documentRepository.findByIdAndProjectId(10L, 5L)).thenReturn(Optional.of(deletedDoc));

        assertDoesNotThrow(() -> documentService.softDelete(5L, 10L, 55L));
        verify(documentRepository, never()).save(any());
    }

    @Test
    void permanentDelete_callsS3DeleteForEachVersionAndRemovesRecords() {
        TeamMember admin = new TeamMember();
        admin.setRole(TeamRole.ADMIN);

        User uploader = new User();
        uploader.setUserId(55L);

        Document doc = new Document();
        doc.setId(20L);
        doc.setStatus(DocumentStatus.SOFT_DELETED);
        doc.setProject(project);
        doc.setUploadedBy(uploader);

        DocumentVersion v1 = new DocumentVersion();
        v1.setObjectKey("project-5/root/uuid-v1.pdf");
        v1.setUploadedBy(uploader);

        DocumentVersion v2 = new DocumentVersion();
        v2.setObjectKey("project-5/root/uuid-v2.pdf");
        v2.setUploadedBy(uploader);

        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(12L, 55L)).thenReturn(Optional.of(admin));
        when(documentRepository.findByIdAndProjectId(20L, 5L)).thenReturn(Optional.of(doc));
        when(documentVersionRepository.findByDocumentIdOrderByVersionNumberDesc(20L)).thenReturn(List.of(v1, v2));

        assertDoesNotThrow(() -> documentService.permanentDelete(5L, 20L, 55L));

        verify(s3StorageService).deleteObject(any(), eq("project-5/root/uuid-v1.pdf"));
        verify(s3StorageService).deleteObject(any(), eq("project-5/root/uuid-v2.pdf"));
        verify(documentVersionRepository).deleteAll(List.of(v1, v2));
        verify(documentRepository).delete(doc);
    }

    @Test
    void getDownloadUrl_whenObjectMissingInS3_throwsDescriptiveException() {
        TeamMember member = new TeamMember();
        member.setRole(TeamRole.MEMBER);

        User uploader = new User();
        uploader.setUserId(55L);

        Document doc = new Document();
        doc.setId(10L);
        doc.setStatus(DocumentStatus.ACTIVE);
        doc.setProject(project);
        doc.setUploadedBy(uploader);
        doc.setLatestObjectKey("project-5/root/uuid-file.pdf");

        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(12L, 55L)).thenReturn(Optional.of(member));
        when(documentRepository.findByIdAndProjectId(10L, 5L)).thenReturn(Optional.of(doc));
        doThrow(new ResourceNotFoundException("Uploaded object not found in storage"))
                .when(s3StorageService).verifyObjectExists(any(), anyString());

        ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class,
                () -> documentService.getDownloadUrl(5L, 10L, 55L));

        assertTrue(ex.getMessage().contains("no longer available in storage"),
                "Should return a user-friendly message about the missing file");
        verify(s3StorageService, never()).generatePresignedDownloadUrl(any(), any(), any());
    }

    @Test
    void uploadDocumentViaBackend_delegatesToS3StorageService() throws Exception {
        TeamMember member = new TeamMember();
        member.setRole(TeamRole.MEMBER);

        User uploader = new User();
        uploader.setUserId(55L);
        uploader.setUsername("alice");

        byte[] content = "PDF content".getBytes();
        MockMultipartFile file = new MockMultipartFile(
                "file", "report.pdf", "application/pdf", content);

        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(12L, 55L)).thenReturn(Optional.of(member));
        when(s3StorageService.resolveContentType(anyString(), anyString())).thenReturn("application/pdf");
        doNothing().when(s3StorageService).validateFileRequest(any(), any(), any(), anyLong(), any());
        doNothing().when(s3StorageService).putObject(any(), anyString(), any(), any(), anyLong());
        doNothing().when(s3StorageService).verifyObjectExists(any(), anyString());
        when(documentVersionRepository.findByObjectKey(anyString())).thenReturn(Optional.empty());
        when(userRepository.findById(55L)).thenReturn(Optional.of(uploader));
        when(documentRepository.save(any(Document.class))).thenAnswer(inv -> {
            Document d = inv.getArgument(0);
            d.setId(77L);
            return d;
        });
        when(documentVersionRepository.save(any(DocumentVersion.class))).thenAnswer(inv -> inv.getArgument(0));

        DocumentResponseDTO result = documentService.uploadDocumentViaBackend(5L, 55L, file, null);

        assertNotNull(result);
        // Verify the upload went through s3StorageService, not a raw S3Client
        verify(s3StorageService).putObject(any(), anyString(), eq("application/pdf"), any(), eq((long) content.length));
    }
}
