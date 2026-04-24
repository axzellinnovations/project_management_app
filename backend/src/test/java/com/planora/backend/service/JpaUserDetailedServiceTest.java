package com.planora.backend.service;

import com.planora.backend.model.User;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JpaUserDetailedServiceTest {

    @Mock
    private UserRepository repository;

    @InjectMocks
    private JpaUserDetailedService jpaUserDetailedService;

    private User verifiedUser;

    @BeforeEach
    void setUp() {
        verifiedUser = new User();
        verifiedUser.setUserId(1L);
        verifiedUser.setEmail("alice@example.com");
        verifiedUser.setPassword("hashed");
        verifiedUser.setUsername("alice");
        verifiedUser.setVerified(true);
    }

    @Test
    void loadUserByUsername_returnsUserPrincipal_whenUserExistsAndVerified() {
        when(repository.findByEmailIgnoreCase("alice@example.com")).thenReturn(Optional.of(verifiedUser));

        UserDetails result = jpaUserDetailedService.loadUserByUsername("alice@example.com");

        assertInstanceOf(UserPrincipal.class, result);
        assertEquals("alice@example.com", result.getUsername());
    }

    @Test
    void loadUserByUsername_throwsUsernameNotFoundException_whenUserNotFound() {
        when(repository.findByEmailIgnoreCase("nobody@example.com")).thenReturn(Optional.empty());

        assertThrows(UsernameNotFoundException.class,
                () -> jpaUserDetailedService.loadUserByUsername("nobody@example.com"));
    }

    @Test
    void loadUserByUsername_throwsDisabledException_whenUserNotVerified() {
        verifiedUser.setVerified(false);
        when(repository.findByEmailIgnoreCase("alice@example.com")).thenReturn(Optional.of(verifiedUser));

        assertThrows(DisabledException.class,
                () -> jpaUserDetailedService.loadUserByUsername("alice@example.com"));
    }

    @Test
    void loadUserByUsername_isCaseInsensitive() {
        when(repository.findByEmailIgnoreCase("ALICE@EXAMPLE.COM")).thenReturn(Optional.of(verifiedUser));

        UserDetails result = jpaUserDetailedService.loadUserByUsername("ALICE@EXAMPLE.COM");

        assertNotNull(result);
    }
}
