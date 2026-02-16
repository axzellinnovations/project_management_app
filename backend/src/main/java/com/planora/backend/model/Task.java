package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.jpa.repository.JpaRepository;


@Entity
@Data
public class Task {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String title;
    private String description;
    private int position;

    @ManyToOne
    @JoinColumn(name = "column_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private KanbanColumn column;
}

