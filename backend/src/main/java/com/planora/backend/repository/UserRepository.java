package com.planora.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.planora.backend.model.User;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    User findByEmail(String email);
    
    Optional<User> findByEmailIgnoreCase(String email);
    
    Optional<User> findByUsername(String username);
    
    boolean existsByEmail(String email);
    
    boolean existsByEmailIgnoreCase(String email);
    
    boolean existsByUsername(String username);
}
