package com.planora.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Entity
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString(exclude = {"project", "sprint", "kanbanColumn", "assignee", "assignees", "reporter", "parentTask", "subTasks", "labels", "comments", "dependencies", "dependents", "attachments"}) // Prevent infinite loops in logs
@Table(name = "tasks")
public class Task {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(length = 2000)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnore
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sprint_id")
    @JsonIgnore
    private Sprint sprint;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kanban_column_id")
    @JsonIgnore
    private KanbanColumn kanbanColumn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id")
    @JsonIgnore
    private TeamMember assignee;

    @BatchSize(size = 20)
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "task_assignees",
            joinColumns = @JoinColumn(name = "task_id"),
            inverseJoinColumns = @JoinColumn(name = "member_id")
    )
    private Set<TeamMember> assignees = new HashSet<>();

    @Enumerated(EnumType.STRING)
    private Priority priority;

    private String status;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDate startDate;
    private LocalDate dueDate;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporter_id")
    @JsonIgnore
    private TeamMember reporter;

    private int storyPoint;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_modified_by_id")
    @JsonIgnore
    private User lastModifiedBy;

    //The "Parent" (If this is null, It's th main taks. If ser, it's a subtask)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    @JsonIgnore
    private Task parentTask;

    @BatchSize(size = 20)
    @OneToMany(mappedBy = "parentTask" , cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Task> subTasks = new HashSet<>();

    @BatchSize(size = 20)
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "task_labels",
            joinColumns = @JoinColumn(name = "task_id"),
            inverseJoinColumns = @JoinColumn(name = "label_id")
    )
    private Set<Label> labels = new HashSet<>();

    @BatchSize(size = 20)
    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Comment> comments = new ArrayList<>();

    @BatchSize(size = 20)
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "task_dependencies",
            joinColumns = @JoinColumn(name = "blocked_task_id"),
            inverseJoinColumns = @JoinColumn(name = "blocker_task_id")
    )
    private Set<Task> dependencies = new HashSet<>();

    @BatchSize(size = 20)
    @ManyToMany(mappedBy = "dependencies", fetch = FetchType.LAZY)
    private Set<Task> dependents = new HashSet<>();

    @BatchSize(size = 20)
    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<TaskAttachment> attachments = new HashSet<>();

    @BatchSize(size = 20)
    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TaskAccess> taskAccess = new ArrayList<>();

    @BatchSize(size = 20)
    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TaskActivity> taskActivities = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "milestone_id")
    @JsonIgnore
    private Milestone milestone;

    // Recurring task fields (V7 migration)
    @Column(name = "recurrence_rule")
    private String recurrenceRule;   // DAILY | WEEKLY | MONTHLY | YEARLY

    @Column(name = "recurrence_end")
    private LocalDate recurrenceEnd;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recurrence_parent_id")
    @JsonIgnore
    private Task recurrenceParent;

    @Column(name = "next_occurrence")
    private LocalDate nextOccurrence;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Task task = (Task) o;
        return Objects.equals(id, task.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @PreUpdate
    public void setLastUpdate() {
        this.updatedAt = LocalDateTime.now(); }



}
