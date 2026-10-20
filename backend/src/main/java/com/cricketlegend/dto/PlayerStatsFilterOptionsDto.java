package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * docs/specs/103-player-stats.md, decision 22: the filter values that appear in one player's counted appearances (no
 * other filter applied). {@code teamIds} are the player's own-side teams, {@code sectionIds} the sections of those
 * teams, {@code competitions} a subset of {@code LEAGUE} and {@code FRIENDLY}.
 */
public record PlayerStatsFilterOptionsDto(
        List<UUID> seasonIds,
        List<UUID> leagueIds,
        List<UUID> teamIds,
        List<UUID> sectionIds,
        List<String> competitions) {
}
