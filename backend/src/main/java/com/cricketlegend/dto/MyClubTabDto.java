package com.cricketlegend.dto;

/** docs/specs/148: one visible pill of Club info ({@code about}, {@code contacts}, {@code links}); {@code count} is null when not known. */
public record MyClubTabDto(String id, Integer count) {
}
