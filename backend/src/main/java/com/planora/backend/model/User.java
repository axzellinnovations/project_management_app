package com.planora.backend.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Entity
@Table(name = "users")
@AllArgsConstructor
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long userId;

    @Column(nullable = false)
    private String username;

    private String fullName;

    @Column(unique = true, nullable = false)
    private String email;

    private String password;

    private boolean verified = false;

    @Column(name = "profile_picture_url")
    private String profilePicUrl;
}
