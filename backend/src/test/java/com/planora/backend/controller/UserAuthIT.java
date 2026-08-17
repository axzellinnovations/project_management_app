package com.planora.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.PostgresIntegrationIT;
import com.planora.backend.model.User;
import com.planora.backend.repository.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "app.cookie.secure=true",
        "app.cookie.samesite=None"
})
class UserAuthIT extends PostgresIntegrationIT {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    @Test
    void refresh_withOnlyLoginCookie_rotatesRefreshTokenAndIssuesAccessToken() throws Exception {
        String rawPassword = "Test@1234";
        String email = "cookie-refresh-" + UUID.randomUUID() + "@example.com";
        seedVerifiedUser(email, rawPassword);

        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .header(HttpHeaders.ORIGIN, "http://localhost:3000")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email,
                                "password", rawPassword
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("planora_refresh_token=")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Secure")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("SameSite=None")))
                .andReturn();

        Cookie refreshCookie = loginResult.getResponse().getCookie("planora_refresh_token");
        assertNotNull(refreshCookie);

        MvcResult refreshResult = mockMvc.perform(post("/api/auth/refresh")
                        .header(HttpHeaders.ORIGIN, "http://localhost:3000")
                        .cookie(refreshCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("planora_refresh_token=")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Secure")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("SameSite=None")))
                .andReturn();

        assertNotNull(readToken(refreshResult));
        Cookie rotatedRefreshCookie = refreshResult.getResponse().getCookie("planora_refresh_token");
        assertNotNull(rotatedRefreshCookie);
        assertNotEquals(refreshCookie.getValue(), rotatedRefreshCookie.getValue());
    }

    @Test
    void loginAndRefresh_withNativeBodyToken_returnsRotatedTokenWithoutCookie() throws Exception {
        String rawPassword = "Test@1234";
        String email = "native-refresh-" + UUID.randomUUID() + "@example.com";
        seedVerifiedUser(email, rawPassword);

        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", rawPassword))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.refreshToken").isString())
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE))
                .andReturn();

        String nativeRefreshToken = objectMapper.readTree(loginResult.getResponse().getContentAsString()).get("refreshToken").asText();
        assertNotNull(nativeRefreshToken);

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", nativeRefreshToken))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.refreshToken").isString())
                .andExpect(header().doesNotExist(HttpHeaders.SET_COOKIE));
    }

    /**
     * Regression guard for the public-endpoint unification.
     *
     * <p>Logout must be entirely unauthenticated so a client can always clear its
     * session even after the access token has already expired. Sending an expired
     * Bearer token must <em>not</em> trigger the 401 path in {@code JwtFilter} —
     * the filter must skip the endpoint and let the controller respond 200.</p>
     */
    @Test
    void logout_withExpiredBearerToken_returns200() throws Exception {
        // Build a JWT that expired 1 second ago using the same secret as application-test.properties.
        // Secret: dGhpcy1pcy1hLXN1cGVyLXNlY3JldC1rZXktMzJieXQ= (Base64 of "this-is-a-super-secret-key-32byt")
        SecretKey signingKey = Keys.hmacShaKeyFor(
                Decoders.BASE64.decode("dGhpcy1pcy1hLXN1cGVyLXNlY3JldC1rZXktMzJieXQ="));

        long nowMs = System.currentTimeMillis();
        String expiredToken = Jwts.builder()
                .claims()
                    .subject("expired-user@example.com")
                    .add("tokenType", "ACCESS")
                    .add("jti", UUID.randomUUID().toString())
                    .issuedAt(new Date(nowMs - 60_000))      // issued 60 s ago
                    .expiration(new Date(nowMs - 1_000))    // expired 1 s ago
                    .and()
                .signWith(signingKey)
                .compact();

        mockMvc.perform(post("/api/auth/logout")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + expiredToken))
                .andExpect(status().isOk());
    }

    private void seedVerifiedUser(String email, String rawPassword) {
        User user = new User();
        user.setUsername("cookie-refresh-user");
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setVerified(true);
        userRepository.saveAndFlush(user);
    }

    private String readToken(MvcResult result) throws Exception {
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return json.get("token").asText();
    }
}
