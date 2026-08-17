package com.planora.backend.repository;

import com.planora.backend.model.User;
import com.planora.backend.model.VerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TokenRepository extends JpaRepository<VerificationToken, Long> {
    VerificationToken findByUser(User user);

    void deleteByUser(User existingUser);

    VerificationToken findByToken(String token);

    VerificationToken findByUserAndTokenType(User user, VerificationToken.TokenType tokenType);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select token from VerificationToken token where token.user = :user and token.tokenType = :tokenType")
    VerificationToken findByUserAndTokenTypeForUpdate(@Param("user") User user,
            @Param("tokenType") VerificationToken.TokenType tokenType);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select token from VerificationToken token where (token.token = :jti or token.previousToken = :jti) and token.tokenType = :tokenType")
    Optional<VerificationToken> findByTokenOrPreviousTokenAndTokenTypeForUpdate(
            @Param("jti") String jti,
            @Param("tokenType") VerificationToken.TokenType tokenType);

    List<VerificationToken> findByUserAndTokenTypeOrderByExpiryAsc(User user, VerificationToken.TokenType tokenType);

    @Modifying(flushAutomatically = true)
    @Query("delete from VerificationToken token where token.token = :token and token.tokenType = :tokenType")
    int deleteByTokenAndTokenType(@Param("token") String token, @Param("tokenType") VerificationToken.TokenType tokenType);

    @Modifying(flushAutomatically = true)
    @Query("delete from VerificationToken token where token.user = :user and token.token = :token and token.tokenType = :tokenType")
    int deleteByUserAndTokenAndTokenType(@Param("user") User user, @Param("token") String token, @Param("tokenType") VerificationToken.TokenType tokenType);

    @Modifying(flushAutomatically = true)
    @Query("delete from VerificationToken token where token.user = :user and token.tokenType = :tokenType")
    int deleteByUserAndTokenType(@Param("user") User user, @Param("tokenType") VerificationToken.TokenType tokenType);

    /** Deletes all expired tokens and all tokens that have already been used. */
    void deleteByExpiryBeforeOrUsedTrue(Instant cutoff);
}
