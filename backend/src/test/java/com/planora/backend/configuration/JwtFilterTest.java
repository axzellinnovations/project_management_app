package com.planora.backend.configuration;

import com.planora.backend.service.JWTService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtFilterTest {

    @Mock
    private JWTService jwtService;

    @Mock
    private UserDetailsService userDetailsService;

    @InjectMocks
    private JwtFilter jwtFilter;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldNotFilter_returnsTrueForOptionsMethod() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/api/tasks");
        assertTrue(jwtFilter.shouldNotFilter(request));
    }

    @Test
    void shouldNotFilter_returnsTrueForPublicLoginEndpoint() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setServletPath("/api/auth/login");
        assertTrue(jwtFilter.shouldNotFilter(request));
    }

    @Test
    void shouldNotFilter_returnsFalseForProtectedEndpoint() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/tasks/1");
        request.setServletPath("/api/tasks/1");
        assertFalse(jwtFilter.shouldNotFilter(request));
    }

    @Test
    void doFilterInternal_setsAuthentication_whenValidToken() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/tasks");
        request.addHeader("Authorization", "Bearer valid-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        UserDetails userDetails = User.withUsername("alice@example.com")
                .password("pass").authorities(Collections.emptyList()).build();

        when(jwtService.extractEmail("valid-token")).thenReturn("alice@example.com");
        when(userDetailsService.loadUserByUsername("alice@example.com")).thenReturn(userDetails);
        when(jwtService.validateToken("valid-token", userDetails)).thenReturn(true);

        jwtFilter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        assertEquals("alice@example.com", SecurityContextHolder.getContext().getAuthentication().getName());
    }

    @Test
    void doFilterInternal_returns401_whenTokenExpired() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/tasks");
        request.addHeader("Authorization", "Bearer expired-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        when(jwtService.extractEmail("expired-token"))
                .thenThrow(new io.jsonwebtoken.ExpiredJwtException(null, null, "Expired"));

        jwtFilter.doFilterInternal(request, response, chain);

        assertEquals(HttpServletResponse.SC_UNAUTHORIZED, response.getStatus());
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void doFilterInternal_returns401_whenMalformedToken() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/tasks");
        request.addHeader("Authorization", "Bearer bad.token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        when(jwtService.extractEmail("bad.token"))
                .thenThrow(new io.jsonwebtoken.MalformedJwtException("Malformed"));

        jwtFilter.doFilterInternal(request, response, chain);

        assertEquals(HttpServletResponse.SC_UNAUTHORIZED, response.getStatus());
    }

    @Test
    void doFilterInternal_continuesChain_whenNoAuthorizationHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/tasks");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        jwtFilter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }
}
