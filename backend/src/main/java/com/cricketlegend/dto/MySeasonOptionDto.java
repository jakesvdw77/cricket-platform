package com.cricketlegend.dto;

import java.util.UUID;

/** docs/specs/123: one entry of the Player Hub league season switcher. */
public record MySeasonOptionDto(UUID id, String name, boolean current) {
}
