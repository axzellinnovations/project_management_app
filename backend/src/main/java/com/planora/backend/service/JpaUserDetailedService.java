package com.planora.backend.service;

import com.planora.backend.model.User;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.repository.UserRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

/**
 * It only understands objects that implement its internal "UserDetails" interface.
 * This service is automatically called by Spring during the login process to fetch
 *  the user's credentials and account state from the database.
 */
@Service
@RequiredArgsConstructor
public class JpaUserDetailedService implements UserDetailsService {

    private final UserRepository repository;

    /**
     * Loads the user's security profile based on their primary identifier.
     * * CACHING: Spring Security might call this method frequently (e.g., during filter chains).
     * Caching the result prevents a database query on every single secured API request.
     * sync = true prevents multiple threads from simultaneously querying the DB for the same uncached user.
     */
    @Override
    @Cacheable(cacheNames = "user-details", key = "#username.toLowerCase()", sync = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {

        // Step 1. Fetch the user.
        // Note: Spring Security uses the parameter name "username" universally to mean "primary identity".
        // In our specific system architecture, the primary identity for login is actually the email.
        User user = repository.findByEmailIgnoreCase(username).orElse(null);

        // Step 2. Fail fast if the user doesn't exist in our database.
        if(user == null){
            System.out.println("User is not found");
            throw new UsernameNotFoundException("User is not found");
        }

        // Step 3. Enforce the email verification business rule at the core security layer.
        // Throwing DisabledException tells Spring Security to reject the login attempt
        // entirely, EVEN IF the user provided the perfectly correct password.
        if(!user.isVerified()){
            System.out.println("Email is not verified");
            throw new DisabledException("Email is not verified");
        }

        // Step 4. Wrap our custom User entity inside a UserPrincipal (which implements UserDetails).
        // This packages our database data into the exact format Spring Security requires to do its job.
        return new UserPrincipal(user);
    }
}
