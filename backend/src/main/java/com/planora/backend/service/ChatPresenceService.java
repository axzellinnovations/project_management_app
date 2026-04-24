package com.planora.backend.service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

@Service
public class ChatPresenceService {

    // project -> online aliases, used for fast presence snapshots.
    private final Map<Long, Set<String>> onlineUsersByProject = new ConcurrentHashMap<>();
    // session -> projects visited by that socket, used to cleanly fan-out disconnect updates.
    private final Map<String, Set<Long>> projectsBySession = new ConcurrentHashMap<>();

    public List<String> markOnline(Long projectId, String username, String sessionId) {
        if (projectId == null || username == null || username.isBlank()) {
            return List.of();
        }

        onlineUsersByProject
                .computeIfAbsent(projectId, key -> ConcurrentHashMap.newKeySet())
                .add(username.toLowerCase());

        if (sessionId != null && !sessionId.isBlank()) {
            projectsBySession
                    .computeIfAbsent(sessionId, key -> ConcurrentHashMap.newKeySet())
                    .add(projectId);
        }

        return getOnlineUsers(projectId);
    }

    public List<String> getOnlineUsers(Long projectId) {
        if (projectId == null) {
            return List.of();
        }

        var users = onlineUsersByProject.getOrDefault(projectId, Set.of());
        return users.stream().sorted().toList();
    }

    public Map<Long, List<String>> markOfflineForSession(String sessionId, String username) {
        if (sessionId == null || sessionId.isBlank() || username == null || username.isBlank()) {
            return Map.of();
        }

        var projectIds = projectsBySession.remove(sessionId);
        if (projectIds == null || projectIds.isEmpty()) {
            return Map.of();
        }

        Map<Long, List<String>> updatedPresence = new HashMap<>();
        for (Long projectId : new HashSet<>(projectIds)) {
            var users = onlineUsersByProject.get(projectId);
            if (users == null) {
                continue;
            }

            users.remove(username.toLowerCase());
            if (users.isEmpty()) {
                // Remove empty buckets to keep presence memory bounded for long-lived processes.
                onlineUsersByProject.remove(projectId);
                updatedPresence.put(projectId, List.of());
                continue;
            }

            updatedPresence.put(projectId, users.stream().sorted().toList());
        }

        return updatedPresence;
    }
}
