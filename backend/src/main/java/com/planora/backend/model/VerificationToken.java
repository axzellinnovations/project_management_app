package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "verification_tokens", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "token_type"}, name = "uk_user_token_type")
})
public class VerificationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Getter
    @Setter
    private String token;

    @Getter
    @Setter
    @ManyToOne
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

    @Getter
    @Setter
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TokenType tokenType = TokenType.VERIFICATION;

    public boolean isExpired(){
        return Instant.now().isAfter(this.expiry);
    }

    public enum TokenType {
        VERIFICATION,
        PASSWORD_RESET
    }
}
