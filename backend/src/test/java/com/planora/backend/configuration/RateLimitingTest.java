package com.planora.backend.configuration;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RateLimitingTest {

    @InjectMocks
    private RateLimitingFilter rateLimitingFilter;

    @Test
    void shouldNotFilter_returnsTrueForNonRateLimitedPath() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/tasks");
        request.setServletPath("/api/tasks");
        assertTrue(rateLimitingFilter.shouldNotFilter(request));
    }

    @Test
    void shouldNotFilter_returnsFalseForLoginPath() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setServletPath("/api/auth/login");
        assertFalse(rateLimitingFilter.shouldNotFilter(request));
    }

    @Test
    void shouldNotFilter_returnsFalseForProjectInvitePath() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/projects/10/invitations");
        request.setServletPath("/api/projects/10/invitations");
        assertFalse(rateLimitingFilter.shouldNotFilter(request));
    }

    @Test
    void doFilterInternal_allowsFirstFiveRequests() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setServletPath("/api/auth/login");
        request.setRemoteAddr("127.0.0.1");
        FilterChain chain = mock(FilterChain.class);

        // Should allow first 5 requests
        for (int i = 0; i < 5; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            rateLimitingFilter.doFilterInternal(request, response, chain);
            assertEquals(200, response.getStatus(), "Request " + (i + 1) + " should be allowed");
        }
        verify(chain, times(5)).doFilter(any(), any());
    }

    @Test
    void doFilterInternal_blocks6thRequest() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/forgot");
        request.setServletPath("/api/auth/forgot");
        request.setRemoteAddr("10.0.0.1");
        FilterChain chain = mock(FilterChain.class);

        // Drain the bucket
        for (int i = 0; i < 5; i++) {
            rateLimitingFilter.doFilterInternal(request, new MockHttpServletResponse(), chain);
        }

        // 6th request should be rate-limited
        MockHttpServletResponse blocked = new MockHttpServletResponse();
        rateLimitingFilter.doFilterInternal(request, blocked, chain);
        assertEquals(429, blocked.getStatus());
    }

    @Test
    void resolveClientIp_usesXForwardedForHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setServletPath("/api/auth/login");
        request.addHeader("X-Forwarded-For", "192.168.1.100, 10.0.0.1");
        FilterChain chain = mock(FilterChain.class);

        // Should not throw — the test just validates it runs without error
        MockHttpServletResponse response = new MockHttpServletResponse();
        rateLimitingFilter.doFilterInternal(request, response, chain);
        verify(chain).doFilter(request, response);
    }
}
