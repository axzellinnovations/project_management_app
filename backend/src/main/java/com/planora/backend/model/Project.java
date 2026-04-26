package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter // Lombok: generates getter methods for all fields.
@Setter // Lombok: generates setter methods for all fields.
@Entity // JPA: marks this class as a persistent entity.
@Table(name = "projects") // JPA: maps this entity to the "projects" database table.
@AllArgsConstructor // Lombok: generates constructor with all fields.
@NoArgsConstructor // Lombok: generates no-args constructor required by JPA.
public class Project {

    @Id // JPA: primary key for the entity.
    @GeneratedValue(strategy = GenerationType.IDENTITY) // JPA: auto-generates id values using database identity strategy.
    private Long id;

    @Column(nullable = false) // JPA: column must have a value (NOT NULL).
    private String name;

    @Column(unique = true) // JPA: enforces uniqueness at the database level.
    private String projectKey;

    @Column(length = 1500) // JPA: limits column size to 1500 characters.
    private String description;

    @ManyToOne(fetch = FetchType.LAZY) // JPA: many projects can belong to one owner user.
    @JoinColumn(name = "userId", nullable = false) // JPA: foreign key column name for owner relation.
    private User owner;

    @Enumerated(EnumType.STRING) // JPA: stores enum values as readable strings (AGILE/KANBAN).
    @Column(nullable = false) // JPA: project type is required.
    private ProjectType type;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY) // JPA: many projects can belong to one team.
    @JoinColumn(name = "team_id", nullable = false) // JPA: foreign key column name for team relation.
    private Team team;

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true) // JPA: one project has many labels; cascade and orphan cleanup are enabled.
    private List<Label> labels = new ArrayList<>();

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true) // JPA: one project has many tasks; cascade and orphan cleanup are enabled.
    private List<Task> tasks = new ArrayList<>();

    @PreUpdate // JPA lifecycle hook: updates timestamp before every entity update.
    public void setLastUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    @Override // Java override: custom equality based on entity id.
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Project project = (Project) o;
        return java.util.Objects.equals(id, project.id);
    }

    @Override // Java override: hash code aligned with equals implementation.
    public int hashCode() {
        return java.util.Objects.hash(id);
    }

}
