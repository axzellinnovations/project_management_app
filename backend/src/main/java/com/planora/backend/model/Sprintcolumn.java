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
@Table(name = "springcolumns")
public class Sprintcolumn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String columnName;

    @Column(nullable = false)
    private Integer position;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SprintcolumnStatus columnStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sprintboard_id", nullable = false)
    @JsonIgnore
    private Sprintboard sprintboard;
}