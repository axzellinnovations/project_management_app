package com.planora.backend.configuration;

import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;

@Component
@ConfigurationProperties(prefix = "notifications.due-date-reminder")
@Validated
@Getter
@Setter
public class DueDateReminderProperties {

    private boolean enabled = true;

    private String cron = "0 0 12 * * *";

    private String timezone = "UTC";

    private List<Integer> dueSoonDays = List.of(7, 1);

    @Min(1)
    private int overdueFirstDay = 1;

    @Min(1)
    private int overdueIntervalDays = 3;

    public ZoneId zoneId() {
        return ZoneId.of(timezone);
    }

    public List<Integer> normalizedDueSoonDays() {
        return dueSoonDays.stream()
                .filter(day -> day != null && day > 0)
                .distinct()
                .sorted((a, b) -> Integer.compare(b, a))
                .collect(Collectors.toList());
    }
}
