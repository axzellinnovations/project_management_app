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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@DataJpaTest
class TaskAttachmentRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private TaskAttachmentRepository taskAttachmentRepository;

    private Task task;
    private User uploader;

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

        Project project = new Project(); project.setName("Test Project"); project.setTeam(team); project.setOwner(owner); project.setType(ProjectType.KANBAN);
        entityManager.persist(project);

        task = new Task();
        task.setTitle("Test Task");
        task.setProject(project);
        entityManager.persist(task);

        uploader = new User();
        uploader.setEmail("alice@test.com");
        uploader.setUsername("alice");
        uploader.setPassword("valid_password");
        uploader.setVerified(true);
        entityManager.persist(uploader);

        entityManager.flush();
    }

    private TaskAttachment buildAttachment(String fileName, String objectKey) {
        TaskAttachment a = new TaskAttachment();
        a.setTask(task);
        a.setFileName(fileName);
        a.setContentType("application/pdf");
        a.setFileSize(1024L);
        a.setObjectKey(objectKey);
        a.setUploadedBy(uploader);
        return a;
    }

    @Test
    void findByTaskIdOrderByCreatedAtDesc_returnsAttachments() {
        TaskAttachment a1 = buildAttachment("file1.pdf", "task-1/uuid1-file1.pdf");
        TaskAttachment a2 = buildAttachment("file2.pdf", "task-1/uuid2-file2.pdf");
        entityManager.persist(a1);
        entityManager.persist(a2);
        entityManager.flush();

        List<TaskAttachment> result = taskAttachmentRepository.findByTaskIdOrderByCreatedAtDesc(task.getId());

        assertEquals(2, result.size());
    }

    @Test
    void findByObjectKey_returnsAttachment_whenExists() {
        TaskAttachment a = buildAttachment("spec.pdf", "task-1/unique-key-spec.pdf");
        entityManager.persist(a);
        entityManager.flush();

        Optional<TaskAttachment> result = taskAttachmentRepository.findByObjectKey("task-1/unique-key-spec.pdf");

        assertTrue(result.isPresent());
        assertEquals("spec.pdf", result.get().getFileName());
    }

    @Test
    void findByObjectKey_returnsEmpty_whenNotFound() {
        Optional<TaskAttachment> result = taskAttachmentRepository.findByObjectKey("nonexistent-key");
        assertTrue(result.isEmpty());
    }
}
