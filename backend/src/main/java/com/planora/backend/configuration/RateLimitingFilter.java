package com.planora.backend.configuration;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * In-memory, per-IP rate limiter for sensitive auth endpoints.
 * Allows at most 5 requests per minute per IP on the configured paths.
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(RateLimitingFilter.class);

    private static final int MAX_REQUESTS_PER_MINUTE = 5;
    private static final int MAX_INVITATIONS_PER_HOUR = 10;

    private static final Pattern PROJECT_INVITE_PATH = Pattern.compile("^/api/projects/(\\d+)/invitations$");

    private static final List<String> RATE_LIMITED_PATHS = List.of(
            "/api/auth/login",
            "/api/auth/forgot",
            "/api/auth/resend",
            "/api/auth/resend-otp"
    );

    /** One bucket per (IP + path) key. */
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        if (isProjectInviteRequest(request)) {
            return false;
        }
        return RATE_LIMITED_PATHS.stream().noneMatch(path::equals);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String key;
        Bucket bucket;

        if (isProjectInviteRequest(request)) {
            Matcher matcher = PROJECT_INVITE_PATH.matcher(request.getServletPath());
            String projectId = matcher.find() ? matcher.group(1) : "unknown";
            key = "invite-project:" + projectId;
            bucket = buckets.computeIfAbsent(key, k -> newInvitationBucket());
        } else {
            key = resolveClientIp(request) + ":" + request.getServletPath();
            bucket = buckets.computeIfAbsent(key, k -> newBucket());
        }

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            logger.warn("Rate limit exceeded for key={}", key);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            if (isProjectInviteRequest(request)) {
                response.getWriter().write("{\"message\":\"Too many invitations sent, try again in 1 hour\"}");
            } else {
                response.getWriter().write("{\"error\":\"Too many requests. Please try again later.\"}");
            }
        }
    }

    private Bucket newBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(MAX_REQUESTS_PER_MINUTE)
                .refillIntervally(MAX_REQUESTS_PER_MINUTE, Duration.ofMinutes(1))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    private Bucket newInvitationBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(MAX_INVITATIONS_PER_HOUR)
                .refillIntervally(MAX_INVITATIONS_PER_HOUR, Duration.ofHours(1))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    private boolean isProjectInviteRequest(HttpServletRequest request) {
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        return PROJECT_INVITE_PATH.matcher(request.getServletPath()).matches();
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
