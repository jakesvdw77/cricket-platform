package com.cricketlegend.dto;

import java.util.List;
import java.util.UUID;

/**
 * docs/specs/103-player-stats.md, decision 22: the filter values that have counted data in the club (the leaderboard
 * filters offer only these), narrowed to their sections for a section-scoped manager. {@code teamIds} are the club's own-side
 * teams, {@code sectionIds} the sections of those teams, {@code competitions} a subset of LEAGUE and FRIENDLY.
 */
public record LeaderboardFilterOptionsDto(
        List<UUID> seasonIds,
        List<UUID> leagueIds,
        List<UUID> teamIds,
        List<UUID> sectionIds,
        List<String> competitions) {
}
