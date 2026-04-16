package com.planora.backend.configuration;

import com.zaxxer.hikari.HikariDataSource;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

@Component
public class HikariRuntimeGuard {

    private static final Logger logger = LoggerFactory.getLogger(HikariRuntimeGuard.class);
    private static final int DEV_MIN_POOL_SIZE = 8;

    private final DataSource dataSource;
    private final Environment environment;

    public HikariRuntimeGuard(DataSource dataSource, Environment environment) {
        this.dataSource = dataSource;
        this.environment = environment;
    }

    @PostConstruct
    public void logRuntimePoolConfiguration() {
        HikariDataSource hikari = resolveHikariDataSource();
        if (hikari == null) {
            logger.info("Datasource is not HikariCP (type={}), skipping runtime pool guard", dataSource.getClass().getName());
            return;
        }

        logger.info(
                "Hikari runtime config resolved: maxPoolSize={}, minIdle={}, connectionTimeoutMs={}, validationTimeoutMs={}, maxLifetimeMs={}, keepaliveTimeMs={}",
                hikari.getMaximumPoolSize(),
                hikari.getMinimumIdle(),
                hikari.getConnectionTimeout(),
                hikari.getValidationTimeout(),
                hikari.getMaxLifetime(),
                hikari.getKeepaliveTime()
        );

        if (environment.acceptsProfiles(Profiles.of("dev")) && hikari.getMaximumPoolSize() < DEV_MIN_POOL_SIZE) {
            throw new IllegalStateException(
                    "Unsafe dev Hikari max pool size detected: " + hikari.getMaximumPoolSize()
                            + " (minimum required " + DEV_MIN_POOL_SIZE + "). "
                            + "Update DB_POOL_MAX_SIZE or SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE."
            );
        }
    }

    private HikariDataSource resolveHikariDataSource() {
        if (dataSource instanceof HikariDataSource hikariDataSource) {
            return hikariDataSource;
        }
        try {
            if (dataSource.isWrapperFor(HikariDataSource.class)) {
                return dataSource.unwrap(HikariDataSource.class);
            }
        } catch (Exception ex) {
            logger.debug("Failed to unwrap HikariDataSource from {}", dataSource.getClass().getName(), ex);
        }
        return null;
    }
}
