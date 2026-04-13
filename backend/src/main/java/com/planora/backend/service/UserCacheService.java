package com.planora.backend.service;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.planora.backend.model.User;
import com.planora.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserCacheService {

    private final UserRepository userRepository;

    @Cacheable(cacheNames = "users-by-identity", key = "#identity.toLowerCase()", unless = "#result == null")
    public User resolveUserByEmailOrUsername(String identity) {
        if (identity == null || identity.isBlank()) {
            return null;
        }

        var normalized = identity.toLowerCase();
        if (normalized.contains("@")) {
            var byEmail = userRepository.findByEmailIgnoreCase(normalized).orElse(null);
            if (byEmail != null) {
                return byEmail;
            }
            return userRepository.findByUsernameIgnoreCase(normalized).orElse(null);
        }

        var byUsername = userRepository.findByUsernameIgnoreCase(normalized).orElse(null);
        if (byUsername != null) {
            return byUsername;
        }

        return userRepository.findByEmailIgnoreCase(normalized).orElse(null);
    }
}
