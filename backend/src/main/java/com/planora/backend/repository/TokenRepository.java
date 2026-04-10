package com.planora.backend.repository;

import com.planora.backend.model.User;
import com.planora.backend.model.VerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;

public interface TokenRepository extends JpaRepository<VerificationToken, Long> {
    VerificationToken findByUser(User user);

    void deleteByUser(User existingUser);

    VerificationToken findByToken(String token);

    VerificationToken findByUserAndTokenType(User user, VerificationToken.TokenType tokenType);

    /** Deletes all expired tokens and all tokens that have already been used. */
    void deleteByExpiryBeforeOrUsedTrue(Instant cutoff);
}
