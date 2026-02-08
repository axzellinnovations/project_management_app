package com.planora.backend.dto;

import com.planora.backend.model.TeamMember;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class TeamDetailDTO {
    private Long id;
    private String name;
    private String ownerName;
    private LocalDateTime createdAt;

    private List<ProjectSummaryDTO> projects;

    //ACCEPTED INVITE
    private List<MemberDTO> members;

    //PENDING
    private List<PendingInviteDTO> pendingInvites;
}
