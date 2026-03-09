package com.planora.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class KanbanColumn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name; // Column name, e.g., "To Do", "In Progress"

    private Integer position; // Order position for sorting columns

    @ManyToOne
    @JoinColumn(name = "kanban_id")
    @JsonIgnore
    private Kanban kanban;
}