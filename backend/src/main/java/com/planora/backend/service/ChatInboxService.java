package com.planora.backend.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;

import com.planora.backend.dto.ProjectResponseDTO;
import com.planora.backend.model.ChatRoom;
import com.planora.backend.repository.ChatRoomMemberRepository;
import com.planora.backend.repository.ChatRoomRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ChatInboxService {

    public record ChatInboxActivity(
            Long projectId,
            String projectName,
            String chatType,
            Long roomId,
            String roomName,
            String username,
            String participantLabel,
            String lastMessage,
            String lastMessageSender,
            String lastMessageTimestamp,
            long unseenCount,
            boolean unread,
            String activityStatus
    ) {}

    public record ChatInboxProjectGroup(
            Long projectId,
            String projectName,
            long unreadCount,
            long totalItems,
            List<ChatInboxActivity> activities
    ) {}

    public record ChatInboxResponse(
            List<ChatInboxActivity> recentActivities,
            List<ChatInboxProjectGroup> projects,
            long totalProjects,
            long totalActivities,
            long totalUnread
    ) {}

    private static final Comparator<ChatInboxActivity> ACTIVITY_SORT =
            Comparator.comparing((ChatInboxActivity a) -> parseTimestamp(a.lastMessageTimestamp())).reversed();

    private final ChatService chatService;
    private final ProjectService projectService;
    private final TeamMemberRepository teamMemberRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomMemberRepository chatRoomMemberRepository;
    private final UserRepository userRepository;

    public ChatInboxResponse getInbox(
            Long userId,
            String usernameOrEmail,
            int projectLimit,
            int activityLimit,
            String status
    ) {
        var currentUser = resolveUserByEmailOrUsername(usernameOrEmail);
        if (currentUser == null) {
            return new ChatInboxResponse(List.of(), List.of(), 0, 0, 0);
        }

        List<ProjectResponseDTO> projects = projectService.getProjectsForUser(userId, null, null, null);
        if (projectLimit > 0 && projects.size() > projectLimit) {
            projects = projects.subList(0, projectLimit);
        }

        Set<Long> memberRoomIds = chatRoomMemberRepository.findByUserUserId(currentUser.getUserId()).stream()
                .map(roomMember -> roomMember.getChatRoom().getId())
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        // Pre-fetch team members for all projects to avoid N+1 inside the loop
        java.util.Set<Long> allTeamIds = projects.stream()
                .map(ProjectResponseDTO::getTeamId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        java.util.Map<Long, List<String>> participantsByTeam = new java.util.HashMap<>();
        for (Long tid : allTeamIds) {
            participantsByTeam.put(tid, teamMemberRepository.findByTeamId(tid).stream()
                    .map(tm -> tm.getUser() != null ? tm.getUser().getUsername() : null)
                    .filter(name -> name != null && !name.isBlank())
                    .toList());
        }

        List<ChatInboxProjectGroup> grouped = new ArrayList<>();
        List<ChatInboxActivity> allActivities = new ArrayList<>();

        for (ProjectResponseDTO project : projects) {
            Long projectId = project.getId();
            Long teamId = project.getTeamId();
            if (projectId == null || teamId == null) {
                continue;
            }

            List<String> participants = participantsByTeam.getOrDefault(teamId, List.of());

            List<ChatRoom> visibleRooms = getVisibleRooms(projectId, currentUser, usernameOrEmail, memberRoomIds);
            List<ChatInboxActivity> projectActivities = new ArrayList<>();

            var teamSummary = chatService.buildTeamSummary(projectId, currentUser, usernameOrEmail);
            ChatInboxActivity teamActivity = toTeamActivity(projectId, project.getName(), teamSummary);
            if (teamActivity != null) {
                projectActivities.add(teamActivity);
            }

            for (var roomSummary : chatService.buildRoomSummaries(projectId, currentUser, usernameOrEmail, visibleRooms)) {
                if (roomSummary.lastMessageTimestamp() == null) {
                    continue;
                }

                boolean unread = roomSummary.unseenCount() > 0;
                projectActivities.add(new ChatInboxActivity(
                        projectId,
                        project.getName(),
                        "ROOM",
                        roomSummary.roomId(),
                        roomSummary.roomName(),
                        null,
                        roomSummary.roomName(),
                        roomSummary.lastMessage(),
                        roomSummary.lastMessageSender(),
                        roomSummary.lastMessageTimestamp(),
                        roomSummary.unseenCount(),
                        unread,
                        unread ? "UNREAD" : "READ"
                ));
            }

            for (var directSummary : chatService.buildDirectSummaries(projectId, currentUser, usernameOrEmail, participants)) {
                if (directSummary.lastMessageTimestamp() == null) {
                    continue;
                }

                boolean unread = directSummary.unseenCount() > 0;
                projectActivities.add(new ChatInboxActivity(
                        projectId,
                        project.getName(),
                        "DIRECT",
                        null,
                        null,
                        directSummary.username(),
                        directSummary.username(),
                        directSummary.lastMessage(),
                        directSummary.lastMessageSender(),
                        directSummary.lastMessageTimestamp(),
                        directSummary.unseenCount(),
                        unread,
                        unread ? "UNREAD" : "READ"
                ));
            }

            if ("unread".equals(status)) {
                projectActivities.removeIf(activity -> !activity.unread());
            }

            projectActivities.sort(ACTIVITY_SORT);

            if (projectActivities.isEmpty()) {
                continue;
            }

            long unreadCount = projectActivities.stream().mapToLong(ChatInboxActivity::unseenCount).sum();
            grouped.add(new ChatInboxProjectGroup(
                    projectId,
                    project.getName(),
                    unreadCount,
                    projectActivities.size(),
                    List.copyOf(projectActivities)
            ));

            allActivities.addAll(projectActivities);
        }

        allActivities.sort(ACTIVITY_SORT);
        List<ChatInboxActivity> recentActivities = allActivities.stream()
                .limit(Math.max(1, activityLimit))
                .toList();

        long totalUnread = allActivities.stream().mapToLong(ChatInboxActivity::unseenCount).sum();
        return new ChatInboxResponse(
                recentActivities,
                List.copyOf(grouped),
                grouped.size(),
                allActivities.size(),
                totalUnread
        );
    }

    private ChatInboxActivity toTeamActivity(
            Long projectId,
            String projectName,
            ChatService.TeamChatSummary summary
    ) {
        if (summary.lastMessageTimestamp() == null) {
            return null;
        }

        boolean unread = summary.unseenCount() > 0;
        return new ChatInboxActivity(
                projectId,
                projectName,
                "TEAM",
                null,
                null,
                null,
                "Team Chat",
                summary.lastMessage(),
                summary.lastMessageSender(),
                summary.lastMessageTimestamp(),
                summary.unseenCount(),
                unread,
                unread ? "UNREAD" : "READ"
        );
    }

    private List<ChatRoom> getVisibleRooms(
            Long projectId,
            com.planora.backend.model.User currentUser,
            String usernameOrEmail,
            Set<Long> memberRoomIds
    ) {
        Set<String> currentAliases = Stream.of(
                        usernameOrEmail,
                        currentUser.getUsername(),
                        currentUser.getEmail()
                )
                .filter(value -> value != null && !value.isBlank())
                .map(String::toLowerCase)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        return chatRoomRepository.findByProjectId(projectId).stream()
                .filter(room -> {
                    if (room.getId() != null && memberRoomIds.contains(room.getId())) {
                        return true;
                    }
                    String createdBy = room.getCreatedBy();
                    return createdBy != null && currentAliases.contains(createdBy.toLowerCase());
                })
                .filter(room -> !Boolean.TRUE.equals(room.getArchived()))
                .toList();
    }

    private com.planora.backend.model.User resolveUserByEmailOrUsername(String usernameOrEmail) {
        if (usernameOrEmail == null || usernameOrEmail.isBlank()) {
            return null;
        }

        String normalized = usernameOrEmail.toLowerCase();
        if (normalized.contains("@")) {
            var byEmail = userRepository.findByEmailIgnoreCase(normalized).orElse(null);
            if (byEmail != null) {
                return byEmail;
            }
            return userRepository.findByUsernameIgnoreCase(normalized).orElse(null);
        }

        var byUsername = userRepository.findByUsernameIgnoreCase(normalized).orElse(null);
        if (byUsername != null) {
            return byUsername;
        }

        return userRepository.findByEmailIgnoreCase(normalized).orElse(null);
    }

    private static LocalDateTime parseTimestamp(String rawTimestamp) {
        if (rawTimestamp == null || rawTimestamp.isBlank()) {
            return LocalDateTime.MIN;
        }

        try {
            return LocalDateTime.parse(rawTimestamp);
        } catch (Exception ex) {
            return LocalDateTime.MIN;
        }
    }
}
