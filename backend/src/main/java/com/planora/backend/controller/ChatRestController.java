package com.planora.backend.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.planora.backend.model.ChatMessage;
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

    private final ChatService chatService;

    private final ProjectRepository projectRepository;

    private final TeamMemberRepository teamMemberRepository;

    private final UserRepository userRepository;

    /**
     * Get group or private chat history for a project.
     */
    @GetMapping("/messages")
    public ResponseEntity<List<ChatMessage>> getMessages(
            @PathVariable Long projectId,
            @RequestParam(value = "recipient", required = false) String recipient,
            @RequestParam(value = "with", required = false) String withUser,
            Authentication authentication
    ) {
        String username = authentication.getName();
        validateProjectMembership(projectId, username);
        if (recipient == null && withUser == null) {
            return new ResponseEntity<>(chatService.getGroupMessages(projectId), HttpStatus.OK);
        }

        // private conversation between recipient (current user usually) and withUser
        validateProjectMembership(projectId, withUser);
        return new ResponseEntity<>(chatService.getPrivateConversation(projectId, recipient, withUser), HttpStatus.OK);
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
