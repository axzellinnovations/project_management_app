package com.planora.backend.configuration;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import net.ttddyy.dsproxy.QueryCountHolder;
import net.ttddyy.dsproxy.QueryCount;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 50)
@ConditionalOnClass(QueryCountHolder.class)
@ConditionalOnProperty(prefix = "nplus1.guard", name = "enabled", havingValue = "true")
public class QueryGuardrailFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(QueryGuardrailFilter.class);

    @Value("${nplus1.guard.warn-threshold:40}")
    private int warnThreshold;

    @Value("${nplus1.guard.fail-threshold:120}")
    private int failThreshold;

    @Value("${nplus1.guard.fail-on-exceed:false}")
    private boolean failOnExceed;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        long startNanos = System.nanoTime();
        QueryCountHolder.clear();
        try {
            filterChain.doFilter(request, response);
        } finally {
            QueryCount count = QueryCountHolder.getGrandTotal();
            long totalQueries = count != null ? count.getTotal() : 0L;
            String requestKey = request.getMethod() + " " + request.getRequestURI();
            long elapsedMs = (System.nanoTime() - startNanos) / 1_000_000L;
            int status = response.getStatus();

            if (totalQueries > warnThreshold) {
                log.warn("[N+1 Guard] {} -> status={} queries={} elapsedMs={} (warn>{}, fail>{})",
                        requestKey, status, totalQueries, elapsedMs, warnThreshold, failThreshold);
            }

            if (log.isDebugEnabled() && request.getRequestURI().contains("/chat")) {
                log.debug("[N+1 Guard] {} -> status={} queries={} elapsedMs={}",
                        requestKey, status, totalQueries, elapsedMs);
            }

            if (failOnExceed && totalQueries > failThreshold) {
                throw new ServletException("[N+1 Guard] Query threshold exceeded for " + requestKey
                        + " - total SQL statements: " + totalQueries);
            }
        }
    }
}
