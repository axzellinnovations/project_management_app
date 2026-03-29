package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "project_access",
       uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "user_id"}))
@AllArgsConstructor
@NoArgsConstructor
public class ProjectAccess {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private LocalDateTime lastAccessedAt;

    @PrePersist
    @PreUpdate
    public void onAccess() {
        this.lastAccessedAt = LocalDateTime.now();
    }
}
