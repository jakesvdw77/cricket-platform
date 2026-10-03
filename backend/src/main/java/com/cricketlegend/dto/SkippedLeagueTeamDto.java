package com.cricketlegend.dto;

/** One league team the copy skipped, with the reason (currently only {@code DUPLICATE_NAME}). */
public record SkippedLeagueTeamDto(String name, String reason) {
}
