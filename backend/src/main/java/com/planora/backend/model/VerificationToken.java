package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class VerificationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Getter
    @Setter
    private String token;

    @Getter
    @Setter
    @OneToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Getter
    @Setter
    private Instant expiry;

    @Getter
    @Setter
    private boolean used = false;

    @Setter
    @Getter
    private int attempts = 0;

    public boolean isExpired(){
        return Instant.now().isAfter(this.expiry);
    }
}
