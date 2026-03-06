package com.planora.backend.dto;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;

@Data
@Getter
@Setter
public class PageDetailResponseDto {
    private Long id;
    private String title;
    private String content;
    private String updatedAt;
}
