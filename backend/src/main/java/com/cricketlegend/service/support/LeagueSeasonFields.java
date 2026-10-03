package com.cricketlegend.service.support;

import com.cricketlegend.dto.LeagueSeasonTeamDto;
import java.time.Instant;
import java.util.List;

/**
 * The read-time computed "current season" values of one league on the list response, carried
 * from {@code LeagueServiceImpl.list()} into the record reconstruction (a top-level type because
 * {@code service.impl} allows only {@code *Impl} classes). See docs/specs/050 and 071.
 */
public record LeagueSeasonFields(
        int currentSeasonTeamCount,
        String currentSeasonLabel,
        String currentSeasonPlayingConditionsUrl,
        int matchCount,
        int playedCount,
        Instant firstMatchDate,
        Instant lastMatchDate,
        Instant nextMatchDate,
        List<LeagueSeasonTeamDto> teams) {

    /** No current season: zero counts, null dates and conditions URL, no teams. */
    public static LeagueSeasonFields none() {
        return new LeagueSeasonFields(0, null, null, 0, 0, null, null, null, List.of());
    }
}
