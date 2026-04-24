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

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@DataJpaTest
class TaskTemplateRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private TaskTemplateRepository taskTemplateRepository;

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
        team.setName("Dev");
        team.setOwner(owner);

        entityManager.persist(team);

        project = new Project(); project.setName("Template Project"); project.setTeam(team); project.setOwner(owner); project.setType(ProjectType.KANBAN);
        entityManager.persist(project);

        creator = new User();
        creator.setEmail("alice@test.com");
        creator.setUsername("alice");
        creator.setPassword("valid_password");
        creator.setVerified(true);
        entityManager.persist(creator);

        entityManager.flush();
    }

    @Test
    void findByProjectIdOrderByCreatedAtDesc_returnsTemplates() {
        TaskTemplate t1 = new TaskTemplate();
        t1.setProject(project);
        t1.setCreatedBy(creator);
        t1.setName("Bug Template");
        t1.setTitle("Fix bug");
        entityManager.persist(t1);

        TaskTemplate t2 = new TaskTemplate();
        t2.setProject(project);
        t2.setCreatedBy(creator);
        t2.setName("Feature Template");
        t2.setTitle("Add feature");
        entityManager.persist(t2);

        entityManager.flush();

        List<TaskTemplate> result = taskTemplateRepository
                .findByProjectIdOrderByCreatedAtDesc(project.getId());

        assertEquals(2, result.size());
    }

    @Test
    void findByProjectIdOrderByCreatedAtDesc_returnsEmptyListWhenNone() {
        List<TaskTemplate> result = taskTemplateRepository
                .findByProjectIdOrderByCreatedAtDesc(project.getId());

        assertTrue(result.isEmpty());
    }
}
