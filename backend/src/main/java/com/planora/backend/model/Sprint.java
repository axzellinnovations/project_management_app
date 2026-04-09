package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

// DB MIGRATION REQUIRED: ALTER TABLE sprints RENAME COLUMN pro_id TO project_id;

@Data
@Entity
@Table(name = "sprints")
@AllArgsConstructor
@NoArgsConstructor
public class Sprint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    /** Convenience getter — preserves all existing callers of sprint.getProId() */
    public Long getProId() {
        return project != null ? project.getId() : null;
    }

    @Column(nullable = false)
    private String name;

    @Column(nullable = true)
    private LocalDate startDate;

    @Column(nullable = true)
    private LocalDate endDate;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private SprintStatus status;

    @Column(nullable = true, length = 500)
    private String goal;

}
