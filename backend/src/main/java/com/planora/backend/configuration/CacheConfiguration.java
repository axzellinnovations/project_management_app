package com.planora.backend.configuration;

import java.time.Duration;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.github.benmanes.caffeine.cache.Caffeine;

@Configuration
@EnableCaching
public class CacheConfiguration {

    @Bean
    public CacheManager cacheManager() {
        var manager = new CaffeineCacheManager("users-by-identity", "project-membership", "user-details");
        manager.setCaffeine(Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofSeconds(60))
                .maximumSize(500));
        manager.registerCustomCache("project-membership",
                Caffeine.newBuilder()
                        .expireAfterWrite(Duration.ofSeconds(120))
                        .maximumSize(1000)
                        .build());
        return manager;
    }
}
