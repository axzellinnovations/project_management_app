package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Data
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
    private List<Project> projects = new ArrayList<>();


    // INVITATION ACCEPTED MEMBERS
    @OneToMany(mappedBy = "team", cascade = CascadeType.ALL , orphanRemoval = true)
    @ToString.Exclude
    private List<TeamMember> members = new ArrayList<>();

    //PENDING INVITATION
    @OneToMany(mappedBy = "team", cascade = CascadeType.ALL, orphanRemoval = true)
    @ToString.Exclude
    private List<TeamInvitation> invitations = new ArrayList<>();



}
