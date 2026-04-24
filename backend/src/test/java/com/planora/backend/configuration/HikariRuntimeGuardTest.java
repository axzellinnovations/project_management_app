package com.planora.backend.configuration;

import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import javax.sql.DataSource;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HikariRuntimeGuardTest {

    @Mock
    private Environment environment;

    @Test
    void logRuntimePoolConfiguration_skipsGuard_whenDataSourceIsNotHikari() throws Exception {
        DataSource nonHikari = mock(DataSource.class);
        when(nonHikari.isWrapperFor(HikariDataSource.class)).thenReturn(false);

        HikariRuntimeGuard guard = new HikariRuntimeGuard(nonHikari, environment);

        // Should complete without throwing
        assertDoesNotThrow(guard::logRuntimePoolConfiguration);
    }

    @Test
    void logRuntimePoolConfiguration_logsConfig_whenHikariDataSourcePresent() throws Exception {
        HikariDataSource hikari = new HikariDataSource();
        hikari.setMaximumPoolSize(10);
        hikari.setMinimumIdle(2);
        hikari.setJdbcUrl("jdbc:h2:mem:testdb");

        // Non-dev profile, so no pool-size assertion is triggered
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false);

        HikariRuntimeGuard guard = new HikariRuntimeGuard(hikari, environment);

        assertDoesNotThrow(guard::logRuntimePoolConfiguration);

        hikari.close();
    }

    @Test
    void logRuntimePoolConfiguration_throwsIllegalState_whenDevProfileAndPoolTooSmall() throws Exception {
        HikariDataSource hikari = new HikariDataSource();
        hikari.setMaximumPoolSize(2); // below DEV_MIN_POOL_SIZE=8
        hikari.setJdbcUrl("jdbc:h2:mem:testdb2");

        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);

        HikariRuntimeGuard guard = new HikariRuntimeGuard(hikari, environment);

        assertThrows(IllegalStateException.class, guard::logRuntimePoolConfiguration);

        hikari.close();
    }

    @Test
    void logRuntimePoolConfiguration_doesNotThrow_whenDevProfileAndPoolLargeEnough() throws Exception {
        HikariDataSource hikari = new HikariDataSource();
        hikari.setMaximumPoolSize(10);
        hikari.setJdbcUrl("jdbc:h2:mem:testdb3");

        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);

        HikariRuntimeGuard guard = new HikariRuntimeGuard(hikari, environment);

        assertDoesNotThrow(guard::logRuntimePoolConfiguration);

        hikari.close();
    }
}
