package com.planora.backend.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;

import com.planora.backend.dto.ProjectResponseDTO;
import com.planora.backend.model.ChatRoom;
import com.planora.backend.model.ChatMessage;
import com.planora.backend.repository.ChatMessageRepository;
import com.planora.backend.repository.ChatRoomMemberRepository;
import com.planora.backend.repository.ChatRoomRepository;
import com.planora.backend.repository.TeamMemberRepository;

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
    private record ProjectRoomKey(Long projectId, Long roomId) {}
    private record ProjectDirectKey(Long projectId, String participant) {}

    private final ChatService chatService;
    private final ProjectService projectService;
    private final TeamMemberRepository teamMemberRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomMemberRepository chatRoomMemberRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final UserCacheService userCacheService;

    public ChatInboxResponse getInbox(
            Long userId,
            String usernameOrEmail,
            int projectLimit,
            int activityLimit,
            String status
    ) {
        var currentUser = userCacheService.resolveUserByEmailOrUsername(usernameOrEmail);
        if (currentUser == null) {
            return new ChatInboxResponse(List.of(), List.of(), 0, 0, 0);
        }

        List<ProjectResponseDTO> projects = projectService.getProjectsForUser(userId, null, null, null);
        if (projectLimit > 0 && projects.size() > projectLimit) {
            projects = projects.subList(0, projectLimit);
        }
        var projectIds = projects.stream()
                .map(ProjectResponseDTO::getId)
                .filter(Objects::nonNull)
                .toList();

        Set<Long> memberRoomIds = chatRoomMemberRepository.findRoomIdsByUserId(currentUser.getUserId()).stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        // Pre-fetch team members for all projects to avoid N+1 inside the loop
        java.util.Set<Long> allTeamIds = projects.stream()
                .map(ProjectResponseDTO::getTeamId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        Map<Long, List<String>> participantsByTeam = allTeamIds.isEmpty()
                ? Map.of()
                : teamMemberRepository.findByTeamIdIn(allTeamIds).stream()
                        .filter(tm -> tm.getTeam() != null && tm.getTeam().getId() != null)
                        .filter(tm -> tm.getUser() != null && tm.getUser().getUsername() != null && !tm.getUser().getUsername().isBlank())
                        .collect(Collectors.groupingBy(
                                tm -> tm.getTeam().getId(),
                                Collectors.mapping(tm -> tm.getUser().getUsername(), Collectors.toList())));

        Map<Long, List<ChatRoom>> roomsByProject = projectIds.isEmpty()
                ? Map.of()
                : chatRoomRepository.findByProjectIdIn(projectIds).stream()
                        .filter(room -> room.getProjectId() != null)
                        .collect(Collectors.groupingBy(ChatRoom::getProjectId));

        Map<Long, List<ChatRoom>> visibleRoomsByProject = new LinkedHashMap<>();
        Map<Long, List<String>> participantsByProject = new LinkedHashMap<>();
        for (ProjectResponseDTO project : projects) {
            Long projectId = project.getId();
            Long teamId = project.getTeamId();
            if (projectId == null || teamId == null) {
                continue;
            }
            participantsByProject.put(projectId, participantsByTeam.getOrDefault(teamId, List.of()));
            visibleRoomsByProject.put(
                    projectId,
                    getVisibleRooms(roomsByProject.getOrDefault(projectId, List.of()), currentUser, usernameOrEmail, memberRoomIds));
        }

        var currentUserAliases = resolveUserAliases(currentUser, usernameOrEmail);
        var allVisibleRoomIds = visibleRoomsByProject.values().stream()
                .flatMap(List::stream)
                .map(ChatRoom::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<ProjectRoomKey, ChatMessage> latestRoomMessageByProjectRoom = allVisibleRoomIds.isEmpty()
                ? Map.of()
                : chatMessageRepository.findLatestMessagesForRoomsInProjects(projectIds, allVisibleRoomIds).stream()
                        .filter(m -> m.getProjectId() != null && m.getRoomId() != null)
                        .collect(Collectors.toMap(
                                m -> new ProjectRoomKey(m.getProjectId(), m.getRoomId()),
                                m -> m,
                                (m1, m2) -> m1));
        Map<ProjectRoomKey, Long> roomUnreadByProjectRoom = allVisibleRoomIds.isEmpty()
                ? Map.of()
                : chatMessageRepository.countUnreadBatchRoomsForProjects(projectIds, allVisibleRoomIds, currentUserAliases, currentUser.getUserId()).stream()
                        .collect(Collectors.toMap(
                                row -> new ProjectRoomKey((Long) row[0], (Long) row[1]),
                                row -> ((Number) row[2]).longValue(),
                                (v1, v2) -> v1));

        Map<ProjectDirectKey, ChatMessage> latestDirectByProjectParticipant = projectIds.isEmpty()
                ? Map.of()
                : chatMessageRepository.findLatestMessagesForDirectsInProjects(projectIds, currentUserAliases).stream()
                        .filter(m -> m.getProjectId() != null)
                        .collect(Collectors.toMap(
                                m -> new ProjectDirectKey(
                                        m.getProjectId(),
                                        currentUserAliases.contains((m.getSender() != null ? m.getSender().toLowerCase() : ""))
                                                ? (m.getRecipient() != null ? m.getRecipient().toLowerCase() : "")
                                                : (m.getSender() != null ? m.getSender().toLowerCase() : "")),
                                m -> m,
                                (m1, m2) -> m1));
        Map<ProjectDirectKey, Long> directUnreadByProjectParticipant = projectIds.isEmpty()
                ? Map.of()
                : chatMessageRepository.countUnreadBatchDirectsForProjects(projectIds, currentUserAliases, currentUser.getUserId()).stream()
                        .collect(Collectors.toMap(
                                row -> new ProjectDirectKey((Long) row[0], (String) row[1]),
                                row -> ((Number) row[2]).longValue(),
                                (v1, v2) -> v1));

        var latestTeamMessagesByProject = chatMessageRepository.findLatestTeamMessagesForProjects(projectIds).stream()
                .collect(Collectors.toMap(message -> message.getProjectId(), message -> message, (m1, m2) -> m1));

        Map<Long, Long> teamUnreadByProject = projectIds.isEmpty()
                ? Map.of()
                : chatMessageRepository.countUnreadTeamMessagesForProjectsByAliases(
                                projectIds,
                                currentUserAliases,
                                currentUser.getUserId(),
                                "__TEAM_CHAT__")
                        .stream()
                        .collect(Collectors.toMap(
                                row -> (Long) row[0],
                                row -> ((Number) row[1]).longValue(),
                                (v1, v2) -> v1));

        List<ChatInboxProjectGroup> grouped = new ArrayList<>();
        List<ChatInboxActivity> allActivities = new ArrayList<>();

        for (ProjectResponseDTO project : projects) {
            Long projectId = project.getId();
            Long teamId = project.getTeamId();
            if (projectId == null || teamId == null) {
                continue;
            }

            List<String> participants = participantsByProject.getOrDefault(projectId, List.of());
            List<ChatRoom> visibleRooms = visibleRoomsByProject.getOrDefault(projectId, List.of());
            List<ChatInboxActivity> projectActivities = new ArrayList<>();

            var teamSummary = chatService.buildTeamSummary(
                    latestTeamMessagesByProject.get(projectId),
                    teamUnreadByProject.getOrDefault(projectId, 0L));
            ChatInboxActivity teamActivity = toTeamActivity(projectId, project.getName(), teamSummary);
            if (teamActivity != null) {
                projectActivities.add(teamActivity);
            }

            for (var room : visibleRooms) {
                var latestRoomMessage = latestRoomMessageByProjectRoom.get(new ProjectRoomKey(projectId, room.getId()));
                if (latestRoomMessage == null || latestRoomMessage.getTimestamp() == null) {
                    continue;
                }
                long unreadCount = roomUnreadByProjectRoom.getOrDefault(new ProjectRoomKey(projectId, room.getId()), 0L);
                boolean unread = unreadCount > 0;
                projectActivities.add(new ChatInboxActivity(
                        projectId,
                        project.getName(),
                        "ROOM",
                        room.getId(),
                        room.getName(),
                        null,
                        room.getName(),
                        latestRoomMessage.getContent(),
                        latestRoomMessage.getSender(),
                        latestRoomMessage.getTimestamp().toString(),
                        unreadCount,
                        unread,
                        unread ? "UNREAD" : "READ"
                ));
            }

            for (var participant : participants.stream()
                    .filter(value -> value != null && !value.isBlank())
                    .map(String::toLowerCase)
                    .filter(value -> !currentUserAliases.contains(value))
                    .distinct()
                    .toList()) {
                var latestDirect = latestDirectByProjectParticipant.get(new ProjectDirectKey(projectId, participant));
                if (latestDirect == null || latestDirect.getTimestamp() == null) {
                    continue;
                }
                long unreadCount = directUnreadByProjectParticipant.getOrDefault(new ProjectDirectKey(projectId, participant), 0L);
                boolean unread = unreadCount > 0;
                projectActivities.add(new ChatInboxActivity(
                        projectId,
                        project.getName(),
                        "DIRECT",
                        null,
                        null,
                        participant,
                        participant,
                        latestDirect.getContent(),
                        latestDirect.getSender(),
                        latestDirect.getTimestamp().toString(),
                        unreadCount,
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
            List<ChatRoom> projectRooms,
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

        return projectRooms.stream()
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

    private List<String> resolveUserAliases(com.planora.backend.model.User user, String fallbackName) {
        if (user == null) {
            return List.of(fallbackName != null ? fallbackName.toLowerCase() : "");
        }

        return Stream.of(user.getUsername(), user.getEmail(), fallbackName)
                .filter(value -> value != null && !value.isBlank())
                .map(String::toLowerCase)
                .distinct()
                .toList();
    }
}
