package com.planora.backend.service;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import com.planora.backend.model.User;
import com.planora.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * Dedicated service for caching high-frequency user resolution queries.
 */
@Service
@RequiredArgsConstructor
public class UserCacheService {

    private final UserRepository userRepository;

    /**
     * Resolves a User entity by checking both the email and username columns.
     * This is heavily used by security filters on every API request, making caching critical.
     * * CACHE CONFIGURATION:
     * - key: Forces the cache key to be lowercase so "User@Mail.com" and "user@mail.com" hit the same cache entry.
     * - sync = true: Prevents "Cache Stampedes". If 100 concurrent requests ask for the same
     * uncached user, only 1 thread will query the DB while the other 99 wait for the cache to populate.
     */
    @Cacheable(cacheNames = "users-by-identity", key = "#identity.toLowerCase()", sync = true)
    public User resolveUserByEmailOrUsername(String identity) {
        // Step 1. Fail fast on empty input to prevent unnecessary DB queries or cache pollution.
        if (identity == null || identity.isBlank()) {
            return null;
        }

        // Step 2. Normalize the input for case-insensitive database lookups.
        var normalized = identity.toLowerCase();

        // Step 3. Heuristic check: If it contains an '@', it is highly likely an email address.
        if (normalized.contains("@")) {
            // Step 3a. Attempt email lookup first (primary path).
            var byEmail = userRepository.findByEmailIgnoreCase(normalized).orElse(null);
            if (byEmail != null) {
                return byEmail;
            }
            // Step 3b. Fallback: Check usernames just in case a user managed to
            // register a username containing an '@' symbol.
            return userRepository.findByUsernameIgnoreCase(normalized).orElse(null);
        }

        // Step 4. Heuristic check: No '@' found, so it is highly likely a username.
        var byUsername = userRepository.findByUsernameIgnoreCase(normalized).orElse(null);
        if (byUsername != null) {
            return byUsername;
        }

        // Step 4b. Final fallback: Check emails just in case it's a malformed email
        // without an '@' that somehow bypassed frontend validation.
        return userRepository.findByEmailIgnoreCase(normalized).orElse(null);
    }
}
