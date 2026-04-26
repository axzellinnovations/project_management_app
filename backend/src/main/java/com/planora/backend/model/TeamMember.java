// Represents a user's membership in a team, storing their assigned role and join timestamp.
package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@AllArgsConstructor
@NoArgsConstructor
// Composite uniqueness prevents the same user from being added to a team more than once.
@Table(name = "team_members", uniqueConstraints = @UniqueConstraint(columnNames = { "team_id", "user_id" }))
public class TeamMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Lazy-loaded to avoid pulling the full Team graph on every membership query.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    // Lazy-loaded; use @EntityGraph at the repository level when user fields are needed.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // Stored as a string (e.g., "OWNER") so role values remain readable in the database.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TeamRole role;

    private LocalDateTime joinedAt = LocalDateTime.now();

    // Identity-based equality uses only the DB-assigned ID to avoid issues in JPA collections.
    @Override
    public boolean equals(Object o) {
        if (this == o)
            return true;
        if (o == null || getClass() != o.getClass())
            return false;
        TeamMember that = (TeamMember) o;
        return java.util.Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(id);
    }
}
