package com.planora.backend.repository;

import com.planora.backend.model.User;
import com.planora.backend.model.VerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TokenRepository extends JpaRepository<VerificationToken, Long> {
    VerificationToken findByUser(User user);

    void deleteByUser(User existingUser);
}
