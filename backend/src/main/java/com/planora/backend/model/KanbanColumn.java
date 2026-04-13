package com.planora.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        KanbanColumn that = (KanbanColumn) o;
        return java.util.Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(id);
    }
}