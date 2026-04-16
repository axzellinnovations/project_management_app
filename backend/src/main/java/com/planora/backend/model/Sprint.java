package com.planora.backend.model;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
@Getter
@Setter
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
    @JsonIgnore
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Sprint sprint = (Sprint) o;
        return java.util.Objects.equals(id, sprint.id);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(id);
    }
}
