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
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@ActiveProfiles("test")
@DataJpaTest
class TaskRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private TaskRepository taskRepository;

    private Project project;
    private Team team;

    @BeforeEach
    void setUp() {
        User owner = new User();
        owner.setEmail("owner@test.com");
        owner.setUsername("owner");
        owner.setPassword("valid_password");
        owner.setVerified(true);
        entityManager.persist(owner);

        team = new Team();
        team.setName("Dev Team");
        team.setOwner(owner);
        entityManager.persist(team);

        project = new Project(); project.setName("Test Project"); project.setTeam(team); project.setOwner(owner); project.setType(ProjectType.KANBAN);
        entityManager.persist(project);

        entityManager.flush();
    }

    private Task buildTask(String title, String status) {
        Task t = new Task();
        t.setTitle(title);
        t.setProject(project);
        t.setStatus(status);
        t.setBacklogPosition(0);
        return t;
    }

    // ── findByProjectId ──────────────────────────────────────────────────────

    @Test
    void findByProjectId_returnsTasksForProject() {
        entityManager.persist(buildTask("Task A", "TODO"));
        entityManager.persist(buildTask("Task B", "IN_PROGRESS"));
        entityManager.flush();

        List<Task> result = taskRepository.findByProjectId(project.getId());

        assertEquals(2, result.size());
    }

    @Test
    void findByProjectId_returnsEmpty_whenNoTasksInProject() {
        List<Task> result = taskRepository.findByProjectId(9999L);
        assertTrue(result.isEmpty());
    }

    // ── findByProjectIdWithScalars ───────────────────────────────────────────

    @Test
    void findByProjectIdWithScalars_returnsTasksOrderedByBacklogPosition() {
        Task t1 = buildTask("First", "TODO");
        t1.setBacklogPosition(2);
        Task t2 = buildTask("Second", "TODO");
        t2.setBacklogPosition(1);
        entityManager.persist(t1);
        entityManager.persist(t2);
        entityManager.flush();

        List<Task> result = taskRepository.findByProjectIdWithScalars(project.getId());

        assertEquals(2, result.size());
        // Both are backlog tasks (no sprint) → ordered by backlogPosition ASC
        assertEquals("Second", result.get(0).getTitle());
        assertEquals("First",  result.get(1).getTitle());
    }

    // ── findByIdWithProjectTeam ──────────────────────────────────────────────

    @Test
    void findByIdWithProjectTeam_returnsTask_whenExists() {
        Task task = entityManager.persist(buildTask("Fix bug", "TODO"));
        entityManager.flush();

        Optional<Task> result = taskRepository.findByIdWithProjectTeam(task.getId());

        assertTrue(result.isPresent());
        assertNotNull(result.get().getProject());
        assertEquals("Test Project", result.get().getProject().getName());
    }

    @Test
    void findByIdWithProjectTeam_returnsEmpty_whenNotFound() {
        Optional<Task> result = taskRepository.findByIdWithProjectTeam(9999L);
        assertTrue(result.isEmpty());
    }

    // ── findByIdWithDetails ──────────────────────────────────────────────────

    @Test
    void findByIdWithDetails_returnsTask_whenExists() {
        Task task = entityManager.persist(buildTask("Detail Task", "IN_PROGRESS"));
        entityManager.flush();

        Optional<Task> result = taskRepository.findByIdWithDetails(task.getId());

        assertTrue(result.isPresent());
        assertEquals("Detail Task", result.get().getTitle());
    }

    // ── findMaxProjectTaskNumberByProjectId ──────────────────────────────────

    @Test
    void findMaxProjectTaskNumberByProjectId_returnsZero_whenNoTasks() {
        Long max = taskRepository.findMaxProjectTaskNumberByProjectId(project.getId());
        assertEquals(0L, max);
    }

    @Test
    void findMaxProjectTaskNumberByProjectId_returnsMaxNumber() {
        Task t1 = buildTask("T1", "TODO"); t1.setProjectTaskNumber(1L); entityManager.persist(t1);
        Task t2 = buildTask("T2", "TODO"); t2.setProjectTaskNumber(5L); entityManager.persist(t2);
        Task t3 = buildTask("T3", "TODO"); t3.setProjectTaskNumber(3L); entityManager.persist(t3);
        entityManager.flush();

        Long max = taskRepository.findMaxProjectTaskNumberByProjectId(project.getId());
        assertEquals(5L, max);
    }

    // ── findMaxBacklogPositionByProjectId ────────────────────────────────────

    @Test
    void findMaxBacklogPositionByProjectId_returnsMinusOne_whenNoBacklogTasks() {
        Integer pos = taskRepository.findMaxBacklogPositionByProjectId(project.getId());
        assertEquals(-1, pos);
    }

    @Test
    void findMaxBacklogPositionByProjectId_returnsMaxPosition() {
        Task t1 = buildTask("BP1", "TODO"); t1.setBacklogPosition(0); entityManager.persist(t1);
        Task t2 = buildTask("BP2", "TODO"); t2.setBacklogPosition(3); entityManager.persist(t2);
        entityManager.flush();

        Integer max = taskRepository.findMaxBacklogPositionByProjectId(project.getId());
        assertEquals(3, max);
    }

    // ── findByProjectIdFiltered ──────────────────────────────────────────────

    @Test
    void findByProjectIdFiltered_returnsAllTasksWhenNoFilters() {
        entityManager.persist(buildTask("F1", "TODO"));
        entityManager.persist(buildTask("F2", "DONE"));
        entityManager.flush();

        List<Task> result = taskRepository.findByProjectIdFiltered(
                project.getId(), null, null, null, null, null);

        assertEquals(2, result.size());
    }

    @Test
    void findByProjectIdFiltered_filtersByStatus() {
        entityManager.persist(buildTask("Done Task",   "DONE"));
        entityManager.persist(buildTask("Active Task", "IN_PROGRESS"));
        entityManager.flush();

        List<Task> result = taskRepository.findByProjectIdFiltered(
                project.getId(), "DONE", null, null, null, null);

        assertEquals(1, result.size());
        assertEquals("Done Task", result.get(0).getTitle());
    }

    @Test
    void findByProjectIdFiltered_filtersByPriority() {
        Task t1 = buildTask("High Priority", "TODO");
        t1.setPriority(Priority.HIGH);
        Task t2 = buildTask("Low Priority", "TODO");
        t2.setPriority(Priority.LOW);
        entityManager.persist(t1);
        entityManager.persist(t2);
        entityManager.flush();

        List<Task> result = taskRepository.findByProjectIdFiltered(
                project.getId(), null, null, "HIGH", null, null);

        assertEquals(1, result.size());
        assertEquals("High Priority", result.get(0).getTitle());
    }

    // ── findByNextOccurrenceBeforeOrEqualWithAssociations ────────────────────

    @Test
    void findByNextOccurrenceBeforeOrEqual_returnsDueTasks() {
        Task recurring = buildTask("Daily Standup", "TODO");
        recurring.setNextOccurrence(LocalDate.now().minusDays(1));
        recurring.setRecurrenceRule("DAILY");
        entityManager.persist(recurring);

        Task notDue = buildTask("Future Task", "TODO");
        notDue.setNextOccurrence(LocalDate.now().plusDays(5));
        notDue.setRecurrenceRule("WEEKLY");
        entityManager.persist(notDue);

        entityManager.flush();

        List<Task> result = taskRepository.findByNextOccurrenceBeforeOrEqualWithAssociations(LocalDate.now());

        assertEquals(1, result.size());
        assertEquals("Daily Standup", result.get(0).getTitle());
    }

    @Test
    void findByNextOccurrenceBeforeOrEqual_returnsEmpty_whenNoDueTasks() {
        Task t = buildTask("Future", "TODO");
        t.setNextOccurrence(LocalDate.now().plusDays(10));
        t.setRecurrenceRule("WEEKLY");
        entityManager.persist(t);
        entityManager.flush();

        List<Task> result = taskRepository.findByNextOccurrenceBeforeOrEqualWithAssociations(LocalDate.now());
        assertTrue(result.isEmpty());
    }

    // ── findOpenTasksDueOnOrBeforeWithReminderRelations ───────────────────────

    @Test
    void findOpenTasksDueOnOrBefore_returnsDueSoonTasks() {
        Task due = buildTask("Due soon", "TODO");
        due.setDueDate(LocalDate.now());
        entityManager.persist(due);

        Task done = buildTask("Already done", "DONE");
        done.setDueDate(LocalDate.now());
        entityManager.persist(done);

        Task future = buildTask("Far future", "TODO");
        future.setDueDate(LocalDate.now().plusDays(30));
        entityManager.persist(future);

        entityManager.flush();

        List<Task> result = taskRepository.findOpenTasksDueOnOrBeforeWithReminderRelations(LocalDate.now());

        assertEquals(1, result.size());
        assertEquals("Due soon", result.get(0).getTitle());
    }

    // ── findByIdInWithDetails ────────────────────────────────────────────────

    @Test
    void findByIdInWithDetails_returnsMatchingTasks() {
        Task t1 = entityManager.persist(buildTask("Task X", "TODO"));
        Task t2 = entityManager.persist(buildTask("Task Y", "TODO"));
        entityManager.flush();

        List<Task> result = taskRepository.findByIdInWithDetails(List.of(t1.getId(), t2.getId()));

        assertEquals(2, result.size());
    }

    @Test
    void findByIdInWithDetails_returnsEmpty_whenNoIdsMatch() {
        List<Task> result = taskRepository.findByIdInWithDetails(List.of(9999L, 8888L));
        assertTrue(result.isEmpty());
    }

    // ── Standard CRUD ────────────────────────────────────────────────────────

    @Test
    void save_persistsTask_andCanBeFoundById() {
        Task task = buildTask("New Feature", "TODO");
        Task saved = taskRepository.save(task);

        assertNotNull(saved.getId());
        assertEquals("New Feature", taskRepository.findById(saved.getId()).orElseThrow().getTitle());
    }

    @Test
    void delete_removesTask() {
        Task task = entityManager.persist(buildTask("Temp", "TODO"));
        entityManager.flush();

        taskRepository.deleteById(task.getId());
        entityManager.flush();

        assertFalse(taskRepository.findById(task.getId()).isPresent());
    }
}
