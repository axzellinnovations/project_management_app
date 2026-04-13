
package com.planora.backend.service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.dto.ChatMessageDTO;
import com.planora.backend.dto.ChatReactionDTO;
import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatReaction;
import com.planora.backend.model.ChatReadState;
import com.planora.backend.model.ChatRoom;
import com.planora.backend.model.ChatThread;
import com.planora.backend.repository.ChatMessageRepository;
import com.planora.backend.repository.ChatReactionRepository;
import com.planora.backend.repository.ChatReadStateRepository;
import com.planora.backend.repository.ChatRoomRepository;
import com.planora.backend.repository.ChatThreadRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ChatService {
    private static final String TEAM_CHAT_READ_KEY = "__TEAM_CHAT__";

    private final ChatMessageRepository chatMessageRepository;
    private final ChatReadStateRepository chatReadStateRepository;
    private final ChatThreadRepository chatThreadRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatReactionRepository chatReactionRepository;
    private final UserCacheService userCacheService;
    private final ChatDocumentService chatDocumentService;

    public record RoomChatSummary(Long roomId, String roomName, String lastMessage, String lastMessageSender, String lastMessageTimestamp, long unseenCount) {}

    public record DirectChatSummary(String username, String lastMessage, String lastMessageSender, String lastMessageTimestamp, long unseenCount) {}

    public record TeamChatSummary(String lastMessage, String lastMessageSender, String lastMessageTimestamp, long unseenCount) {}

    public record UnreadBadgeSummary(long teamUnread, long roomsUnread, long directsUnread, long totalUnread) {}

    public record ChatReactionSummary(String emoji, long count, boolean reactedByCurrentUser) {}

    /**
     * Persist a chat message.
     */
    @SuppressWarnings("null")
    public ChatMessageDTO saveMessage(ChatMessage message) {
        if (message.getFormatType() == null) {
            message.setFormatType(ChatMessage.FormatType.PLAIN);
        }
        return convertToDTO(chatMessageRepository.save(message));
    }

    @Transactional(readOnly = true)
    public List<ChatMessageDTO> getThreadMessages(Long projectId, Long rootMessageId) {
        var root = chatMessageRepository.findWithReactionsByIdAndProjectId(rootMessageId, projectId)
                .orElseThrow(() -> new RuntimeException("Thread root message not found"));

        var replies = chatMessageRepository.findByProjectIdAndParentMessageIdOrderByIdAsc(projectId, rootMessageId);
        return mapToDTOList(Stream.concat(Stream.of(root), replies.stream()).toList());
    }

    @Transactional(readOnly = true)
    public Optional<Long> resolveThreadTopicRootId(Long projectId, ChatMessageDTO message) {
        if (message == null || message.getId() == null) {
            return Optional.empty();
        }

        if (message.getParentMessageId() != null) {
            return Optional.of(message.getParentMessageId());
        }

        return chatThreadRepository.findByProjectIdAndRootMessageId(projectId, message.getId())
                .map(thread -> thread.getRootMessageId());
    }

    @Transactional(readOnly = true)
    public Optional<Long> resolveThreadTopicRootId(Long projectId, ChatMessage message) {
        if (message == null || message.getId() == null) {
            return Optional.empty();
        }

        if (message.getParentMessageId() != null) {
            return Optional.of(message.getParentMessageId());
        }

        return chatThreadRepository.findByProjectIdAndRootMessageId(projectId, message.getId())
                .map(thread -> thread.getRootMessageId());
    }

    public ChatMessageDTO saveThreadReply(Long projectId, Long rootMessageId, ChatMessage replyMessage) {
        var root = chatMessageRepository.findByIdAndProjectId(rootMessageId, projectId)
                .orElseThrow(() -> new RuntimeException("Thread root message not found"));

        if (root.getRoomId() != null) {
            @SuppressWarnings("null")
            var room = chatRoomRepository.findById(root.getRoomId())
                    .orElseThrow(() -> new RuntimeException("Chat room not found"));
            if (Boolean.TRUE.equals(room.getArchived())) {
                throw new RuntimeException("Channel is archived and read-only");
            }
        }

        if (replyMessage.getFormatType() == null) {
            replyMessage.setFormatType(ChatMessage.FormatType.PLAIN);
        }

        replyMessage.setParentMessageId(rootMessageId);
        replyMessage.setProjectId(projectId);
        replyMessage.setRoomId(root.getRoomId());
        replyMessage.setChatType(root.getChatType());
        replyMessage.setRecipient(root.getRecipient());

        var saved = chatMessageRepository.save(replyMessage);

        chatThreadRepository.findByProjectIdAndRootMessageId(projectId, rootMessageId)
                .orElseGet(() -> {
                    var thread = new ChatThread();
                    thread.setProjectId(projectId);
                    thread.setRootMessageId(rootMessageId);
                    thread.setRoomId(root.getRoomId());
                    thread.setCreatedBy(saved.getSender());
                    return chatThreadRepository.save(thread);
                });

        return convertToDTO(saved);
    }

    public ChatMessageDTO editMessage(Long projectId, Long messageId, String actor, String content, ChatMessage.FormatType formatType) {
        if (content == null || content.trim().isEmpty()) {
            throw new RuntimeException("Message content is required");
        }

        var message = chatMessageRepository.findByIdAndProjectId(messageId, projectId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        ensureMessageOwnership(message, actor);
        if (Boolean.TRUE.equals(message.getDeleted())) {
            throw new RuntimeException("Cannot edit a deleted message");
        }

        message.setContent(content.trim());
        message.setFormatType(formatType != null ? formatType : ChatMessage.FormatType.PLAIN);
        message.setEditedAt(LocalDateTime.now());
        return convertToDTO(chatMessageRepository.save(message));
    }

    public ChatMessageDTO softDeleteMessage(Long projectId, Long messageId, String actor) {
        var message = chatMessageRepository.findByIdAndProjectId(messageId, projectId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        ensureMessageOwnership(message, actor);

        if (message.getContent() != null && message.getContent().startsWith("http")) {
            chatDocumentService.deleteChatDocument(message.getContent());
        }

        message.setDeleted(true);
        message.setDeletedAt(LocalDateTime.now());
        message.setContent("[message deleted]");
        return convertToDTO(chatMessageRepository.save(message));
    }

    @Transactional(readOnly = true)
    public List<ChatReactionSummary> getMessageReactions(Long projectId, Long messageId, String currentUser) {
        var message = chatMessageRepository.findWithReactionsByIdAndProjectId(messageId, projectId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        var currentAliases = resolveUserAliases(currentUser);
        Map<String, Long> counts = new LinkedHashMap<>();
        Map<String, Boolean> reactedByCurrentUser = new LinkedHashMap<>();

        var reactions = message.getReactions() != null ? message.getReactions() : List.<ChatReaction>of();
        reactions.stream()
                .sorted(Comparator.comparing(ChatReaction::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .forEach(reaction -> {
            var emoji = reaction.getEmoji();
            if (emoji == null || emoji.isBlank()) {
                return;
            }

            counts.put(emoji, counts.getOrDefault(emoji, 0L) + 1L);

            var reactionUser = reaction.getUser();
            if (reactionUser != null) {
                var reactionAliases = Stream.of(reactionUser.getUsername(), reactionUser.getEmail())
                        .filter(value -> value != null && !value.isBlank())
                        .map(String::toLowerCase)
                        .toList();

                if (!reactionAliases.isEmpty() && reactionAliases.stream().anyMatch(currentAliases::contains)) {
                    reactedByCurrentUser.put(emoji, true);
                }
            }
        });

        return counts.entrySet().stream()
                .map(entry -> new ChatReactionSummary(entry.getKey(), entry.getValue(), reactedByCurrentUser.getOrDefault(entry.getKey(), false)))
                .toList();
    }

    @SuppressWarnings("null")
    @Transactional
    public List<ChatReactionSummary> toggleReaction(Long projectId, Long messageId, String actor, String emoji) {
        if (emoji == null || emoji.isBlank()) {
            throw new RuntimeException("Emoji is required");
        }

        var message = chatMessageRepository.findByIdAndProjectId(messageId, projectId)
                .orElseThrow(() -> new RuntimeException("Message not found"));
        var actorUser = userCacheService.resolveUserByEmailOrUsername(actor);
        if (actorUser == null) {
            throw new RuntimeException("User not found");
        }

        var normalizedEmoji = emoji.trim();
        var existing = chatReactionRepository.findByMessageIdAndUserUserIdAndEmoji(messageId, actorUser.getUserId(), normalizedEmoji);

        if (existing.isPresent()) {
            chatReactionRepository.delete(existing.get());
        } else {
            var reaction = new ChatReaction();
            reaction.setMessage(message);
            reaction.setUser(actorUser);
            reaction.setEmoji(normalizedEmoji);
            chatReactionRepository.save(reaction);
        }

        return getMessageReactions(projectId, messageId, actor);
    }

    /**
     * Retrieve all group messages for a project (no recipient, no room).
     */
    @Transactional(readOnly = true)
    public List<ChatMessageDTO> getGroupMessages(Long projectId) {
        return mapToDTOList(chatMessageRepository.findByProjectIdAndRecipientIsNullAndRoomIdIsNullAndParentMessageIdIsNullOrderByIdAsc(projectId));
    }

    /**
     * Retrieve room messages for a given room.
     */
    @Transactional(readOnly = true)
    public List<ChatMessageDTO> getRoomMessages(Long projectId, Long roomId) {
        return mapToDTOList(chatMessageRepository.findByProjectIdAndRoomIdAndParentMessageIdIsNullOrderByIdAsc(projectId, roomId));
    }

    /**
     * Retrieve the private conversation between two users in a project.
     */
    @Transactional(readOnly = true)
    public List<ChatMessageDTO> getPrivateConversation(Long projectId, String user, String other) {
        if (user == null || other == null) {
            return List.of();
        }

        return mapToDTOList(chatMessageRepository.findConversationByAliases(
                projectId,
                resolveUserAliases(user),
                resolveUserAliases(other)));
    }

    public void markRoomAsRead(Long projectId, Long roomId, String usernameOrEmail) {
        var user = userCacheService.resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            return;
        }

        var latestMessage = chatMessageRepository.findTopByProjectIdAndRoomIdAndParentMessageIdIsNullOrderByIdDesc(projectId, roomId);
        if (latestMessage.isEmpty()) {
            return;
        }

        var readState = chatReadStateRepository.findByProjectIdAndUserUserIdAndRoomId(projectId, user.getUserId(), roomId)
                .orElseGet(ChatReadState::new);

        readState.setProjectId(projectId);
        readState.setUser(user);
        readState.setRoomId(roomId);
        readState.setOtherParticipant(null);
        readState.setLastReadMessageId(latestMessage.get().getId());
        chatReadStateRepository.save(readState);
    }

    public void markPrivateConversationAsRead(Long projectId, String usernameOrEmail, String otherParticipant) {
        var user = userCacheService.resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null || otherParticipant == null || otherParticipant.isBlank()) {
            return;
        }

        var normalizedOtherParticipant = resolveCanonicalChatUser(otherParticipant);
        var latestMessage = findLatestConversationMessage(projectId, resolveUserAliases(usernameOrEmail), resolveUserAliases(otherParticipant));
        if (latestMessage.isEmpty()) {
            return;
        }

        var readState = chatReadStateRepository
                .findByProjectIdAndUserUserIdAndOtherParticipantIgnoreCase(projectId, user.getUserId(), normalizedOtherParticipant)
                .orElseGet(ChatReadState::new);

        readState.setProjectId(projectId);
        readState.setUser(user);
        readState.setRoomId(null);
        readState.setOtherParticipant(normalizedOtherParticipant);
        readState.setLastReadMessageId(latestMessage.get().getId());
        chatReadStateRepository.save(readState);
    }

    public void markTeamAsRead(Long projectId, String usernameOrEmail) {
        var user = userCacheService.resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            return;
        }

        var latestMessage = chatMessageRepository.findTopByProjectIdAndRecipientIsNullAndRoomIdIsNullAndParentMessageIdIsNullOrderByIdDesc(projectId);
        if (latestMessage.isEmpty()) {
            return;
        }

        var readState = chatReadStateRepository
                .findByProjectIdAndUserUserIdAndOtherParticipantIgnoreCase(projectId, user.getUserId(), TEAM_CHAT_READ_KEY)
                .orElseGet(ChatReadState::new);

        readState.setProjectId(projectId);
        readState.setUser(user);
        readState.setRoomId(null);
        readState.setOtherParticipant(TEAM_CHAT_READ_KEY);
        readState.setLastReadMessageId(latestMessage.get().getId());
        chatReadStateRepository.save(readState);
    }

    @Transactional(readOnly = true)
    public TeamChatSummary buildTeamSummary(Long projectId, String currentUser) {
        var user = userCacheService.resolveUserByEmailOrUsername(currentUser);
        return buildTeamSummary(projectId, user, currentUser);
    }

    @Transactional(readOnly = true)
    public TeamChatSummary buildTeamSummary(Long projectId, com.planora.backend.model.User currentUserEntity, String currentUserAlias) {
        if (currentUserEntity == null) {
            return new TeamChatSummary(null, null, null, 0);
        }

        var latestMessage = chatMessageRepository.findTopByProjectIdAndRecipientIsNullAndRoomIdIsNullAndParentMessageIdIsNullOrderByIdDesc(projectId).orElse(null);
        var readState = chatReadStateRepository
                .findByProjectIdAndUserUserIdAndOtherParticipantIgnoreCase(projectId, currentUserEntity.getUserId(), TEAM_CHAT_READ_KEY)
                .orElse(null);
        var unseenCount = chatMessageRepository.countUnreadTeamMessagesByAliases(
                projectId,
                resolveUserAliases(currentUserEntity, currentUserAlias),
                readState != null ? readState.getLastReadMessageId() : null);

        return new TeamChatSummary(
                latestMessage != null ? latestMessage.getContent() : null,
                latestMessage != null ? latestMessage.getSender() : null,
                latestMessage != null && latestMessage.getTimestamp() != null ? latestMessage.getTimestamp().toString() : null,
                unseenCount);
    }

    @Transactional(readOnly = true)
    public TeamChatSummary buildTeamSummary(Long projectId,
                                            com.planora.backend.model.User currentUserEntity,
                                            String currentUserAlias,
                                            ChatMessage latestTeamMessage,
                                            Long lastReadMessageId) {
        if (currentUserEntity == null) {
            return new TeamChatSummary(null, null, null, 0);
        }

        var unseenCount = chatMessageRepository.countUnreadTeamMessagesByAliases(
                projectId,
                resolveUserAliases(currentUserEntity, currentUserAlias),
                lastReadMessageId);

        return new TeamChatSummary(
                latestTeamMessage != null ? latestTeamMessage.getContent() : null,
                latestTeamMessage != null ? latestTeamMessage.getSender() : null,
                latestTeamMessage != null && latestTeamMessage.getTimestamp() != null ? latestTeamMessage.getTimestamp().toString() : null,
                unseenCount);
    }

    public TeamChatSummary buildTeamSummary(ChatMessage latestTeamMessage, long unseenCount) {
        return new TeamChatSummary(
                latestTeamMessage != null ? latestTeamMessage.getContent() : null,
                latestTeamMessage != null ? latestTeamMessage.getSender() : null,
                latestTeamMessage != null && latestTeamMessage.getTimestamp() != null ? latestTeamMessage.getTimestamp().toString() : null,
                unseenCount);
    }

    @Transactional(readOnly = true)
    public UnreadBadgeSummary buildUnreadBadge(Long projectId, String currentUser, List<ChatRoom> rooms, List<String> participants) {
        var user = userCacheService.resolveUserByEmailOrUsername(currentUser);
        return buildUnreadBadge(projectId, user, currentUser, rooms, participants);
    }

    @Transactional(readOnly = true)
    public UnreadBadgeSummary buildUnreadBadge(Long projectId, com.planora.backend.model.User currentUserEntity, String currentUserAlias, List<ChatRoom> rooms, List<String> participants) {
        var teamSummary = buildTeamSummary(projectId, currentUserEntity, currentUserAlias);
        var roomSummaries = buildRoomSummaries(projectId, currentUserEntity, currentUserAlias, rooms);
        var directSummaries = buildDirectSummaries(projectId, currentUserEntity, currentUserAlias, participants);

        long teamUnread = teamSummary.unseenCount();
        long roomUnread = roomSummaries.stream().mapToLong(RoomChatSummary::unseenCount).sum();
        long directUnread = directSummaries.stream().mapToLong(DirectChatSummary::unseenCount).sum();

        return new UnreadBadgeSummary(
                teamUnread,
                roomUnread,
                directUnread,
                teamUnread + roomUnread + directUnread);
    }

    @Transactional(readOnly = true)
    public List<ChatMessageDTO> searchMessages(Long projectId,
                                            String currentUser,
                                            String query,
                                            Set<Long> visibleRoomIds,
                                            int limit) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        var normalized = query.trim().toLowerCase();
        var currentAliases = resolveUserAliases(currentUser);

        return mapToDTOList(chatMessageRepository.searchMessages(projectId, normalized).stream()
                .filter(message -> isMessageVisibleToUser(message, currentAliases, visibleRoomIds))
                .limit(Math.max(1, limit))
                .toList());
    }

    private boolean isMessageVisibleToUser(ChatMessage message, List<String> currentAliases, Set<Long> visibleRoomIds) {
        if (message.getRoomId() != null) {
            return visibleRoomIds.contains(message.getRoomId());
        }

        if (message.getRecipient() != null && !message.getRecipient().isBlank()) {
            var sender = message.getSender() != null ? message.getSender().toLowerCase() : "";
            var recipient = message.getRecipient().toLowerCase();
            return currentAliases.contains(sender) || currentAliases.contains(recipient);
        }

        return true;
    }

    @Transactional(readOnly = true)
    public List<RoomChatSummary> buildRoomSummaries(Long projectId, String currentUser, List<ChatRoom> rooms) {
        var user = userCacheService.resolveUserByEmailOrUsername(currentUser);
        return buildRoomSummaries(projectId, user, currentUser, rooms);
    }

    @Transactional(readOnly = true)
    public List<RoomChatSummary> buildRoomSummaries(Long projectId, com.planora.backend.model.User currentUserEntity, String currentUserAlias, List<ChatRoom> rooms) {
        if (currentUserEntity == null) {
            return List.of();
        }

        var currentUserAliases = resolveUserAliases(currentUserEntity, currentUserAlias);
        var roomIds = rooms.stream().map(ChatRoom::getId).toList();
        if (roomIds.isEmpty()) {
            return List.of();
        }

        // 1. Batch Fetch Latest Messages (Filter by room IDs to avoid full project scan)
        var latestMessagesByRoom = chatMessageRepository.findLatestMessagesForSpecificRooms(projectId, roomIds).stream()
                .filter(m -> m.getRoomId() != null)
                .collect(java.util.stream.Collectors.toMap(ChatMessage::getRoomId, m -> m, (m1, m2) -> m1));

        // 2. Batch Fetch Read States
        // var readStatesByRoom = chatReadStateRepository.findByProjectIdAndUserUserId(projectId, currentUserEntity.getUserId()).stream()
        //         .filter(rs -> rs.getRoomId() != null)
        //         .collect(java.util.stream.Collectors.toMap(ChatReadState::getRoomId, rs -> rs, (rs1, rs2) -> rs1));

        // 3. Batch Fetch Unread Counts (Simplified: only for rooms with different IDs than read states)
        // Actually, for performance, we can just fetch ALL rooms in groups.
        var unreadCountsByRoom = chatMessageRepository.countUnreadBatchRooms(projectId, roomIds, currentUserAliases, currentUserEntity.getUserId()).stream()
                .collect(java.util.stream.Collectors.toMap(
                        row -> (Long) row[0],
                        row -> (Long) row[1]
                ));

        return rooms.stream()
                .map(room -> {
                    var latestMessage = latestMessagesByRoom.get(room.getId());
                    var unreadCount = unreadCountsByRoom.getOrDefault(room.getId(), 0L);

                    return new RoomChatSummary(
                            room.getId(),
                            room.getName(),
                            latestMessage != null ? latestMessage.getContent() : null,
                            latestMessage != null ? latestMessage.getSender() : null,
                            latestMessage != null && latestMessage.getTimestamp() != null ? latestMessage.getTimestamp().toString() : null,
                            unreadCount);
                })
                .sorted(Comparator.comparing((RoomChatSummary summary) -> summary.lastMessageTimestamp() == null ? "" : summary.lastMessageTimestamp()).reversed())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DirectChatSummary> buildDirectSummaries(Long projectId, String currentUser, List<String> participants) {
        var user = userCacheService.resolveUserByEmailOrUsername(currentUser);
        return buildDirectSummaries(projectId, user, currentUser, participants);
    }

    @Transactional(readOnly = true)
    public List<DirectChatSummary> buildDirectSummaries(Long projectId, com.planora.backend.model.User currentUserEntity, String currentUserAlias, List<String> participants) {
        if (currentUserEntity == null) {
            return List.of();
        }

        var currentUserAliases = resolveUserAliases(currentUserEntity, currentUserAlias);
        if (participants == null || participants.isEmpty()) {
            return List.of();
        }

        // 1. Batch Fetch Latest Messages (Filter by user aliases for performance)
        var latestMessagesByOther = chatMessageRepository.findLatestMessagesForSpecificDirects(projectId, currentUserAliases).stream()
                .collect(java.util.stream.Collectors.toMap(
                    m -> {
                        var sender = m.getSender() != null ? m.getSender().toLowerCase() : "";
                        var recipient = m.getRecipient() != null ? m.getRecipient().toLowerCase() : "";
                        return currentUserAliases.contains(sender) ? recipient : sender;
                    },
                    m -> m,
                    (m1, m2) -> m1 // Keep first match
                ));

        // 2. Batch Fetch Unread Counts
        var unreadCountsByOther = chatMessageRepository.countUnreadBatchDirects(projectId, currentUserAliases, currentUserEntity.getUserId()).stream()
                .collect(java.util.stream.Collectors.toMap(
                        row -> (String) row[0],
                        row -> (Long) row[1]
                ));

        return participants.stream()
                .filter(participant -> participant != null && !participant.isBlank())
                .map(String::toLowerCase)
                .filter(participant -> !currentUserAliases.contains(participant.toLowerCase()))
                .distinct()
                .map(participant -> {
                    var latestMessage = latestMessagesByOther.get(participant);
                    var unreadCount = unreadCountsByOther.getOrDefault(participant, 0L);

                    return new DirectChatSummary(
                            participant,
                            latestMessage != null ? latestMessage.getContent() : null,
                            latestMessage != null ? latestMessage.getSender() : null,
                            latestMessage != null && latestMessage.getTimestamp() != null ? latestMessage.getTimestamp().toString() : null,
                            unreadCount);
                })
                .sorted(Comparator.comparing((DirectChatSummary summary) -> summary.lastMessageTimestamp() == null ? "" : summary.lastMessageTimestamp()).reversed())
                .toList();
    }

    public ChatMessageDTO convertToDTO(ChatMessage message) {
        if (message == null) return null;

        List<ChatReactionDTO> reactionDTOs = message.getReactions() != null 
                ? message.getReactions().stream()
                        .map(this::convertToReactionDTO)
                        .toList()
                : List.of();

        return new ChatMessageDTO(
                message.getId(),
                null, // localId is only used for new messages
                message.getType(),
                message.getContent(),
                message.getSender(),
                message.getRecipient(),
                message.getProjectId(),
                message.getRoomId(),
                message.getChatType(),
                message.getParentMessageId(),
                message.getFormatType(),
                message.getDeleted(),
                message.getDeletedAt(),
                message.getEditedAt(),
                message.getTimestamp(),
                reactionDTOs
        );
    }

    public ChatMessage convertToEntity(ChatMessageDTO dto) {
        if (dto == null) return null;
        ChatMessage message = new ChatMessage();
        message.setId(dto.getId());
        message.setType(dto.getType());
        message.setContent(dto.getContent());
        message.setSender(dto.getSender());
        message.setRecipient(dto.getRecipient());
        message.setProjectId(dto.getProjectId());
        message.setRoomId(dto.getRoomId());
        message.setChatType(dto.getChatType());
        message.setParentMessageId(dto.getParentMessageId());
        message.setFormatType(dto.getFormatType());
        message.setDeleted(dto.getDeleted());
        message.setDeletedAt(dto.getDeletedAt());
        message.setEditedAt(dto.getEditedAt());
        // timestamp is managed by JPA (@CreationTimestamp)
        return message;
    }

    private ChatReactionDTO convertToReactionDTO(ChatReaction reaction) {
        if (reaction == null) return null;
        return new ChatReactionDTO(
                reaction.getId(),
                reaction.getUser() != null ? reaction.getUser().getUserId() : null,
                reaction.getUser() != null ? reaction.getUser().getUsername() : null,
                reaction.getEmoji(),
                reaction.getCreatedAt()
        );
    }

    private List<ChatMessageDTO> mapToDTOList(List<ChatMessage> messages) {
        return messages.stream()
                .map(this::convertToDTO)
                .toList();
    }

    private Optional<ChatMessage> findLatestConversationMessage(Long projectId, List<String> userAliases, List<String> otherAliases) {
        return chatMessageRepository.findLatestConversationMessagesByAliases(projectId, userAliases, otherAliases)
                .stream()
                .findFirst();
    }

    // TODO: Refactor sender/recipient resolution to use User ID instead of string aliases.
    // Current string-alias lookup can cause messages to disappear on mismatch.
    private List<String> resolveUserAliases(String usernameOrEmail) {
        var user = userCacheService.resolveUserByEmailOrUsername(usernameOrEmail);
        return resolveUserAliases(user, usernameOrEmail);
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

    private String resolveCanonicalChatUser(String usernameOrEmail) {
        var user = userCacheService.resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            return usernameOrEmail.toLowerCase();
        }

        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername().toLowerCase();
        }

        return user.getEmail().toLowerCase();
    }

    private void ensureMessageOwnership(ChatMessage message, String actor) {
        if (message.getSender() == null) {
            throw new RuntimeException("Message sender is missing");
        }

        var actorAliases = resolveUserAliases(actor);
        if (!actorAliases.contains(message.getSender().toLowerCase())) {
            throw new RuntimeException("Only the original sender can modify this message");
        }
    }
}
