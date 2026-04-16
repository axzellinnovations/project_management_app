package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.List;

@Entity
@Getter
@Setter
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Kanban kanban = (Kanban) o;
        return java.util.Objects.equals(id, kanban.id);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(id);
    }
}
