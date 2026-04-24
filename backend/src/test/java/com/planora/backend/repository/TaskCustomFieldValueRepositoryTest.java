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
class TaskCustomFieldValueRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private TaskFieldValueRepository taskFieldValueRepository;

    private Task task;
    private CustomField field;

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

        Project project = new Project(); project.setName("Project"); project.setTeam(team); project.setOwner(owner); project.setType(ProjectType.KANBAN);
        entityManager.persist(project);

        task = new Task();
        task.setTitle("Task");
        task.setProject(project);
        entityManager.persist(task);

        field = new CustomField();
        field.setProject(project);
        field.setName("Priority");
        field.setFieldType("SELECT");
        field.setPosition(0);
        entityManager.persist(field);

        entityManager.flush();
    }

    @Test
    void findByTask_returnsFieldValues() {
        TaskFieldValue fv = new TaskFieldValue(null, task, field, "High");
        entityManager.persist(fv);
        entityManager.flush();

        List<TaskFieldValue> result = taskFieldValueRepository.findByTask(task);

        assertEquals(1, result.size());
        assertEquals("High", result.get(0).getValue());
    }

    @Test
    void findByTaskIdAndCustomFieldId_returnsValue_whenExists() {
        TaskFieldValue fv = new TaskFieldValue(null, task, field, "Medium");
        entityManager.persist(fv);
        entityManager.flush();

        Optional<TaskFieldValue> result = taskFieldValueRepository
                .findByTaskIdAndCustomFieldId(task.getId(), field.getId());

        assertTrue(result.isPresent());
        assertEquals("Medium", result.get().getValue());
    }

    @Test
    void findByTaskIdAndCustomFieldId_returnsEmpty_whenNoValue() {
        Optional<TaskFieldValue> result = taskFieldValueRepository
                .findByTaskIdAndCustomFieldId(task.getId(), field.getId());

        assertTrue(result.isEmpty());
    }
}
