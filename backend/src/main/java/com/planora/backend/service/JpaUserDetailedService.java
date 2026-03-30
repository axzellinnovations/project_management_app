package com.planora.backend.service;

import com.planora.backend.model.User;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class JpaUserDetailedService implements UserDetailsService {

    @Autowired
    private UserRepository repository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = repository.findByEmailIgnoreCase(username).orElse(null);

        if(user == null){
            System.out.println("User is not found");
            throw new UsernameNotFoundException("User is not found");
        }

        if(!user.isVerified()){
            System.out.println("Email is not verified");
            throw new DisabledException("Email is not verified");
        }

        return new UserPrincipal(user);
    }
}
