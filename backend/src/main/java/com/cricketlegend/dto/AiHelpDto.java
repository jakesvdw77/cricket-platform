package com.cricketlegend.dto;

/** docs/specs/097-import-framework.md: the versioned "Convert with AI" prompt text for a type, served from one place. */
public record AiHelpDto(String type, int templateVersion, String prompt) {
}
