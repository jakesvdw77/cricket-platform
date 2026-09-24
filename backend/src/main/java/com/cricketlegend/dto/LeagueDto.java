package com.cricketlegend.dto;

import com.cricketlegend.domain.LeagueSource;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Read shape of a club's own {@link com.cricketlegend.domain.League}. {@code
 * currentSeasonTeamCount}/{@code currentSeasonLabel}/{@code currentSeasonPlayingConditionsUrl}
 * (docs/specs/050-league-schedule-and-fixtures.md) are read-time computed fields with no matching
 * {@code League} column — resolved together, once per {@code LeagueServiceImpl.list()} call, not
 * per league. See docs/specs/029-league-management.md.
 */
public record LeagueDto(
        UUID id,
        UUID clubId,
        String name,
        LeagueSource source,
        int maxPlayingXiSize,
        boolean allowSubstitutions,
        Integer minAge,
        Integer maxAge,
        LocalDate ageCutoffDate,
        boolean active,
        Instant createdAt,
        Instant updatedAt,
        UUID updatedBy,
        int currentSeasonTeamCount,
        String currentSeasonLabel,
        String currentSeasonPlayingConditionsUrl) {
}
