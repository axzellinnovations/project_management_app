package com.planora.backend.controller;

import com.planora.backend.model.User;
import com.planora.backend.model.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pure unit tests for UserPrincipal — no Spring context needed.
 */
class UserPrincipalTest {

    private User user;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setUserId(42L);
        user.setEmail("alice@example.com");
        user.setPassword("hashedPassword");
        user.setUsername("alice");
        user.setVerified(true);
        principal = new UserPrincipal(user);
    }

    @Test
    void getUserId_returnsCorrectId() {
        assertEquals(42L, principal.getUserId());
    }

    @Test
    void getUsername_returnsEmail() {
        assertEquals("alice@example.com", principal.getUsername());
    }

    @Test
    void getPassword_returnsHashedPassword() {
        assertEquals("hashedPassword", principal.getPassword());
    }

    @Test
    void getAuthorities_containsUserRole() {
        assertTrue(principal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("USER")));
    }

    @Test
    void isEnabled_returnsTrueWhenUserIsVerified() {
        assertTrue(principal.isEnabled());
    }

    @Test
    void isEnabled_returnsFalseWhenUserNotVerified() {
        user.setVerified(false);
        UserPrincipal unverifiedPrincipal = new UserPrincipal(user);
        assertFalse(unverifiedPrincipal.isEnabled());
    }

    @Test
    void isAccountNonExpired_alwaysReturnsTrue() {
        assertTrue(principal.isAccountNonExpired());
    }

    @Test
    void isAccountNonLocked_alwaysReturnsTrue() {
        assertTrue(principal.isAccountNonLocked());
    }

    @Test
    void isCredentialsNonExpired_alwaysReturnsTrue() {
        assertTrue(principal.isCredentialsNonExpired());
    }
}
