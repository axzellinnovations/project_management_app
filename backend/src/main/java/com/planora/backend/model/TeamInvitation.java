package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "team_invitations")
@NoArgsConstructor
@AllArgsConstructor
public class TeamInvitation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String token;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    private LocalDateTime invitedAt = LocalDateTime.now();
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private String status = "PENDING"; // E.g., PENDING, ACCEPTED
}