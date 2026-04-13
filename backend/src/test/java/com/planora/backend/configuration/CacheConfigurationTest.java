package com.planora.backend.configuration;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class CacheConfigurationTest {

    @Autowired
    private CacheManager cacheManager;

    @Test
    void requiredCachesAreRegistered() {
        assertNotNull(cacheManager.getCache("users-by-identity"));
        assertNotNull(cacheManager.getCache("user-details"));
        assertNotNull(cacheManager.getCache("project-membership"));
        assertNotNull(cacheManager.getCache("project-team-id"));
        assertNotNull(cacheManager.getCache("team-member"));
    }
}
