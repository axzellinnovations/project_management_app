package com.planora.backend.repository;

import com.planora.backend.model.ProjectType;

import com.planora.backend.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for user profile-related persistence via {@link UserRepository}.
 *
 * There is no separate UserProfileRepository — all extended profile fields
 * (firstName, lastName, jobTitle, company, bio, contactNumber, etc.) are
 * stored on the {@link User} entity and persisted through {@link UserRepository}.
 * These tests validate that those fields round-trip correctly through JPA.
 */
@ActiveProfiles("test")
@DataJpaTest
class UserProfileRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private UserRepository userRepository;

    private User alice;

    @BeforeEach
    void setUp() {
        alice = new User();
        alice.setEmail("alice@example.com");
        alice.setUsername("alice");
        alice.setPassword("hashed_password");
        alice.setVerified(true);
        // Profile fields
        alice.setFullName("Alice Smith");
        alice.setFirstName("Alice");
        alice.setLastName("Smith");
        alice.setJobTitle("Software Engineer");
        alice.setCompany("Planora Inc.");
        alice.setPosition("Backend Lead");
        alice.setBio("Loves clean code.");
        alice.setContactNumber("+1-555-000-1234");
        alice.setCountryCode("+1");
        entityManager.persist(alice);
        entityManager.flush();
    }

    // ── Profile field persistence ─────────────────────────────────────────────

    @Test
    void save_persistsAllProfileFields_andCanBeReloaded() {
        entityManager.clear();
        User found = userRepository.findById(alice.getUserId()).orElseThrow();

        assertEquals("Alice Smith",       found.getFullName());
        assertEquals("Alice",             found.getFirstName());
        assertEquals("Smith",             found.getLastName());
        assertEquals("Software Engineer", found.getJobTitle());
        assertEquals("Planora Inc.",      found.getCompany());
        assertEquals("Backend Lead",      found.getPosition());
        assertEquals("Loves clean code.", found.getBio());
        assertEquals("+1-555-000-1234",   found.getContactNumber());
        assertEquals("+1",                found.getCountryCode());
    }

    @Test
    void update_profileFields_persistsChanges() {
        alice.setJobTitle("Principal Engineer");
        alice.setBio("Building great products.");
        alice.setCompany("New Corp");
        userRepository.save(alice);
        entityManager.flush();
        entityManager.clear();

        User updated = userRepository.findById(alice.getUserId()).orElseThrow();
        assertEquals("Principal Engineer",     updated.getJobTitle());
        assertEquals("Building great products.", updated.getBio());
        assertEquals("New Corp",               updated.getCompany());
    }

    @Test
    void update_profilePicUrl_persistsUrl() {
        alice.setProfilePicUrl("s3://bucket/alice/photo.jpg");
        userRepository.save(alice);
        entityManager.flush();
        entityManager.clear();

        User updated = userRepository.findById(alice.getUserId()).orElseThrow();
        assertEquals("s3://bucket/alice/photo.jpg", updated.getProfilePicUrl());
    }

    @Test
    void update_profilePicUrl_canBeSetToNull() {
        alice.setProfilePicUrl("s3://bucket/alice/old.jpg");
        userRepository.save(alice);
        entityManager.flush();

        alice.setProfilePicUrl(null);
        userRepository.save(alice);
        entityManager.flush();
        entityManager.clear();

        User updated = userRepository.findById(alice.getUserId()).orElseThrow();
        assertNull(updated.getProfilePicUrl());
    }

    @Test
    void update_notificationPreference_persistsCorrectly() {
        // Default is true
        assertTrue(alice.isNotifyDueDateReminders());

        alice.setNotifyDueDateReminders(false);
        userRepository.save(alice);
        entityManager.flush();
        entityManager.clear();

        User updated = userRepository.findById(alice.getUserId()).orElseThrow();
        assertFalse(updated.isNotifyDueDateReminders());
    }

    @Test
    void save_profileFields_canBeBlankStrings() {
        alice.setBio("");
        alice.setJobTitle("");
        userRepository.save(alice);
        entityManager.flush();
        entityManager.clear();

        User updated = userRepository.findById(alice.getUserId()).orElseThrow();
        assertEquals("", updated.getBio());
        assertEquals("", updated.getJobTitle());
    }

    // ── findByEmail ───────────────────────────────────────────────────────────

    @Test
    void findByEmailIgnoreCase_returnsUserWithProfileFields() {
        entityManager.clear();
        Optional<User> result = userRepository.findByEmailIgnoreCase("ALICE@EXAMPLE.COM");

        assertTrue(result.isPresent());
        assertEquals("Alice Smith", result.get().getFullName());
        assertEquals("Planora Inc.", result.get().getCompany());
    }

    // ── Multiple users with profiles ──────────────────────────────────────────

    @Test
    void multipleUsers_eachHaveIndependentProfileFields() {
        User bob = new User();
        bob.setEmail("bob@example.com");
        bob.setUsername("bob");
        bob.setPassword("hashed_password_2");
        bob.setVerified(true);
        bob.setFullName("Bob Jones");
        bob.setJobTitle("QA Engineer");
        bob.setCompany("TestCorp");
        entityManager.persist(bob);
        entityManager.flush();
        entityManager.clear();

        User foundAlice = userRepository.findByEmail("alice@example.com");
        User foundBob   = userRepository.findByEmail("bob@example.com");

        assertEquals("Alice Smith",  foundAlice.getFullName());
        assertEquals("Planora Inc.", foundAlice.getCompany());
        assertEquals("Bob Jones",    foundBob.getFullName());
        assertEquals("TestCorp",     foundBob.getCompany());
    }
}
