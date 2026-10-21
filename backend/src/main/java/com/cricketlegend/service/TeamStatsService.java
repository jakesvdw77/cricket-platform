package com.cricketlegend.service;

import com.cricketlegend.dto.TeamStatsFilterOptionsDto;
import com.cricketlegend.dto.TeamStatsTableDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/116-team-stats.md: team statistics computed on read from the club's published results, through {@code
 * TeamStatsCalculator} (one definition of every figure). Every filter is optional. A section-scoped caller is narrowed to
 * the teams of their accessible sections.
 *
 * <p>Filter errors: an unknown or other-club season, league or section is a {@code NotFoundException}; a section outside a
 * section-scoped caller's reach is refused with 403; a {@code competition} other than LEAGUE or FRIENDLY is a {@code
 * ValidationException}.
 */
public interface TeamStatsService {

    /**
     * One page of the teams table. {@code sort} is a column code (absent: {@code won}; unknown is a {@code
     * ValidationException}). {@code direction} is {@code asc} or {@code desc} (absent: the column's natural direction;
     * anything else a {@code ValidationException}) and reverses the sort column only. {@code minimum} (text, so a bad
     * value is a 400, not a type error) is absent for none and is ignored unless the sort is a rate. A negative or
     * non-numeric {@code minimum}, a negative {@code page}, a {@code size} below 1 or above 100 is a {@code
     * ValidationException} (never clamped); {@code size} defaults to 25. More than 1,000 teams in scope is a {@code
     * ValidationException} (the bounded server-side ranking exception, backend.md Statistics section). A scope with nothing in reach
     * is an empty table.
     */
    TeamStatsTableDto table(
            Authentication authentication,
            UUID clubId,
            String sort,
            String direction,
            UUID seasonId,
            UUID leagueId,
            UUID sectionId,
            String competition,
            String minimum,
            Integer page,
            Integer size);

    /** The club-wide season, league, section and competition values that have counted team results. */
    TeamStatsFilterOptionsDto filterOptions(Authentication authentication, UUID clubId);
}
