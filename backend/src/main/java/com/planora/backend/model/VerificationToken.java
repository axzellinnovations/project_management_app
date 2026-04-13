package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "verification_tokens", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"user_id", "token_type"}, name = "uk_user_token_type")
})
public class VerificationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String token;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private Instant expiry;

    @Builder.Default
    private boolean used = false;

    @Builder.Default
    private int attempts = 0;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TokenType tokenType = TokenType.VERIFICATION;

    public boolean isExpired(){
        return Instant.now().isAfter(this.expiry);
    }

    public enum TokenType {
        VERIFICATION,
        PASSWORD_RESET,
        REFRESH_TOKEN
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        VerificationToken that = (VerificationToken) o;
        return java.util.Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(id);
    }
}
