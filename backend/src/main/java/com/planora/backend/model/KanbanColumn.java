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

    @Column(name = "status")
    private String status; // maps to the status string used in tasks (e.g. "TODO")

    @Column(name = "color")
    private String color; // hex string e.g. "#EFF6FF", nullable

    @Column(name = "wip_limit")
    private Integer wipLimit; // nullable, 0 = unlimited

    @ManyToOne
    @JoinColumn(name = "kanban_id")
    @JsonIgnore
    private Kanban kanban;
}