package com.planora.backend.dto;

import com.planora.backend.model.TeamRole;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MemberDTO {
    private Long userId;
    private String fullName;
    private String email;
    private TeamRole role;
    private LocalDateTime joinedAt;
}
