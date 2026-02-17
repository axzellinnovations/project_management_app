package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor

public class Kanban {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name; // Name of the Kanban board, e.g., "Project Kanban"

    private Long projectId; // Reference to the associated project

    @OneToMany(mappedBy = "kanban", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<KanbanColumn> columns;
}
