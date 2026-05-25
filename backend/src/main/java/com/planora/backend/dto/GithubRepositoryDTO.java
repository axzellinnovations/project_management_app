package com.planora.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GithubRepositoryDTO {

    private long    repoId;
    private String  name;
    private String  fullName;
    private boolean privateRepo;
    private String  defaultBranch;
    private String  ownerLogin;
    private String  description;
}
