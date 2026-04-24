package com.planora.backend.repository;

import com.planora.backend.model.ProjectType;

import com.planora.backend.model.User;

import com.planora.backend.model.Milestone;
import com.planora.backend.model.Project;
import com.planora.backend.model.Team;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@DataJpaTest
class MilestoneRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private MilestoneRepository milestoneRepository;

    private Project projectA;
    private Project projectB;

    @BeforeEach
    void setUp() {
        
        User owner = new User();
        owner.setEmail("owner@test.com");
        owner.setUsername("owner");
        owner.setPassword("valid_password");
        owner.setVerified(true);
        entityManager.persist(owner);

        Team team = new Team();
        team.setName("Engineering");
        team.setOwner(owner);
        entityManager.persist(team);

        projectA = new Project(); projectA.setName("Alpha"); projectA.setTeam(team); projectA.setOwner(owner); projectA.setType(ProjectType.KANBAN);
        entityManager.persist(projectA);

        projectB = new Project(); projectB.setName("Beta"); projectB.setTeam(team); projectB.setOwner(owner); projectB.setType(ProjectType.KANBAN);
        entityManager.persist(projectB);

        entityManager.flush();
    }

    private Milestone buildMilestone(Project project, String name, String status, LocalDate dueDate) {
        Milestone m = new Milestone();
        m.setProject(project);
        m.setName(name);
        m.setStatus(status);
        m.setDueDate(dueDate);
        return m;
    }

    // ── findByProjectId ──────────────────────────────────────────────────────

    @Test
    void findByProjectId_returnsMilestonesForProject() {
        entityManager.persist(buildMilestone(projectA, "v1.0", "OPEN", LocalDate.now().plusDays(30)));
        entityManager.persist(buildMilestone(projectA, "v1.1", "OPEN", LocalDate.now().plusDays(60)));
        entityManager.flush();

        List<Milestone> result = milestoneRepository.findByProjectId(projectA.getId());

        assertEquals(2, result.size());
        assertTrue(result.stream().allMatch(m -> m.getProject().getId().equals(projectA.getId())));
    }

    @Test
    void findByProjectId_returnsEmptyList_whenProjectHasNoMilestones() {
        List<Milestone> result = milestoneRepository.findByProjectId(projectA.getId());
        assertTrue(result.isEmpty());
    }

    @Test
    void findByProjectId_doesNotReturnMilestonesFromOtherProject() {
        entityManager.persist(buildMilestone(projectA, "Alpha M1", "OPEN",   LocalDate.now().plusDays(10)));
        entityManager.persist(buildMilestone(projectB, "Beta M1",  "CLOSED", LocalDate.now().minusDays(5)));
        entityManager.flush();

        List<Milestone> result = milestoneRepository.findByProjectId(projectA.getId());

        assertEquals(1, result.size());
        assertEquals("Alpha M1", result.get(0).getName());
    }

    @Test
    void findByProjectId_returnsEmptyList_forNonExistentProject() {
        List<Milestone> result = milestoneRepository.findByProjectId(9999L);
        assertTrue(result.isEmpty());
    }

    @Test
    void findByProjectId_returnsMilestonesWithDifferentStatuses() {
        entityManager.persist(buildMilestone(projectA, "Open MS",   "OPEN",   LocalDate.now().plusDays(20)));
        entityManager.persist(buildMilestone(projectA, "Closed MS", "CLOSED", LocalDate.now().minusDays(5)));
        entityManager.flush();

        List<Milestone> result = milestoneRepository.findByProjectId(projectA.getId());

        assertEquals(2, result.size());
        assertTrue(result.stream().anyMatch(m -> "OPEN".equals(m.getStatus())));
        assertTrue(result.stream().anyMatch(m -> "CLOSED".equals(m.getStatus())));
    }

    // ── Standard CRUD ────────────────────────────────────────────────────────

    @Test
    void save_persistsMilestone_andCanBeFoundById() {
        Milestone m = buildMilestone(projectA, "Launch", "OPEN", LocalDate.of(2025, 12, 31));
        Milestone saved = milestoneRepository.save(m);

        assertNotNull(saved.getId());
        Milestone found = milestoneRepository.findById(saved.getId()).orElseThrow();
        assertEquals("Launch", found.getName());
        assertEquals("OPEN",   found.getStatus());
        assertEquals(LocalDate.of(2025, 12, 31), found.getDueDate());
    }

    @Test
    void findById_returnsEmpty_whenNotFound() {
        assertTrue(milestoneRepository.findById(9999L).isEmpty());
    }

    @Test
    void delete_removesMilestone() {
        Milestone m = entityManager.persist(buildMilestone(projectA, "Temp", "OPEN", null));
        entityManager.flush();
        Long id = m.getId();

        milestoneRepository.deleteById(id);
        entityManager.flush();

        assertFalse(milestoneRepository.findById(id).isPresent());
    }

    @Test
    void update_changesNameAndStatus() {
        Milestone m = entityManager.persist(buildMilestone(projectA, "Old Name", "OPEN", null));
        entityManager.flush();

        m.setName("Updated Name");
        m.setStatus("CLOSED");
        milestoneRepository.save(m);
        entityManager.flush();
        entityManager.clear();

        Milestone updated = milestoneRepository.findById(m.getId()).orElseThrow();
        assertEquals("Updated Name", updated.getName());
        assertEquals("CLOSED",       updated.getStatus());
    }

    @Test
    void findAll_returnsAllMilestonesAcrossProjects() {
        entityManager.persist(buildMilestone(projectA, "A1", "OPEN",   null));
        entityManager.persist(buildMilestone(projectA, "A2", "OPEN",   null));
        entityManager.persist(buildMilestone(projectB, "B1", "CLOSED", null));
        entityManager.flush();

        assertEquals(3, milestoneRepository.findAll().size());
    }

    @Test
    void save_defaultStatus_isOpen() {
        // Default status set in entity is "OPEN"
        Milestone m = new Milestone();
        m.setProject(projectA);
        m.setName("Default Status Test");
        Milestone saved = milestoneRepository.save(m);
        entityManager.flush();
        entityManager.clear();

        assertEquals("OPEN", milestoneRepository.findById(saved.getId()).orElseThrow().getStatus());
    }
}
