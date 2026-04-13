package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Getter
@Setter
@Entity
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "teams")
public class Team {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "team" , cascade = CascadeType.ALL , orphanRemoval = true)
    @ToString.Exclude
    private Set<Project> projects = new HashSet<>();


    // INVITATION ACCEPTED MEMBERS
    @OneToMany(mappedBy = "team", cascade = CascadeType.ALL , orphanRemoval = true)
    @ToString.Exclude
    private Set<TeamMember> members = new HashSet<>();

    //PENDING INVITATION
    @OneToMany(mappedBy = "team", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    private Set<TeamInvitation> invitations = new HashSet<>();

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Team team = (Team) o;
        return java.util.Objects.equals(id, team.id);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(id);
    }
}
