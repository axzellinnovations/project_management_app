package com.planora.backend.dto;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;

@Data
@Getter
@Setter
public class PageRequestDto {
    private String title;
    private String content;
}
