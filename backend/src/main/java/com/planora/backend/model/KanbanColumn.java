package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class KanbanColumn {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private int position;

    @ManyToOne
    @JoinColumn(name="board_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Kanban kanban;

    @Column(nullable = false)
    private String name;
}
