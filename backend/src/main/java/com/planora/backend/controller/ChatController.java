package com.planora.backend.controller;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.beans.factory.annotation.Qualifier;
import java.util.concurrent.Executor;

import com.planora.backend.dto.ChatMessageDTO;
import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatMessage.ChatType;
import com.planora.backend.repository.ChatMessageRepository;
import com.planora.backend.repository.ChatRoomMemberRepository;
import com.planora.backend.repository.ChatRoomRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.ChatPresenceService;
import com.planora.backend.service.ChatService;
import com.planora.backend.service.ChatWebhookService;
import com.planora.backend.service.NotificationService;
import com.planora.backend.service.ProjectMembershipService;
import com.planora.backend.service.UserCacheService;

@Controller
public class ChatController {

    private static final Pattern MENTION_PATTERN = Pattern.compile("(?<!\\S)@([A-Za-z0-9._-]+)");
    private static final String TEAM_CHAT_READ_KEY = "__TEAM_CHAT__";
    private static final long UNREAD_BADGE_DEBOUNCE_MS = 200L;

    public static record EditMessagePayload(String content, ChatMessage.FormatType formatType) {}

    public static record ReactionTogglePayload(String emoji) {}

    public static record TypingPayload(String scope, Long roomId, String recipient, Boolean isTyping) {}

    public static record TypingEvent(String sender, String scope, Long roomId, String recipient, boolean typing) {}

    public static record PresenceEvent(String type, String user, List<String> onlineUsers) {}

    public static record MentionEvent(String type,
                                      Long projectId,
                                      Long messageId,
                                      String sender,
                                      String scope,
                                      Long roomId,
                                      String preview) {}
    private record ProjectContext(Long teamId, String projectName) {}

    @Autowired
    private SimpMessagingTemplate simpMessagingTemplate;

    @Autowired
    @Qualifier("chatTaskExecutor")
    private Executor chatTaskExecutor;

    @Autowired
    private ChatService chatService;

    @Autowired
    private TeamMemberRepository teamMemberRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private UserCacheService userCacheService;

    @Autowired
    private ProjectMembershipService projectMembershipService;

    @Autowired
    private ChatRoomRepository chatRoomRepository;

    @Autowired
    private ChatRoomMemberRepository chatRoomMemberRepository;

    @Autowired
    private ChatPresenceService chatPresenceService;

    @Autowired
    private ChatWebhookService chatWebhookService;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    // ── Added for persistent chat notifications ───────────────────────────────
    // Injects NotificationService so that DMs and @mentions create bell
    // notifications visible in the TopBar, not just transient WebSocket events.
    @Autowired
    private NotificationService notificationService;
    // ─────────────────────────────────────────────────────────────────────────
    private final ScheduledExecutorService unreadBadgeScheduler = Executors.newSingleThreadScheduledExecutor();
    // Versioned debounce avoids stale badge broadcasts when many events happen in quick succession.
    private final ConcurrentHashMap<Long, Long> unreadBadgeVersionByProject = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, ScheduledFuture<?>> unreadBadgeTasks = new ConcurrentHashMap<>();

    @MessageMapping("/project/{projectId}/chat.sendMessage")
    public void sendMessage(@DestinationVariable Long projectId,
                                   @Payload ChatMessageDTO chatMessageDto,
                                   SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        ProjectContext projectContext = resolveProjectContext(projectId);
        validateProjectMembership(projectContext.teamId(), username);

        ChatMessage chatMessage = chatService.convertToEntity(chatMessageDto);
        chatMessage.setSender(resolveCanonicalChatIdentifier(username));
        chatMessage.setProjectId(projectId);
        chatMessage.setChatType(ChatType.GROUP);

        ChatMessageDTO saved = chatService.saveMessage(chatMessage);
        saved.setLocalId(chatMessageDto.getLocalId());
        
        simpMessagingTemplate.convertAndSend("/topic/project/" + projectId + "/public", saved);

        // Side effects are offloaded to keep the websocket send path responsive.
        chatTaskExecutor.execute(() -> {
            publishMentionNotifications(projectId, projectContext.teamId(), projectContext.projectName(), saved, "TEAM");
            publishTeamChatNotifications(projectId, projectContext, saved);
            chatWebhookService.dispatchMessageEvent(projectId, "MESSAGE_CREATED", "TEAM", saved);
            scheduleUnreadBadgePublish(projectId);
        });
    }
    @MessageMapping("/project/{projectId}/chat.sendPrivateMessage")
    public void sendPrivateMessage(@DestinationVariable Long projectId, @Payload ChatMessageDTO chatMessageDto, SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        ProjectContext projectContext = resolveProjectContext(projectId);
        validateProjectMembership(projectContext.teamId(), username);

        ChatMessage chatMessage = chatService.convertToEntity(chatMessageDto);
        var canonicalSender = resolveCanonicalChatIdentifier(username);
        var canonicalRecipient = resolveCanonicalChatIdentifier(chatMessage.getRecipient());
        chatMessage.setSender(canonicalSender);
        chatMessage.setRecipient(canonicalRecipient);

        // Validate recipient is also a member
        validateProjectMembership(projectContext.teamId(), chatMessage.getRecipient());
        
        chatMessage.setProjectId(projectId);
        chatMessage.setChatType(ChatType.PRIVATE);

        ChatMessageDTO saved = chatService.saveMessage(chatMessage);
        saved.setLocalId(chatMessageDto.getLocalId());
        sendPrivateMessageToConversationParticipants(projectId, Objects.requireNonNull(saved));
        
        chatTaskExecutor.execute(() -> {
            publishMentionNotifications(projectId, projectContext.teamId(), projectContext.projectName(), saved, "PRIVATE");
            chatWebhookService.dispatchMessageEvent(projectId, "MESSAGE_CREATED", "PRIVATE", saved);
            scheduleUnreadBadgePublish(projectId);
            publishPrivateMessageNotification(projectId, projectContext.projectName(), saved);
        });
    }

    @MessageMapping("/project/{projectId}/room/{roomId}/send")
    public void sendRoomMessage(@DestinationVariable Long projectId,
                                       @DestinationVariable Long roomId,
                                       @Payload ChatMessageDTO chatMessageDto,
                                       SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        ProjectContext projectContext = resolveProjectContext(projectId);
        validateProjectMembership(projectContext.teamId(), username);
        validateRoomMembership(roomId, username);

        var room = chatRoomRepository.findById(roomId).orElseThrow(() -> new RuntimeException("Chat room not found"));
        if (Boolean.TRUE.equals(room.getArchived())) {
            throw new RuntimeException("Channel is archived and read-only");
        }

        ChatMessage chatMessage = chatService.convertToEntity(chatMessageDto);
        chatMessage.setSender(resolveCanonicalChatIdentifier(username));
        chatMessage.setProjectId(projectId);
        chatMessage.setRoomId(roomId);
        chatMessage.setChatType(ChatType.GROUP);

        ChatMessageDTO saved = chatService.saveMessage(chatMessage);
        saved.setLocalId(chatMessageDto.getLocalId());
        
        simpMessagingTemplate.convertAndSend("/topic/project/" + projectId + "/room/" + roomId, saved);
        
        chatTaskExecutor.execute(() -> {
            publishMentionNotifications(projectId, projectContext.teamId(), projectContext.projectName(), saved, "ROOM");
            publishRoomChatNotifications(projectId, roomId, saved);
            chatWebhookService.dispatchMessageEvent(projectId, "MESSAGE_CREATED", "ROOM", saved);
            scheduleUnreadBadgePublish(projectId);
        });
    }

    @MessageMapping("/project/{projectId}/thread/{rootMessageId}/send")
    public void sendThreadReply(@DestinationVariable Long projectId,
                                       @DestinationVariable Long rootMessageId,
                                       @Payload ChatMessageDTO chatMessageDto,
                                       SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        ProjectContext projectContext = resolveProjectContext(projectId);
        validateProjectMembership(projectContext.teamId(), username);

        ChatMessage chatMessage = chatService.convertToEntity(chatMessageDto);
        chatMessage.setSender(resolveCanonicalChatIdentifier(username));
        chatMessage.setType(ChatMessage.MessageType.CHAT);
        if (chatMessage.getFormatType() == null) {
            chatMessage.setFormatType(ChatMessage.FormatType.PLAIN);
        }

        var saved = chatService.saveThreadReply(projectId, rootMessageId, chatMessage);
        saved.setLocalId(chatMessageDto.getLocalId());
        
        simpMessagingTemplate.convertAndSend("/topic/project/" + projectId + "/thread/" + rootMessageId, saved);
        
        chatTaskExecutor.execute(() -> {
            publishMentionNotifications(projectId, projectContext.teamId(), projectContext.projectName(), saved, "THREAD");
            publishThreadReplyNotifications(projectId, rootMessageId, saved);
            chatWebhookService.dispatchMessageEvent(projectId, "MESSAGE_CREATED", "THREAD", saved);
        });
    }

    @MessageMapping("/project/{projectId}/messages/{messageId}/edit")
    public void editMessage(@DestinationVariable Long projectId,
                            @DestinationVariable Long messageId,
                            @Payload EditMessagePayload payload,
                            SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        resolveValidatedTeamId(projectId, username);

        var updated = chatService.editMessage(
                projectId,
                messageId,
                username,
                payload.content(),
                payload.formatType());

        publishMessageEvent(projectId, updated);
    }

    @MessageMapping("/project/{projectId}/messages/{messageId}/delete")
    public void deleteMessage(@DestinationVariable Long projectId,
                              @DestinationVariable Long messageId,
                              SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        resolveValidatedTeamId(projectId, username);

        var deleted = chatService.softDeleteMessage(projectId, messageId, username);
        publishMessageEvent(projectId, deleted);
    }

    @SuppressWarnings("null")
    @MessageMapping("/project/{projectId}/messages/{messageId}/reaction.toggle")
    public void toggleReaction(@DestinationVariable Long projectId,
                               @DestinationVariable Long messageId,
                               @Payload ReactionTogglePayload payload,
                               SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        resolveValidatedTeamId(projectId, username);

        var reactions = chatService.toggleReaction(projectId, messageId, username, payload.emoji());

        simpMessagingTemplate.convertAndSend(
                "/topic/project/" + projectId + "/messages/" + messageId + "/reactions",
            Objects.requireNonNull(reactions));

        chatTaskExecutor.execute(() -> publishReactionNotification(projectId, messageId, username, payload.emoji()));
    }

    private void validateRoomMembership(Long roomId, String usernameOrEmail) {
        var user = userCacheService.resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            throw new RuntimeException("User is not found");
        }
        if (chatRoomMemberRepository.findByChatRoomIdAndUserUserId(roomId, user.getUserId()).isPresent()) {
            return;
        }

        var room = chatRoomRepository.findById(roomId).orElseThrow(() -> new RuntimeException("Chat room not found"));
        if (isRoomCreator(room, user, usernameOrEmail)) {
            var roomMember = new com.planora.backend.model.ChatRoomMember();
            roomMember.setChatRoom(room);
            roomMember.setUser(user);
            chatRoomMemberRepository.save(roomMember);
            return;
        }

        throw new RuntimeException("User is not a member of this room");
    }

    // This method handles messages sent to "/app/project/{projectId}/chat.addUser".
    // It adds the username to the WebSocket session and broadcasts the join
    // message.
    @MessageMapping("/project/{projectId}/chat.addUser")
    public void addUser(@DestinationVariable Long projectId, @Payload ChatMessageDTO chatMessageDto,
                               SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        resolveValidatedTeamId(projectId, username);
        
        ChatMessage chatMessage = chatService.convertToEntity(chatMessageDto);
        chatMessage.setSender(resolveCanonicalChatIdentifier(username));
        chatMessage.setProjectId(projectId);
        chatMessage.setChatType(ChatType.GROUP);
        // Add username in web socket session so we can retrieve it on disconnect
        var sessionAttributes = headerAccessor.getSessionAttributes();
        if (sessionAttributes != null) {
            sessionAttributes.put("username", chatMessage.getSender());
            sessionAttributes.put("projectId", projectId);
        }

        var onlineUsers = chatPresenceService.markOnline(projectId, chatMessage.getSender(), headerAccessor.getSessionId());
        simpMessagingTemplate.convertAndSend(
                "/topic/project/" + projectId + "/presence",
                new PresenceEvent("ONLINE", chatMessage.getSender(), onlineUsers));

        // Presence JOIN is ephemeral; do not persist it in chat_message.
        if (chatMessage.getType() == null) {
            chatMessage.setType(ChatMessage.MessageType.JOIN);
        }
        
        ChatMessageDTO result = chatService.convertToDTO(chatMessage);
        result.setLocalId(chatMessageDto.getLocalId());
        simpMessagingTemplate.convertAndSend("/topic/project/" + projectId + "/public", result);
    }

    @MessageMapping("/project/{projectId}/presence.ping")
    public void pingPresence(@DestinationVariable Long projectId,
                             SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        resolveValidatedTeamId(projectId, username);

        var onlineUsers = chatPresenceService.markOnline(projectId, resolveCanonicalChatIdentifier(username), headerAccessor.getSessionId());
        simpMessagingTemplate.convertAndSend(
                "/topic/project/" + projectId + "/presence",
                new PresenceEvent("PING", resolveCanonicalChatIdentifier(username), onlineUsers));
    }

    @MessageMapping("/project/{projectId}/typing")
    public void typingEvent(@DestinationVariable Long projectId,
                            @Payload TypingPayload payload,
                            SimpMessageHeaderAccessor headerAccessor) {
        String username = requireAuthenticatedUsername(headerAccessor);
        Long teamId = projectMembershipService.resolveProjectTeamId(projectId);
        validateProjectMembership(teamId, username);

        var canonicalSender = resolveCanonicalChatIdentifier(username);
        var scope = payload.scope() != null ? payload.scope().trim().toUpperCase() : "TEAM";
        var typing = payload.isTyping() != null && payload.isTyping();

        if ("ROOM".equals(scope)) {
            if (payload.roomId() == null) {
                return;
            }
            validateRoomMembership(payload.roomId(), username);
            simpMessagingTemplate.convertAndSend(
                    "/topic/project/" + projectId + "/typing/room/" + payload.roomId(),
                    new TypingEvent(canonicalSender, "ROOM", payload.roomId(), null, typing));
            return;
        }

        if ("PRIVATE".equals(scope)) {
            if (payload.recipient() == null || payload.recipient().isBlank()) {
                return;
            }
            validateProjectMembership(teamId, payload.recipient());
            var canonicalRecipient = resolveCanonicalChatIdentifier(payload.recipient());
            var event = new TypingEvent(canonicalSender, "PRIVATE", null, canonicalRecipient, typing);
            sendPrivateTypingEventToConversationParticipants(projectId, canonicalSender, canonicalRecipient, event);
            return;
        }

        simpMessagingTemplate.convertAndSend(
                "/topic/project/" + projectId + "/typing/team",
                new TypingEvent(canonicalSender, "TEAM", null, null, typing));
    }

    private void validateProjectMembership(Long teamId, String usernameOrEmail) {
        var user = userCacheService.resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            throw new RuntimeException("User is not found");
        }
        projectMembershipService.assertTeamMembership(teamId, user);
    }

    private Long resolveValidatedTeamId(Long projectId, String usernameOrEmail) {
        Long teamId = projectMembershipService.resolveProjectTeamId(projectId);
        validateProjectMembership(teamId, usernameOrEmail);
        return teamId;
    }

    private String resolveCanonicalChatIdentifier(String usernameOrEmail) {
        if (usernameOrEmail == null || usernameOrEmail.isBlank()) {
            return usernameOrEmail;
        }

        var user = userCacheService.resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            return usernameOrEmail.toLowerCase();
        }

        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername().toLowerCase();
        }

        return user.getEmail() != null ? user.getEmail().toLowerCase() : usernameOrEmail.toLowerCase();
    }

    private void publishMessageEvent(Long projectId, ChatMessageDTO message) {
        var eventType = Boolean.TRUE.equals(message.getDeleted()) ? "MESSAGE_DELETED" : "MESSAGE_UPDATED";

        // Private updates are sent to both participants via user destinations, not public topics.
        if (message.getRecipient() != null && !message.getRecipient().isBlank()) {
            sendPrivateMessageToConversationParticipants(projectId, message);
            chatTaskExecutor.execute(() -> chatWebhookService.dispatchMessageEvent(projectId, eventType, "PRIVATE", message));
            return;
        }

        // Thread updates also hit thread topic so open thread views update in place.
        var threadRootId = chatService.resolveThreadTopicRootId(projectId, message).orElse(null);
        if (threadRootId != null) {
            simpMessagingTemplate.convertAndSend(
                    "/topic/project/" + projectId + "/thread/" + threadRootId,
                    message);
        }

        if (message.getRoomId() != null) {
            simpMessagingTemplate.convertAndSend(
                    "/topic/project/" + projectId + "/room/" + message.getRoomId(),
                    message);
            chatTaskExecutor.execute(() -> chatWebhookService.dispatchMessageEvent(projectId, eventType, "ROOM", message));
            return;
        }

        simpMessagingTemplate.convertAndSend("/topic/project/" + projectId + "/public", message);
        chatTaskExecutor.execute(() -> {
            chatWebhookService.dispatchMessageEvent(projectId, eventType, "TEAM", message);
            scheduleUnreadBadgePublish(projectId);
        });
    }

    private void scheduleUnreadBadgePublish(Long projectId) {
        long version = unreadBadgeVersionByProject.merge(projectId, 1L, Long::sum);
        var prior = unreadBadgeTasks.remove(projectId);
        if (prior != null) {
            prior.cancel(false);
        }

        ScheduledFuture<?> task = unreadBadgeScheduler.schedule(() -> {
            Long latestVersion = unreadBadgeVersionByProject.get(projectId);
            if (latestVersion != null && latestVersion.equals(version)) {
                publishUnreadBadgesForProject(projectId);
                unreadBadgeTasks.remove(projectId);
            }
        }, UNREAD_BADGE_DEBOUNCE_MS, TimeUnit.MILLISECONDS);
        unreadBadgeTasks.put(projectId, task);
    }

    private void publishUnreadBadgesForProject(Long projectId) {
        var project = projectRepository.findById(projectId).orElse(null);
        if (project == null || project.getTeam() == null) {
            return;
        }

        var teamMembers = teamMemberRepository.findByTeamId(project.getTeam().getId());
        var users = teamMembers.stream()
                .map(com.planora.backend.model.TeamMember::getUser)
                .filter(Objects::nonNull)
                .filter(user -> user.getUserId() != null)
                .toList();
        if (users.isEmpty()) {
            return;
        }

        var userIds = users.stream().map(com.planora.backend.model.User::getUserId).toList();
        Map<Long, Long> teamUnreadByUserId = chatMessageRepository
                .countUnreadTeamMessagesForUsers(projectId, userIds, TEAM_CHAT_READ_KEY)
                .stream()
                .collect(java.util.stream.Collectors.toMap(
                        row -> (Long) row[0],
                        row -> ((Number) row[1]).longValue()));
        Map<Long, Long> roomUnreadByUserId = chatMessageRepository
                .countUnreadRoomMessagesForUsers(projectId, userIds)
                .stream()
                .collect(java.util.stream.Collectors.toMap(
                        row -> (Long) row[0],
                        row -> ((Number) row[1]).longValue()));
        Map<Long, Long> directUnreadByUserId = chatMessageRepository
                .countUnreadDirectMessagesForUsers(projectId, userIds)
                .stream()
                .collect(java.util.stream.Collectors.toMap(
                        row -> (Long) row[0],
                        row -> ((Number) row[1]).longValue()));

        users.forEach(user -> {
            String participant = user.getUsername();
            if (participant == null || participant.isBlank()) {
                return;
            }
            long teamUnread = teamUnreadByUserId.getOrDefault(user.getUserId(), 0L);
            long roomsUnread = roomUnreadByUserId.getOrDefault(user.getUserId(), 0L);
            long directsUnread = directUnreadByUserId.getOrDefault(user.getUserId(), 0L);
            var badge = new ChatService.UnreadBadgeSummary(
                    teamUnread,
                    roomsUnread,
                    directsUnread,
                    teamUnread + roomsUnread + directsUnread);
            sendToUserDestinations(user, "/queue/project/" + projectId + "/unread-badge", badge);
        });
    }

    private List<com.planora.backend.model.ChatRoom> getVisibleRooms(Long projectId, String username, boolean includeArchived) {
        var currentUser = userCacheService.resolveUserByEmailOrUsername(username);
        if (currentUser == null) {
            return List.of();
        }

        var memberRoomIds = chatRoomMemberRepository.findRoomIdsByUserId(currentUser.getUserId());

        return chatRoomRepository.findByProjectId(projectId).stream()
                .filter(room -> room.getCreatedBy() != null && room.getCreatedBy().equalsIgnoreCase(username)
                        || memberRoomIds.contains(room.getId()))
                .filter(room -> includeArchived || !Boolean.TRUE.equals(room.getArchived()))
                .toList();
    }

    private void sendPrivateTypingEventToConversationParticipants(Long projectId,
                                                                  String sender,
                                                                  String recipient,
                                                                  TypingEvent event) {
        var destination = "/queue/project/" + projectId + "/typing/private";
        var aliases = List.of(sender, recipient);

        aliases.stream()
                .filter(alias -> alias != null && !alias.isBlank())
                .map(userCacheService::resolveUserByEmailOrUsername)
                .filter(Objects::nonNull)
                .forEach(user -> sendToUserDestinations(user, destination, event));
    }

    private void sendPrivateMessageToConversationParticipants(Long projectId, ChatMessageDTO savedMessage) {
        var destination = "/queue/project/" + projectId + "/messages";
        var aliases = List.of(
                savedMessage.getSender(),
                savedMessage.getRecipient());

        aliases.stream()
                .filter(alias -> alias != null && !alias.isBlank())
                .map(userCacheService::resolveUserByEmailOrUsername)
                .filter(Objects::nonNull)
                .forEach(user -> sendToUserDestinations(user, destination, savedMessage));
    }

    private void publishPrivateMessageNotification(Long projectId, String projectName, ChatMessageDTO savedMessage) {
        if (savedMessage == null || savedMessage.getSender() == null || savedMessage.getRecipient() == null) {
            return;
        }

        var senderUser = userCacheService.resolveUserByEmailOrUsername(savedMessage.getSender());
        var recipientUser = userCacheService.resolveUserByEmailOrUsername(savedMessage.getRecipient());
        if (recipientUser == null || senderUser == null
                || recipientUser.getUserId() == null
                || senderUser.getUserId() == null
                || recipientUser.getUserId().equals(senderUser.getUserId())) {
            return;
        }

        String senderDisplay = senderUser.getFullName() != null && !senderUser.getFullName().isBlank()
                ? senderUser.getFullName()
                : senderUser.getUsername();
        String notifMessage = senderDisplay + " sent you a message in \"" + projectName + "\"";
        String senderAlias = resolveCanonicalChatIdentifier(savedMessage.getSender());
        String notifLink = "/project/" + projectId + "/chat?with=" + senderAlias;

        // Keep parity with group-chat path: always persist and push in realtime.
        notificationService.createNotification(recipientUser, notifMessage, notifLink);
    }

    private void publishThreadReplyNotifications(Long projectId, Long rootMessageId, ChatMessageDTO savedReply) {
        if (savedReply == null) {
            return;
        }

        var root = chatMessageRepository.findByIdAndProjectId(rootMessageId, projectId).orElse(null);
        if (root == null) {
            return;
        }

        if (root.getRoomId() != null) {
            publishRoomChatNotifications(projectId, root.getRoomId(), savedReply);
            return;
        }

        if (root.getRecipient() != null && !root.getRecipient().isBlank()) {
            publishPrivateThreadReplyNotification(projectId, root, savedReply);
            return;
        }

        publishTeamChatNotifications(projectId, resolveProjectContext(projectId), savedReply);
    }

    private void publishPrivateThreadReplyNotification(Long projectId, ChatMessage rootMessage, ChatMessageDTO savedReply) {
        var senderUser = userCacheService.resolveUserByEmailOrUsername(savedReply.getSender());
        if (senderUser == null || senderUser.getUserId() == null) {
            return;
        }

        var rootSender = userCacheService.resolveUserByEmailOrUsername(rootMessage.getSender());
        var rootRecipient = userCacheService.resolveUserByEmailOrUsername(rootMessage.getRecipient());
        com.planora.backend.model.User counterpart = null;

        if (rootSender != null && rootSender.getUserId() != null
                && senderUser.getUserId().equals(rootSender.getUserId())) {
            counterpart = rootRecipient;
        } else if (rootRecipient != null && rootRecipient.getUserId() != null
                && senderUser.getUserId().equals(rootRecipient.getUserId())) {
            counterpart = rootSender;
        }

        if (counterpart == null || counterpart.getUserId() == null
                || counterpart.getUserId().equals(senderUser.getUserId())) {
            return;
        }

        String senderDisplay = senderUser.getFullName() != null && !senderUser.getFullName().isBlank()
                ? senderUser.getFullName()
                : senderUser.getUsername();
        String project = projectRepository.findById(projectId).map(p -> p.getName()).orElse("the project");
        String notifMessage = senderDisplay + " replied in a thread in \"" + project + "\"";
        String notifLink = "/project/" + projectId + "/chat?with=" + resolveCanonicalChatIdentifier(savedReply.getSender());

        notificationService.createNotification(counterpart, notifMessage, notifLink);
    }

    private void publishReactionNotification(Long projectId, Long messageId, String actorAlias, String emoji) {
        var message = chatMessageRepository.findByIdAndProjectId(messageId, projectId).orElse(null);
        if (message == null || message.getSender() == null || message.getSender().isBlank()) {
            return;
        }

        var actorUser = userCacheService.resolveUserByEmailOrUsername(actorAlias);
        var messageSender = userCacheService.resolveUserByEmailOrUsername(message.getSender());
        if (actorUser == null || messageSender == null
                || actorUser.getUserId() == null || messageSender.getUserId() == null
                || actorUser.getUserId().equals(messageSender.getUserId())) {
            return;
        }

        String actorDisplay = actorUser.getFullName() != null && !actorUser.getFullName().isBlank()
                ? actorUser.getFullName()
                : actorUser.getUsername();
        String normalizedEmoji = emoji != null && !emoji.isBlank() ? emoji.trim() : "a reaction";
        String notifMessage = actorDisplay + " reacted " + normalizedEmoji + " to your message";
        String notifLink = buildNotificationLinkForMessage(projectId, message, resolveCanonicalChatIdentifier(actorAlias));

        notificationService.createNotification(messageSender, notifMessage, notifLink);
    }

    private String buildNotificationLinkForMessage(Long projectId, ChatMessage message, String actorAlias) {
        if (message.getRoomId() != null) {
            return "/project/" + projectId + "/chat?roomId=" + message.getRoomId();
        }

        if (message.getRecipient() != null && !message.getRecipient().isBlank()) {
            return "/project/" + projectId + "/chat?with=" + actorAlias;
        }

        return "/project/" + projectId + "/chat?view=team";
    }

    private void publishMentionNotifications(Long projectId, Long teamId, String projectName, ChatMessageDTO savedMessage, String scope) {
        if (savedMessage == null || savedMessage.getContent() == null || savedMessage.getContent().isBlank()) {
            return;
        }

        var mentions = new LinkedHashSet<String>();
        var matcher = MENTION_PATTERN.matcher(savedMessage.getContent());
        while (matcher.find()) {
            var mention = matcher.group(1);
            if (mention != null && !mention.isBlank()) {
                mentions.add(mention.toLowerCase());
            }
        }

        if (mentions.isEmpty()) {
            return;
        }

        var senderAliases = userCacheService.resolveUserByEmailOrUsername(savedMessage.getSender());
        var senderUsername = senderAliases != null && senderAliases.getUsername() != null
                ? senderAliases.getUsername().toLowerCase()
                : null;
        var senderEmail = senderAliases != null && senderAliases.getEmail() != null
                ? senderAliases.getEmail().toLowerCase()
                : null;

        var destination = "/queue/project/" + projectId + "/mentions";
        var preview = savedMessage.getContent().length() > 120
                ? savedMessage.getContent().substring(0, 120)
                : savedMessage.getContent();

        var mentionedUsers = mentions.stream()
                .map(userCacheService::resolveUserByEmailOrUsername)
                .filter(Objects::nonNull)
                .filter(user -> user.getUserId() != null)
                .toList();
        if (mentionedUsers.isEmpty()) {
            return;
        }

        java.util.Set<Long> mentionedUserIds = mentionedUsers.stream()
                .map(com.planora.backend.model.User::getUserId)
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        java.util.Set<Long> memberUserIds = teamMemberRepository.findByTeamIdAndUserUserIdIn(teamId, mentionedUserIds).stream()
                .map(tm -> tm.getUser() != null ? tm.getUser().getUserId() : null)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());

        mentionedUsers.forEach(user -> {
            var isSender = (senderUsername != null && senderUsername.equalsIgnoreCase(user.getUsername()))
                    || (senderEmail != null && senderEmail.equalsIgnoreCase(user.getEmail()));
            if (isSender || !memberUserIds.contains(user.getUserId())) {
                return;
            }

            var event = new MentionEvent(
                    "MENTIONED",
                    projectId,
                    savedMessage.getId(),
                    savedMessage.getSender(),
                    scope,
                    savedMessage.getRoomId(),
                    preview);

            // Send the real-time WebSocket mention event (existing behaviour).
            sendToUserDestinations(user, destination, event);

            // ── NOTIFICATION: also persist a bell notification for the mention ─
            // The WebSocket event is ephemeral (lost if the user is offline).
            // The persistent notification ensures they see it upon next login.
            // createNotificationIfNotDuplicate guards against duplicate rows when
            // a user is mentioned multiple times in the same message burst.
            String senderDisplay = (senderAliases != null
                    && senderAliases.getFullName() != null
                    && !senderAliases.getFullName().isBlank())
                    ? senderAliases.getFullName() : savedMessage.getSender();
            String notifMessage = senderDisplay + " mentioned you in \"" + projectName + "\" chat";
            String notifLink = "/project/" + projectId + "/chat";
            notificationService.createNotificationIfNotDuplicate(user, notifMessage, notifLink);
            // ─────────────────────────────────────────────────────────────────
        });
    }

    private void publishTeamChatNotifications(Long projectId, ProjectContext projectContext, ChatMessageDTO savedMessage) {
        if (savedMessage == null || savedMessage.getSender() == null || savedMessage.getSender().isBlank()) {
            return;
        }

        if (projectContext.teamId() == null) {
            return;
        }

        var senderUser = userCacheService.resolveUserByEmailOrUsername(savedMessage.getSender());
        var senderAlias = savedMessage.getSender();
        var senderDisplay = senderUser != null && senderUser.getFullName() != null && !senderUser.getFullName().isBlank()
                ? senderUser.getFullName()
                : senderAlias;
        var projectName = projectContext.projectName();
        var message = senderDisplay + " sent a message in \"" + projectName + "\" team chat: "
                + buildNotificationPreview(savedMessage.getContent());
        var link = "/project/" + projectId + "/chat";

        teamMemberRepository.findByTeamId(projectContext.teamId()).stream()
                .map(com.planora.backend.model.TeamMember::getUser)
                .filter(Objects::nonNull)
                .filter(recipient -> !isSender(recipient, senderUser, senderAlias))
                .forEach(recipient -> notificationService.createNotification(recipient, message, link));
    }

    private ProjectContext resolveProjectContext(Long projectId) {
        var project = projectRepository.findById(projectId).orElse(null);
        if (project == null) {
            throw new RuntimeException("Project not found");
        }
        Long teamId = project.getTeam() != null ? project.getTeam().getId() : null;
        if (teamId == null) {
            throw new RuntimeException("Project team not found");
        }
        String projectName = project.getName() != null && !project.getName().isBlank() ? project.getName() : "the project";
        return new ProjectContext(teamId, projectName);
    }

    private void publishRoomChatNotifications(Long projectId, Long roomId, ChatMessageDTO savedMessage) {
        if (savedMessage == null || savedMessage.getSender() == null || savedMessage.getSender().isBlank()) {
            return;
        }

        var room = chatRoomRepository.findById(roomId).orElse(null);
        if (room == null) {
            return;
        }

        var senderUser = userCacheService.resolveUserByEmailOrUsername(savedMessage.getSender());
        var senderAlias = savedMessage.getSender();
        var senderDisplay = senderUser != null && senderUser.getFullName() != null && !senderUser.getFullName().isBlank()
                ? senderUser.getFullName()
                : senderAlias;
        var roomName = room.getName() != null && !room.getName().isBlank() ? room.getName() : "group";
        var message = senderDisplay + " posted in #" + roomName + ": "
                + buildNotificationPreview(savedMessage.getContent());
        var link = "/project/" + projectId + "/chat";

        Set<Long> recipientIds = new LinkedHashSet<>();
        chatRoomMemberRepository.findByChatRoomId(roomId).stream()
                .map(roomMember -> roomMember.getUser())
                .filter(Objects::nonNull)
                .map(com.planora.backend.model.User::getUserId)
                .filter(Objects::nonNull)
                .forEach(recipientIds::add);

        var creatorUser = userCacheService.resolveUserByEmailOrUsername(room.getCreatedBy());
        if (creatorUser != null && creatorUser.getUserId() != null) {
            recipientIds.add(creatorUser.getUserId());
        }

        if (senderUser != null && senderUser.getUserId() != null) {
            recipientIds.remove(senderUser.getUserId());
        }

        if (recipientIds.isEmpty()) {
            return;
        }

        userRepository.findAllById(recipientIds)
                .forEach(recipient -> notificationService.createNotification(recipient, message, link));
    }

    private String buildNotificationPreview(String content) {
        if (content == null || content.isBlank()) {
            return "New message";
        }

        var normalized = content.trim().replaceAll("\\s+", " ");
        return normalized.length() > 80 ? normalized.substring(0, 80) + "..." : normalized;
    }

    private boolean isSender(com.planora.backend.model.User recipient,
                             com.planora.backend.model.User senderUser,
                             String senderAlias) {
        if (recipient == null) {
            return false;
        }

        if (senderUser != null && recipient.getUserId() != null && recipient.getUserId().equals(senderUser.getUserId())) {
            return true;
        }

        if (senderAlias == null || senderAlias.isBlank()) {
            return false;
        }

        var normalizedAlias = senderAlias.toLowerCase();
        return (recipient.getUsername() != null && recipient.getUsername().equalsIgnoreCase(normalizedAlias))
                || (recipient.getEmail() != null && recipient.getEmail().equalsIgnoreCase(normalizedAlias));
    }

    private String requireAuthenticatedUsername(SimpMessageHeaderAccessor headerAccessor) {
        var principal = headerAccessor.getUser();
        if (principal == null || principal.getName() == null) {
            throw new IllegalArgumentException("WebSocket user is not authenticated");
        }

        return principal.getName();
    }

    private void sendToUserDestinations(com.planora.backend.model.User user, String destination, Object payload) {
        if (user == null || destination == null || destination.isBlank() || payload == null) {
            return;
        }
        // Fan-out to username and email aliases keeps delivery stable during identity migrations.
        var identities = new LinkedHashSet<String>();
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            identities.add(user.getUsername().toLowerCase());
        }
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            identities.add(user.getEmail().toLowerCase());
        }
        identities.forEach(identity -> simpMessagingTemplate.convertAndSendToUser(identity, destination, payload));
    }

    private boolean isRoomCreator(com.planora.backend.model.ChatRoom room, com.planora.backend.model.User user, String usernameOrEmail) {
        if (room.getCreatedBy() == null) {
            return false;
        }
        return room.getCreatedBy().equalsIgnoreCase(usernameOrEmail)
                || (user.getEmail() != null && room.getCreatedBy().equalsIgnoreCase(user.getEmail()))
                || (user.getUsername() != null && room.getCreatedBy().equalsIgnoreCase(user.getUsername()));
    }
}
