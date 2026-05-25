package com.planora.backend.configuration;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Activates Spring's @Scheduled processing.
 * Required for GithubSyncService's periodic sync task.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
