
package com.planora.backend.service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.dto.ChatMessageDTO;
import com.planora.backend.dto.ChatReactionDTO;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatReaction;
import com.planora.backend.model.ChatReadState;
import com.planora.backend.model.ChatRoomMember;
import com.planora.backend.model.ChatRoom;
import com.planora.backend.model.ChatThread;
import com.planora.backend.model.Project;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.User;
import com.planora.backend.repository.ChatMessageRepository;
import com.planora.backend.repository.ChatReactionRepository;
import com.planora.backend.repository.ChatReadStateRepository;
import com.planora.backend.repository.ChatRoomMemberRepository;
import com.planora.backend.repository.ChatRoomRepository;
import com.planora.backend.repository.ChatThreadRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {
    // Sentinel key used to store team chat read cursors in the shared read-state table.
    private static final String TEAM_CHAT_READ_KEY = "__TEAM_CHAT__";

    private final ChatMessageRepository chatMessageRepository;
    private final ChatReadStateRepository chatReadStateRepository;
    private final ChatThreadRepository chatThreadRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomMemberRepository chatRoomMemberRepository;
    private final ChatReactionRepository chatReactionRepository;
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;
    private final UserCacheService userCacheService;
    private final ChatDocumentService chatDocumentService;

    public record RoomChatSummary(Long roomId, String roomName, String lastMessage, String lastMessageSender, String lastMessageTimestamp, long unseenCount) {}

    public record DirectChatSummary(String username, String lastMessage, String lastMessageSender, String lastMessageTimestamp, long unseenCount) {}

    public record TeamChatSummary(String lastMessage, String lastMessageSender, String lastMessageTimestamp, long unseenCount) {}

    public record UnreadBadgeSummary(long teamUnread, long roomsUnread, long directsUnread, long totalUnread) {}

    public record ChatReactionSummary(String emoji, long count, boolean reactedByCurrentUser) {}

    public record CreatedRoomResult(ChatRoom room, Set<User> addedUsers) {}

    @Transactional(readOnly = true)
    public ChatRoom getChatRoomById(Long roomId) {
        return chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Chat room not found"));
    }

    @Transactional(readOnly = true)
    public ChatRoom getChatRoomByIdAndProjectId(Long roomId, Long projectId) {
        return chatRoomRepository.findByIdAndProjectId(roomId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Chat room not found"));
    }

    @Transactional(readOnly = true)
    public List<String> getProjectMemberUsernames(Long teamId, String currentUsername) {
        var currentAliases = currentUsername != null ? resolveUserAliases(currentUsername) : List.<String>of();
        return teamMemberRepository.findByTeamId(teamId).stream()
                .map(TeamMember::getUser)
                .filter(user -> user != null)
                .map(User::getUsername)
                .filter(username -> username != null && !username.isBlank())
                .filter(username -> currentAliases.isEmpty() || !currentAliases.contains(username.toLowerCase()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<String> getProjectParticipantUsernames(Long teamId) {
        return teamMemberRepository.findByTeamId(teamId).stream()
                .map(TeamMember::getUser)
                .filter(user -> user != null)
                .map(User::getUsername)
                .filter(username -> username != null && !username.isBlank())
                .toList();
    }

    @Transactional(readOnly = true)
    public String getProjectName(Long projectId) {
        return projectRepository.findById(projectId)
                .map(Project::getName)
                .filter(name -> name != null && !name.isBlank())
                .orElse("the project");
    }

    @Transactional(readOnly = true)
    public List<ChatRoom> getChatRoomsForProject(Long projectId, String username, boolean includeArchived) {
        return getChatRoomsForProject(projectId, username, includeArchived, userCacheService.resolveUserByEmailOrUsername(username));
    }

    @Transactional(readOnly = true)
    public List<ChatRoom> getChatRoomsForProject(Long projectId,
                                                 String username,
                                                 boolean includeArchived,
                                                 User currentUser) {
        if (currentUser == null) {
            return List.of();
        }

        var memberRoomIds = new LinkedHashSet<>(chatRoomMemberRepository.findRoomIdsByUserId(currentUser.getUserId()));

        return chatRoomRepository.findByProjectId(projectId).stream()
                .filter(room -> isRoomCreator(room, currentUser, username)
                        || memberRoomIds.contains(room.getId()))
                .filter(room -> includeArchived || !Boolean.TRUE.equals(room.getArchived()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ChatRoomMember> getRoomMembers(Long roomId) {
        return chatRoomMemberRepository.findByChatRoomId(roomId);
    }

    @Transactional(readOnly = true)
    public Optional<ChatRoomMember> getRoomMember(Long roomId, Long userId) {
        return chatRoomMemberRepository.findByChatRoomIdAndUserUserId(roomId, userId);
    }

    @Transactional
    public ChatRoom saveChatRoom(ChatRoom room) {
        return chatRoomRepository.save(room);
    }

    @Transactional
    public ChatRoomMember saveRoomMember(ChatRoomMember member) {
        return chatRoomMemberRepository.save(member);
    }

    @Transactional
    public void deleteRoomMembersByRoomId(Long roomId) {
        chatRoomMemberRepository.deleteByChatRoomId(roomId);
    }

    @Transactional
    public void deleteChatRoom(ChatRoom room) {
        chatRoomRepository.delete(room);
    }

    @Transactional(readOnly = true)
    public List<User> resolveRoomRecipients(ChatRoom room, Long excludedUserId) {
        if (room == null || room.getId() == null) {
            return List.of();
        }

        Set<Long> recipientIds = new LinkedHashSet<>();
        chatRoomMemberRepository.findByChatRoomId(room.getId()).stream()
                .map(ChatRoomMember::getUser)
                .filter(user -> user != null)
                .map(User::getUserId)
                .filter(userId -> userId != null)
                .forEach(recipientIds::add);

        var creator = userCacheService.resolveUserByEmailOrUsername(room.getCreatedBy());
        if (creator != null && creator.getUserId() != null) {
            recipientIds.add(creator.getUserId());
        }

        if (excludedUserId != null) {
            recipientIds.remove(excludedUserId);
        }

        if (recipientIds.isEmpty()) {
            return List.of();
        }

        return userRepository.findAllById(recipientIds);
    }

    @Transactional
    public CreatedRoomResult createRoom(Long projectId,
                                        Long teamId,
                                        String username,
                                        String roomName,
                                        List<String> memberIdentifiers) {
        var newRoom = new ChatRoom();
        newRoom.setName(roomName);
        newRoom.setProjectId(projectId);
        newRoom.setCreatedBy(username);
        newRoom.setArchived(false);

        var savedRoom = chatRoomRepository.save(newRoom);

        var teamMembers = teamMemberRepository.findByTeamId(teamId);
        var teamUsersByIdentifier = new LinkedHashMap<String, User>();
        teamMembers.stream()
                .map(TeamMember::getUser)
                .filter(user -> user != null)
                .forEach(user -> {
                    if (user.getEmail() != null) {
                        teamUsersByIdentifier.put(user.getEmail().toLowerCase(), user);
                    }
                    if (user.getUsername() != null) {
                        teamUsersByIdentifier.put(user.getUsername().toLowerCase(), user);
                    }
                });

        var usersToAdd = new LinkedHashSet<User>();
        if (memberIdentifiers != null) {
            memberIdentifiers.stream()
                    .filter(identifier -> identifier != null && !identifier.isBlank())
                    .map(String::toLowerCase)
                    .distinct()
                    .map(id -> {
                        var u = teamUsersByIdentifier.get(id);
                        return u != null ? u : userCacheService.resolveUserByEmailOrUsername(id);
                    })
                    .filter(user -> user != null)
                    .forEach(usersToAdd::add);
        }

        var creator = userCacheService.resolveUserByEmailOrUsername(username);
        if (creator != null) {
            usersToAdd.add(creator);
        }

        usersToAdd.forEach(user -> {
            boolean already = chatRoomMemberRepository.findByChatRoomIdAndUserUserId(savedRoom.getId(), user.getUserId()).isPresent();
            if (!already) {
                var roomMember = new ChatRoomMember();
                roomMember.setChatRoom(savedRoom);
                roomMember.setUser(user);
                roomMember.setRole((creator != null && creator.getUserId().equals(user.getUserId()))
                        ? ChatRoomMember.RoomRole.OWNER
                        : ChatRoomMember.RoomRole.MEMBER);
                chatRoomMemberRepository.save(roomMember);
            }
        });

        return new CreatedRoomResult(savedRoom, usersToAdd);
    }

    @Transactional
    public ChatRoom updateRoomMeta(Long projectId, Long roomId, String name, String topic, String description) {
        var room = getChatRoomByIdAndProjectId(roomId, projectId);

        if (name != null && !name.trim().isEmpty()) {
            room.setName(name.trim());
        }
        room.setTopic(topic != null ? topic.trim() : null);
        room.setDescription(description != null ? description.trim() : null);

        return chatRoomRepository.save(room);
    }

    @Transactional
    public ChatRoom pinRoomMessage(Long projectId, Long roomId, Long messageId) {
        var room = getChatRoomByIdAndProjectId(roomId, projectId);
        room.setPinnedMessageId(messageId);
        return chatRoomRepository.save(room);
    }

    @Transactional
    public void updateRoomMemberRole(Long projectId, Long roomId, Long memberUserId, ChatRoomMember.RoomRole role) {
        var room = getChatRoomByIdAndProjectId(roomId, projectId);
        var member = chatRoomMemberRepository.findByChatRoomIdAndUserUserId(room.getId(), memberUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Room member not found"));
        member.setRole(role);
        chatRoomMemberRepository.save(member);
    }

    @Transactional
    public ChatRoom deleteRoom(Long projectId, Long roomId) {
        var room = getChatRoomByIdAndProjectId(roomId, projectId);
        chatRoomMemberRepository.deleteByChatRoomId(roomId);
        chatRoomRepository.delete(room);
        return room;
    }

    @Transactional(readOnly = true)
    public void requireRoomAdminOrOwner(Long teamId, ChatRoom room, String usernameOrEmail) {
        var user = userCacheService.resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            throw new ResourceNotFoundException("User not found");
        }

        if (isRoomCreator(room, user, usernameOrEmail)) {
            return;
        }

        var member = chatRoomMemberRepository.findByChatRoomIdAndUserUserId(room.getId(), user.getUserId())
                .orElseThrow(() -> new RuntimeException("User is not a room member"));

        var role = member.getRole();
        if (role == ChatRoomMember.RoomRole.OWNER || role == ChatRoomMember.RoomRole.ADMIN) {
            return;
        }

        throw new RuntimeException("Only channel owner/admin can perform this action");
    }

    @Transactional
    public void ensureRoomMembership(Long roomId, String usernameOrEmail) {
        var user = userCacheService.resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            throw new RuntimeException("User is not found");
        }

        if (chatRoomMemberRepository.findByChatRoomIdAndUserUserId(roomId, user.getUserId()).isPresent()) {
            return;
        }

        var room = getChatRoomById(roomId);
        if (isRoomCreator(room, user, usernameOrEmail)) {
            var roomMember = new ChatRoomMember();
            roomMember.setChatRoom(room);
            roomMember.setUser(user);
            roomMember.setRole(ChatRoomMember.RoomRole.OWNER);
            chatRoomMemberRepository.save(roomMember);
            return;
        }

        throw new RuntimeException("User is not a member of this room");
    }

    private boolean isRoomCreator(ChatRoom room, User user, String usernameOrEmail) {
        if (room == null || room.getCreatedBy() == null) {
            return false;
        }

        return room.getCreatedBy().equalsIgnoreCase(usernameOrEmail)
                || (user.getEmail() != null && room.getCreatedBy().equalsIgnoreCase(user.getEmail()))
                || (user.getUsername() != null && room.getCreatedBy().equalsIgnoreCase(user.getUsername()));
    }

    /**
     * Persist a chat message.
     */
    @SuppressWarnings("null")
    public ChatMessageDTO saveMessage(ChatMessage message) {
        applyMessageDefaults(message);
        return convertToDTO(chatMessageRepository.save(message));
    }

    private void applyMessageDefaults(ChatMessage message) {
        if (message == null) {
            return;
        }
        if (message.getFormatType() == null) {
            message.setFormatType(ChatMessage.FormatType.PLAIN);
        }
        if (message.getDeleted() == null) {
            message.setDeleted(false);
        }
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

        // Create thread metadata lazily so legacy roots become threaded without migration scripts.
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

        // Preserve storage hygiene by removing uploaded documents when the message is deleted.
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

        var userAliases = resolveUserAliases(user);
        var otherAliases = resolveUserAliases(other);
        if (userAliases.isEmpty() || otherAliases.isEmpty()) {
            return List.of();
        }

        return mapToDTOList(chatMessageRepository.findConversationByAliases(
                projectId,
                userAliases,
                otherAliases));
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

        var readState = chatReadStateRepository.findFirstByProjectIdAndUserUserIdAndRoomIdOrderByIdDesc(projectId, user.getUserId(), roomId)
                .orElseGet(ChatReadState::new);

        readState.setProjectId(projectId);
        readState.setUser(user);
        readState.setRoomId(roomId);
        readState.setOtherParticipant(null);
        readState.setLastReadMessageId(latestMessage.get().getId());
        ChatReadState saved = chatReadStateRepository.save(readState);

        var allDuplicates = chatReadStateRepository.findAllByProjectIdAndUserUserIdAndRoomId(projectId, user.getUserId(), roomId);
        if (allDuplicates.size() > 1) {
            allDuplicates.stream()
                    .filter(rs -> rs.getId() != null && !rs.getId().equals(saved.getId()))
                    .forEach(chatReadStateRepository::delete);
        }
    }

    public void markPrivateConversationAsRead(Long projectId, String usernameOrEmail, String otherParticipant) {
        var user = resolveChatUser(usernameOrEmail);
        if (user == null || otherParticipant == null || otherParticipant.isBlank()) {
            return;
        }

        var otherUser = resolveChatUser(otherParticipant);
        var normalizedOtherParticipant = resolveCanonicalChatUser(otherUser, otherParticipant);
        var latestMessage = findLatestConversationMessage(
                projectId,
                user,
                usernameOrEmail,
                otherUser,
                otherParticipant);
        if (latestMessage.isEmpty()) {
            return;
        }

        var readState = chatReadStateRepository
                .findFirstByProjectIdAndUserUserIdAndOtherParticipantIgnoreCase(projectId, user.getUserId(), normalizedOtherParticipant)
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
                .findFirstByProjectIdAndUserUserIdAndOtherParticipantIgnoreCase(projectId, user.getUserId(), TEAM_CHAT_READ_KEY)
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
                .findFirstByProjectIdAndUserUserIdAndOtherParticipantIgnoreCase(projectId, currentUserEntity.getUserId(), TEAM_CHAT_READ_KEY)
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
        // Reuse existing summary builders so unread math is consistent across endpoints.
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

        // Visibility filtering is applied after textual match to enforce room/private access rules.
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

        // Keep mapping centralized so websocket and REST responses stay structurally identical.
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
        message.setDeleted(Boolean.TRUE.equals(dto.getDeleted()));
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

    private Optional<ChatMessage> findLatestConversationMessage(Long projectId,
                                                                User user,
                                                                String userFallback,
                                                                User otherUser,
                                                                String otherFallback) {
        var userAliases = resolveUserAliases(user, userFallback);
        var otherAliases = resolveUserAliases(otherUser, otherFallback);
        if (userAliases.isEmpty() || otherAliases.isEmpty()) {
            return Optional.empty();
        }

        var latestMessage = chatMessageRepository
                .findLatestConversationMessagesByAliases(projectId, userAliases, otherAliases)
                .stream()
                .findFirst();
        if (latestMessage.isPresent()) {
            return latestMessage;
        }

        var canonicalUsername = user != null ? normalizeChatAlias(user.getUsername()) : null;
        var otherCanonicalUsername = otherUser != null ? normalizeChatAlias(otherUser.getUsername()) : null;
        log.warn("event=dm_conversation_alias_lookup_empty projectId={} userResolved={} otherUserResolved={} "
                        + "userId={} otherUserId={} canonicalUsername={} otherCanonicalUsername={} "
                        + "userAliasCount={} otherAliasCount={}",
                projectId,
                user != null,
                otherUser != null,
                user != null ? user.getUserId() : null,
                otherUser != null ? otherUser.getUserId() : null,
                canonicalUsername,
                otherCanonicalUsername,
                userAliases.size(),
                otherAliases.size());

        if (user == null || otherUser == null || canonicalUsername == null || otherCanonicalUsername == null) {
            return Optional.empty();
        }

        // Temporary compatibility fallback. DM persistence should ultimately reference User IDs.
        return chatMessageRepository.findLatestConversationMessagesByAliases(
                        projectId,
                        List.of(canonicalUsername),
                        List.of(otherCanonicalUsername))
                .stream()
                .findFirst();
    }

    private List<String> resolveUserAliases(String usernameOrEmail) {
        var user = resolveChatUser(usernameOrEmail);
        return resolveUserAliases(user, usernameOrEmail);
    }

    private List<String> resolveUserAliases(User user, String fallbackName) {
        return Stream.of(
                        user != null ? user.getUsername() : null,
                        user != null ? user.getEmail() : null,
                        fallbackName)
                .map(this::normalizeChatAlias)
                .filter(value -> value != null)
                .distinct()
                .toList();
    }

    private String resolveCanonicalChatUser(String usernameOrEmail) {
        return resolveCanonicalChatUser(resolveChatUser(usernameOrEmail), usernameOrEmail);
    }

    private String resolveCanonicalChatUser(User user, String fallbackName) {
        if (user != null) {
            var username = normalizeChatAlias(user.getUsername());
            if (username != null) {
                return username;
            }

            var email = normalizeChatAlias(user.getEmail());
            if (email != null) {
                return email;
            }
        }

        return normalizeChatAlias(fallbackName);
    }

    private User resolveChatUser(String usernameOrEmail) {
        var normalizedIdentity = usernameOrEmail != null ? usernameOrEmail.trim() : null;
        if (normalizedIdentity == null || normalizedIdentity.isEmpty()) {
            return null;
        }
        return userCacheService.resolveUserByEmailOrUsername(normalizedIdentity);
    }

    private String normalizeChatAlias(String alias) {
        if (alias == null) {
            return null;
        }

        var normalized = alias.trim().toLowerCase(Locale.ROOT);
        return normalized.isEmpty() ? null : normalized;
    }

    private void ensureMessageOwnership(ChatMessage message, String actor) {
        if (message.getSender() == null) {
            throw new RuntimeException("Message sender is missing");
        }

        var actorAliases = resolveUserAliases(actor);
        if (!actorAliases.contains(normalizeChatAlias(message.getSender()))) {
            throw new RuntimeException("Only the original sender can modify this message");
        }
    }
}
