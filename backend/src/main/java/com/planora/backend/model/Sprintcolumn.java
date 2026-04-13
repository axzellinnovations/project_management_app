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
@Table(name = "springcolumns")
public class Sprintcolumn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String columnName;

    @Column(nullable = false)
    private Integer position;

    @Column(nullable = false)
    private String columnStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sprintboard_id", nullable = false)
    @JsonIgnore
    private Sprintboard sprintboard;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Sprintcolumn that = (Sprintcolumn) o;
        return java.util.Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(id);
    }
}