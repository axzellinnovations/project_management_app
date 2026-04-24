package com.planora.backend.repository;

import com.planora.backend.model.ProjectType;

import com.planora.backend.model.User;

import com.planora.backend.model.Project;
import com.planora.backend.model.ProjectPage;
import com.planora.backend.model.Team;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@DataJpaTest
class ProjectPageRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private ProjectPageRepository projectPageRepository;

    private Long projectId;
    private Long otherProjectId;

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

        Project project = new Project(); project.setName("Main Project"); project.setTeam(team); project.setOwner(owner); project.setType(ProjectType.KANBAN);
        entityManager.persist(project);
        projectId = project.getId();

        Project other = new Project(); other.setName("Other Project"); other.setTeam(team); other.setOwner(owner); other.setType(ProjectType.KANBAN);
        entityManager.persist(other);
        otherProjectId = other.getId();

        entityManager.flush();
    }

    private ProjectPage buildPage(Long pId, String title, String content) {
        return ProjectPage.builder()
                .projectId(pId)
                .title(title)
                .content(content)
                .build();
    }

    // ── findByProjectId ──────────────────────────────────────────────────────

    @Test
    void findByProjectId_returnsAllPagesForProject() {
        entityManager.persist(buildPage(projectId, "Requirements", "Content A"));
        entityManager.persist(buildPage(projectId, "Architecture", "Content B"));
        entityManager.flush();

        List<ProjectPage> result = projectPageRepository.findByProjectId(projectId);

        assertEquals(2, result.size());
        assertTrue(result.stream().allMatch(p -> p.getProjectId().equals(projectId)));
    }

    @Test
    void findByProjectId_returnsEmptyList_whenNoPages() {
        List<ProjectPage> result = projectPageRepository.findByProjectId(projectId);
        assertTrue(result.isEmpty());
    }

    @Test
    void findByProjectId_doesNotReturnPagesFromOtherProject() {
        entityManager.persist(buildPage(projectId,      "My Page",    "Here"));
        entityManager.persist(buildPage(otherProjectId, "Other Page", "There"));
        entityManager.flush();

        List<ProjectPage> result = projectPageRepository.findByProjectId(projectId);

        assertEquals(1, result.size());
        assertEquals("My Page", result.get(0).getTitle());
    }

    @Test
    void findByProjectId_returnsNonExistentProjectIdAsEmpty() {
        List<ProjectPage> result = projectPageRepository.findByProjectId(9999L);
        assertTrue(result.isEmpty());
    }

    // ── standard CRUD ────────────────────────────────────────────────────────

    @Test
    void save_persistsPage_andCanBeFoundById() {
        ProjectPage page = buildPage(projectId, "Sprint Notes", "Today we did...");
        ProjectPage saved = projectPageRepository.save(page);

        assertNotNull(saved.getId());
        assertEquals("Sprint Notes", projectPageRepository.findById(saved.getId()).orElseThrow().getTitle());
    }

    @Test
    void delete_removesPage() {
        ProjectPage page = entityManager.persist(buildPage(projectId, "Temp Page", "Delete me"));
        entityManager.flush();
        Long id = page.getId();

        projectPageRepository.deleteById(id);
        entityManager.flush();

        assertFalse(projectPageRepository.findById(id).isPresent());
    }

    @Test
    void update_changesTitle() {
        ProjectPage page = entityManager.persist(buildPage(projectId, "Old Title", "Content"));
        entityManager.flush();

        page.setTitle("New Title");
        projectPageRepository.save(page);
        entityManager.flush();
        entityManager.clear();

        assertEquals("New Title", projectPageRepository.findById(page.getId()).orElseThrow().getTitle());
    }

    @Test
    void findAll_returnsAllPersisted() {
        entityManager.persist(buildPage(projectId, "Page 1", "c1"));
        entityManager.persist(buildPage(projectId, "Page 2", "c2"));
        entityManager.persist(buildPage(otherProjectId, "Page 3", "c3"));
        entityManager.flush();

        List<ProjectPage> all = projectPageRepository.findAll();
        assertEquals(3, all.size());
    }
}
