package com.planora.backend.repository;

import com.planora.backend.model.ProjectType;

import com.planora.backend.model.User;

import com.planora.backend.model.Label;
import com.planora.backend.model.Project;
import com.planora.backend.model.Team;
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
class LabelRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private LabelRepository labelRepository;

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
        team.setName("Dev Team");
        team.setOwner(owner);
        entityManager.persist(team);

        projectA = new Project(); projectA.setName("Project Alpha"); projectA.setTeam(team); projectA.setOwner(owner); projectA.setType(ProjectType.KANBAN);
        entityManager.persist(projectA);

        projectB = new Project(); projectB.setName("Project Beta"); projectB.setTeam(team); projectB.setOwner(owner); projectB.setType(ProjectType.KANBAN);
        entityManager.persist(projectB);

        entityManager.flush();
    }

    // ── findByProjectId ──────────────────────────────────────────────────────

    @Test
    void findByProjectId_returnsLabelsForProject() {
        entityManager.persist(new Label("Bug",     "#FF0000", projectA));
        entityManager.persist(new Label("Feature", "#00FF00", projectA));
        entityManager.flush();

        List<Label> result = labelRepository.findByProjectId(projectA.getId());

        assertEquals(2, result.size());
        assertTrue(result.stream().allMatch(l -> l.getProject().getId().equals(projectA.getId())));
    }

    @Test
    void findByProjectId_returnsEmptyList_whenProjectHasNoLabels() {
        List<Label> result = labelRepository.findByProjectId(projectA.getId());
        assertTrue(result.isEmpty());
    }

    @Test
    void findByProjectId_doesNotReturnLabelsFromOtherProject() {
        entityManager.persist(new Label("Bug",     "#FF0000", projectA));
        entityManager.persist(new Label("Hotfix",  "#FF9900", projectB));
        entityManager.flush();

        List<Label> result = labelRepository.findByProjectId(projectA.getId());

        assertEquals(1, result.size());
        assertEquals("Bug", result.get(0).getName());
    }

    @Test
    void findByProjectId_returnsEmptyList_forNonExistentProjectId() {
        List<Label> result = labelRepository.findByProjectId(9999L);
        assertTrue(result.isEmpty());
    }

    @Test
    void findByProjectId_returnsMultipleLabels_withCorrectColors() {
        entityManager.persist(new Label("Critical", "#DC143C", projectA));
        entityManager.persist(new Label("Low",      "#3CB371", projectA));
        entityManager.persist(new Label("Medium",   "#FFD700", projectA));
        entityManager.flush();

        List<Label> result = labelRepository.findByProjectId(projectA.getId());

        assertEquals(3, result.size());
        assertTrue(result.stream().anyMatch(l -> "#DC143C".equals(l.getColor())));
        assertTrue(result.stream().anyMatch(l -> "#3CB371".equals(l.getColor())));
    }

    // ── Standard CRUD ────────────────────────────────────────────────────────

    @Test
    void save_persistsLabel_andCanBeFoundById() {
        Label label = new Label("Enhancement", "#6A0DAD", projectA);
        Label saved = labelRepository.save(label);

        assertNotNull(saved.getId());
        Optional<Label> found = labelRepository.findById(saved.getId());
        assertTrue(found.isPresent());
        assertEquals("Enhancement", found.get().getName());
        assertEquals("#6A0DAD",      found.get().getColor());
    }

    @Test
    void delete_removesLabel() {
        Label label = entityManager.persist(new Label("Temp", "#123456", projectA));
        entityManager.flush();
        Long id = label.getId();

        labelRepository.deleteById(id);
        entityManager.flush();

        assertFalse(labelRepository.findById(id).isPresent());
    }

    @Test
    void update_changesColorAndName() {
        Label label = entityManager.persist(new Label("Old Name", "#000000", projectA));
        entityManager.flush();

        label.setName("New Name");
        label.setColor("#FFFFFF");
        labelRepository.save(label);
        entityManager.flush();
        entityManager.clear();

        Label updated = labelRepository.findById(label.getId()).orElseThrow();
        assertEquals("New Name", updated.getName());
        assertEquals("#FFFFFF",  updated.getColor());
    }

    @Test
    void findAll_returnsLabelsAcrossAllProjects() {
        entityManager.persist(new Label("LabelA", "#111111", projectA));
        entityManager.persist(new Label("LabelB", "#222222", projectB));
        entityManager.flush();

        assertEquals(2, labelRepository.findAll().size());
    }

    @Test
    void findById_returnsEmpty_whenNotFound() {
        assertTrue(labelRepository.findById(9999L).isEmpty());
    }
}
