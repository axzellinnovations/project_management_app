package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.List;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Kanban {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private String type;

    @OneToMany(mappedBy = "kanban" , cascade = CascadeType.ALL)
    private List<KanbanColumn> columns;
}
