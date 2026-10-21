package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * docs/specs/116-team-stats.md: the club-wide Season, League, Section and Competition values that have counted team
 * results (no team list: the table lists the teams). A section-scoped manager gets only values inside their sections.
 * {@code competitions} holds LEAGUE and/or FRIENDLY.
 */
public record TeamStatsFilterOptionsDto(
        List<UUID> seasonIds, List<UUID> leagueIds, List<UUID> sectionIds, List<String> competitions) {
}
