package com.planora.backend.controller;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatRoom;
import com.planora.backend.model.ChatRoomMember;
import com.planora.backend.repository.ChatRoomMemberRepository;
import com.planora.backend.repository.ChatRoomRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.ChatService;

import lombok.RequiredArgsConstructor;

@RestController
@CrossOrigin(origins = "http://localhost:3000")
@RequestMapping("/api/projects/{projectId}/chat")
@RequiredArgsConstructor
public class ChatRestController {

    public static record ChatRoomResponse(Long id, String name, Long projectId, String createdBy, String createdAt) {}

    public static record ChatSidebarResponse(List<ChatService.RoomChatSummary> rooms, List<ChatService.DirectChatSummary> directMessages) {}

    private final ChatService chatService;

    private final ProjectRepository projectRepository;

    private final TeamMemberRepository teamMemberRepository;

    private final UserRepository userRepository;

    private final ChatRoomRepository chatRoomRepository;

    private final ChatRoomMemberRepository chatRoomMemberRepository;

    private final SimpMessagingTemplate simpMessagingTemplate;

    public static record RoomEvent(String action, Long roomId, ChatRoomResponse room) {}

    /**
     * Get group or private chat history for a project.
     */
    @GetMapping("/messages")
    public ResponseEntity<List<ChatMessage>> getMessages(
            @PathVariable Long projectId,
            @RequestParam(value = "roomId", required = false) Long roomId,
            @RequestParam(value = "recipient", required = false) String recipient,
            @RequestParam(value = "with", required = false) String withUser,
            Authentication authentication
    ) {
        String username = authentication.getName();
        validateProjectMembership(projectId, username);
        if (roomId != null) {
            validateRoomMembership(roomId, username);
            var roomMessages = chatService.getRoomMessages(projectId, roomId);
            chatService.markRoomAsRead(projectId, roomId, username);
            return new ResponseEntity<>(roomMessages, HttpStatus.OK);
        }
        if (recipient == null && withUser == null) {
            return new ResponseEntity<>(chatService.getGroupMessages(projectId), HttpStatus.OK);
        }

        // private conversation between recipient (current user usually) and withUser
        validateProjectMembership(projectId, withUser);
        var privateConversation = chatService.getPrivateConversation(projectId, recipient, withUser);
        chatService.markPrivateConversationAsRead(projectId, username, withUser);
        return new ResponseEntity<>(privateConversation, HttpStatus.OK);
    }

    /**
     * Get list of project members' usernames for chat.
     */
    @GetMapping("/members")
    public ResponseEntity<List<String>> getProjectMembers(@PathVariable Long projectId, Authentication authentication) {
        String username = authentication.getName();
        validateProjectMembership(projectId, username);
        var project = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Project not found"));
        var members = teamMemberRepository.findByTeamId(project.getTeam().getId());
        var usernames = members.stream().map(tm -> tm.getUser().getUsername()).toList();
        return new ResponseEntity<>(usernames, HttpStatus.OK);
    }

    @GetMapping("/rooms")
    public ResponseEntity<List<ChatRoomResponse>> getRooms(@PathVariable Long projectId, Authentication authentication) {
        String username = authentication.getName();
        validateProjectMembership(projectId, username);
        var visibleRooms = getVisibleRooms(projectId, username).stream()
            .map(this::toRoomResponse)
            .toList();

        return new ResponseEntity<>(visibleRooms, HttpStatus.OK);
    }

    @GetMapping("/summaries")
    public ResponseEntity<ChatSidebarResponse> getChatSummaries(@PathVariable Long projectId, Authentication authentication) {
        String username = authentication.getName();
        validateProjectMembership(projectId, username);

        var project = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Project not found"));
        var participants = teamMemberRepository.findByTeamId(project.getTeam().getId()).stream()
                .map(tm -> tm.getUser().getUsername())
                .toList();

        var visibleRooms = getVisibleRooms(projectId, username);
        var response = new ChatSidebarResponse(
                chatService.buildRoomSummaries(projectId, username, visibleRooms),
                chatService.buildDirectSummaries(projectId, username, participants));

        return new ResponseEntity<>(response, HttpStatus.OK);
    }

    public static record ChatRoomRequest(String name, List<String> members) {}

    @PostMapping("/rooms")
    @Transactional
    public ResponseEntity<ChatRoomResponse> createRoom(@PathVariable Long projectId,
                                                       @RequestBody ChatRoomRequest roomRequest,
                                                       Authentication authentication) {
        String username = authentication.getName();
        validateProjectMembership(projectId, username);

        if (roomRequest.name() == null || roomRequest.name().trim().isEmpty()) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }

        var newRoom = new ChatRoom();
        newRoom.setName(roomRequest.name().trim());
        newRoom.setProjectId(projectId);
        newRoom.setCreatedBy(username);
        var savedRoom = chatRoomRepository.save(newRoom);

        var project = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Project not found"));
        var teamMembers = teamMemberRepository.findByTeamId(project.getTeam().getId());
        var teamUsersByIdentifier = new LinkedHashMap<String, com.planora.backend.model.User>();
        teamMembers.stream()
                .map(tm -> tm.getUser())
                .forEach(user -> {
                    if (user.getEmail() != null) {
                        teamUsersByIdentifier.put(user.getEmail().toLowerCase(), user);
                    }
                    if (user.getUsername() != null) {
                        teamUsersByIdentifier.put(user.getUsername().toLowerCase(), user);
                    }
                });

        var usersToAdd = new LinkedHashSet<com.planora.backend.model.User>();

        if (roomRequest.members() != null) {
            roomRequest.members().stream()
                    .map(String::toLowerCase)
                    .distinct()
                    .filter(member -> {
                        try {
                            validateProjectMembership(projectId, member);
                            return true;
                        } catch (RuntimeException ex) {
                            return false;
                        }
                    })
                    .map(teamUsersByIdentifier::get)
                    .filter(user -> user != null)
                    .forEach(usersToAdd::add);
        }

        var creator = resolveUserByEmailOrUsername(username);
        if (creator != null) {
            usersToAdd.add(creator);
        }

        usersToAdd.forEach(user -> {
            boolean already = chatRoomMemberRepository.findByChatRoomIdAndUserUserId(savedRoom.getId(), user.getUserId()).isPresent();
            if (!already) {
                var roomMember = new ChatRoomMember();
                roomMember.setChatRoom(savedRoom);
                roomMember.setUser(user);
                chatRoomMemberRepository.save(roomMember);
            }
        });

        simpMessagingTemplate.convertAndSend(
                "/topic/project/" + projectId + "/rooms",
            new RoomEvent("CREATED", savedRoom.getId(), toRoomResponse(savedRoom)));

        return new ResponseEntity<>(toRoomResponse(savedRoom), HttpStatus.CREATED);
    }

    @DeleteMapping("/rooms/{roomId}")
    @Transactional
    public ResponseEntity<Void> deleteRoom(@PathVariable Long projectId,
                                           @PathVariable Long roomId,
                                           Authentication authentication) {
        String username = authentication.getName();
        validateProjectMembership(projectId, username);

        var roomOptional = chatRoomRepository.findByIdAndProjectId(roomId, projectId);
        if (roomOptional.isEmpty()) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }

        var room = roomOptional.get();
        chatRoomMemberRepository.deleteByChatRoomId(roomId);
        chatRoomRepository.delete(room);
        simpMessagingTemplate.convertAndSend(
            "/topic/project/" + projectId + "/rooms",
                new RoomEvent("DELETED", roomId, toRoomResponse(room)));
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    private ChatRoomResponse toRoomResponse(ChatRoom room) {
        return new ChatRoomResponse(
                room.getId(),
                room.getName(),
                room.getProjectId(),
                room.getCreatedBy(),
                room.getCreatedAt() != null ? room.getCreatedAt().toString() : null);
    }

            private List<ChatRoom> getVisibleRooms(Long projectId, String username) {
            var currentUser = resolveUserByEmailOrUsername(username);
            if (currentUser == null) {
                return List.of();
            }

            var memberRoomIds = chatRoomMemberRepository.findByUserUserId(currentUser.getUserId()).stream()
                .map(roomMember -> roomMember.getChatRoom().getId())
                .distinct()
                .toList();

            return chatRoomRepository.findByProjectId(projectId).stream()
                .filter(room -> room.getCreatedBy() != null && room.getCreatedBy().equalsIgnoreCase(username)
                    || memberRoomIds.contains(room.getId()))
                .toList();
            }

    private void validateRoomMembership(Long roomId, String usernameOrEmail) {
        var user = resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            throw new RuntimeException("User is not found");
        }
        if (chatRoomMemberRepository.findByChatRoomIdAndUserUserId(roomId, user.getUserId()).isPresent()) {
            return;
        }

        var room = chatRoomRepository.findById(roomId).orElseThrow(() -> new RuntimeException("Chat room not found"));
        if (isRoomCreator(room, user, usernameOrEmail)) {
            var roomMember = new ChatRoomMember();
            roomMember.setChatRoom(room);
            roomMember.setUser(user);
            chatRoomMemberRepository.save(roomMember);
            return;
        }

        throw new RuntimeException("User is not a member of this room");
    }

    private com.planora.backend.model.User resolveUserByEmailOrUsername(String usernameOrEmail) {
        if (usernameOrEmail == null || usernameOrEmail.isBlank()) {
            return null;
        }
        var normalized = usernameOrEmail.toLowerCase();
        var byEmail = userRepository.findByEmailIgnoreCase(normalized).orElse(null);
        if (byEmail != null) {
            return byEmail;
        }
        return userRepository.findByUsernameIgnoreCase(normalized).orElse(null);
    }

    private boolean isRoomCreator(ChatRoom room, com.planora.backend.model.User user, String usernameOrEmail) {
        if (room.getCreatedBy() == null) {
            return false;
        }
        return room.getCreatedBy().equalsIgnoreCase(usernameOrEmail)
                || (user.getEmail() != null && room.getCreatedBy().equalsIgnoreCase(user.getEmail()))
                || (user.getUsername() != null && room.getCreatedBy().equalsIgnoreCase(user.getUsername()));
    }

    private void validateProjectMembership(Long projectId, String usernameOrEmail) {
        // Try to find by email first
        var user = userRepository.findByEmail(usernameOrEmail.toLowerCase());
        
        // If not found by email, search by username through team members
        if (user == null) {
            var project = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Project not found"));
            var teamMembers = teamMemberRepository.findByTeamId(project.getTeam().getId());
            boolean isMember = teamMembers.stream().anyMatch(tm -> 
                tm.getUser().getEmail().equalsIgnoreCase(usernameOrEmail) || 
                (tm.getUser().getUsername() != null && tm.getUser().getUsername().equalsIgnoreCase(usernameOrEmail))
            );
            if (!isMember) {
                throw new RuntimeException("User is not a member of the project");
            }
            return;
        }
        
        var project = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Project not found"));
        boolean isMember = teamMemberRepository.findByTeamIdAndUserUserId(project.getTeam().getId(), user.getUserId()).isPresent();
        if (!isMember) {
            throw new RuntimeException("User is not a member of the project");
        }
    }
}
