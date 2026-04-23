package com.planora.backend.repository;

import com.planora.backend.model.ProjectType;

import com.planora.backend.model.User;

import com.planora.backend.model.CustomField;
import com.planora.backend.model.Project;
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
class CustomFieldRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private CustomFieldRepository customFieldRepository;

    private Project project;

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

        project = new Project(); project.setName("Test Project"); project.setTeam(team); project.setOwner(owner); project.setType(ProjectType.KANBAN);
        entityManager.persist(project);
        entityManager.flush();
    }

    @Test
    void findByProjectIdOrderByPosition_returnsFieldsInOrder() {
        CustomField f1 = new CustomField();
        f1.setProject(project);
        f1.setName("Status");
        f1.setFieldType("SELECT");
        f1.setPosition(2);

        CustomField f2 = new CustomField();
        f2.setProject(project);
        f2.setName("Priority");
        f2.setFieldType("SELECT");
        f2.setPosition(1);

        entityManager.persist(f1);
        entityManager.persist(f2);
        entityManager.flush();

        List<CustomField> result = customFieldRepository.findByProjectIdOrderByPosition(project.getId());

        assertEquals(2, result.size());
        assertEquals("Priority", result.get(0).getName());
        assertEquals("Status", result.get(1).getName());
    }

    @Test
    void findByProjectIdOrderByPosition_returnsEmptyList_whenNoFields() {
        List<CustomField> result = customFieldRepository.findByProjectIdOrderByPosition(project.getId());
        assertTrue(result.isEmpty());
    }
}
