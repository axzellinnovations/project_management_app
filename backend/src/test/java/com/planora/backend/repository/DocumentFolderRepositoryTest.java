package com.planora.backend.repository;

import com.planora.backend.model.ProjectType;

import com.planora.backend.model.User;

import com.planora.backend.model.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@DataJpaTest
class DocumentFolderRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private DocumentFolderRepository documentFolderRepository;

    private Project project;
    private User creator;

    @BeforeEach
    void setUp() {
        
        User owner = new User();
        owner.setEmail("owner@test.com");
        owner.setUsername("owner");
        owner.setPassword("valid_password");
        owner.setVerified(true);
        entityManager.persist(owner);

        Team team = new Team();
        team.setName("Dev Team");
        team.setOwner(owner);
        entityManager.persist(team);

        project = new Project(); project.setName("Folder Project"); project.setTeam(team); project.setOwner(owner); project.setType(ProjectType.KANBAN);
        entityManager.persist(project);

        creator = new User();
        creator.setEmail("bob@example.com");
        creator.setUsername("bob");
        creator.setPassword("valid_password");
        creator.setVerified(true);
        entityManager.persist(creator);

        entityManager.flush();
    }

    @Test
    void findByProjectIdAndDeletedAtIsNullOrderByCreatedAtAsc_returnsActiveFolders() {
        DocumentFolder f1 = new DocumentFolder();
        f1.setProject(project);
        f1.setName("Designs");
        f1.setCreatedBy(creator);
        entityManager.persist(f1);
        entityManager.flush();

        List<DocumentFolder> result = documentFolderRepository
                .findByProjectIdAndDeletedAtIsNullOrderByCreatedAtAsc(project.getId());

        assertEquals(1, result.size());
        assertEquals("Designs", result.get(0).getName());
    }

    @Test
    void findByIdAndProjectId_returnsFolder_whenExists() {
        DocumentFolder folder = new DocumentFolder();
        folder.setProject(project);
        folder.setName("Reports");
        folder.setCreatedBy(creator);
        entityManager.persist(folder);
        entityManager.flush();

        Optional<DocumentFolder> result = documentFolderRepository
                .findByIdAndProjectId(folder.getId(), project.getId());

        assertTrue(result.isPresent());
        assertEquals("Reports", result.get().getName());
    }

    @Test
    void existsByProjectIdAndParentFolderIdAndNameIgnoreCaseAndDeletedAtIsNull_returnsTrue_whenDuplicate() {
        DocumentFolder folder = new DocumentFolder();
        folder.setProject(project);
        folder.setName("Archive");
        folder.setCreatedBy(creator);
        entityManager.persist(folder);
        entityManager.flush();

        boolean exists = documentFolderRepository
                .existsByProjectIdAndParentFolderIdAndNameIgnoreCaseAndDeletedAtIsNull(
                        project.getId(), null, "archive");

        assertTrue(exists);
    }

    @Test
    void countByParentFolderIdAndDeletedAtIsNull_returnsChildCount() {
        DocumentFolder parent = new DocumentFolder();
        parent.setProject(project);
        parent.setName("Parent");
        parent.setCreatedBy(creator);
        entityManager.persist(parent);

        DocumentFolder child = new DocumentFolder();
        child.setProject(project);
        child.setName("Child");
        child.setCreatedBy(creator);
        child.setParentFolder(parent);
        entityManager.persist(child);
        entityManager.flush();

        long count = documentFolderRepository.countByParentFolderIdAndDeletedAtIsNull(parent.getId());

        assertEquals(1, count);
    }
}
