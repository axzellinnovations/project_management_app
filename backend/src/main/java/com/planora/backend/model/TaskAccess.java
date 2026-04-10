package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "task_access",
       uniqueConstraints = @UniqueConstraint(columnNames = {"task_id", "user_id"}))
@AllArgsConstructor
@NoArgsConstructor
public class TaskAccess {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

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
