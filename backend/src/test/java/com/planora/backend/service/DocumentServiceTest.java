package com.planora.backend.service;

import com.planora.backend.dto.DocumentFolderCreateRequestDTO;
import com.planora.backend.dto.DocumentFolderResponseDTO;
import com.planora.backend.model.DocumentFolder;
import com.planora.backend.model.DocumentStatus;
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
import org.springframework.security.access.AccessDeniedException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
    private S3Presigner s3Presigner;
    @Mock
    private S3Client s3Client;

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
    void deleteFolder_rejectsWhenActiveDocumentsExist() {
        TeamMember admin = new TeamMember();
        admin.setRole(TeamRole.ADMIN);

        DocumentFolder folder = new DocumentFolder();
        folder.setId(300L);
        folder.setProject(project);

        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(12L, 55L)).thenReturn(Optional.of(admin));
        when(documentFolderRepository.findByIdAndProjectId(300L, 5L)).thenReturn(Optional.of(folder));
        when(documentFolderRepository.countByParentFolderIdAndDeletedAtIsNull(300L)).thenReturn(0L);
        when(documentRepository.countByFolderIdAndStatus(300L, DocumentStatus.ACTIVE)).thenReturn(2L);

        RuntimeException exception = assertThrows(RuntimeException.class,
                () -> documentService.deleteFolder(5L, 300L, 55L));

        assertEquals("Cannot delete folder with active documents", exception.getMessage());
        verify(documentRepository).countByFolderIdAndStatus(300L, DocumentStatus.ACTIVE);
    }
}
