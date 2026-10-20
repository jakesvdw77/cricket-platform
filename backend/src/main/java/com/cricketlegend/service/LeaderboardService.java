package com.cricketlegend.service;

import com.cricketlegend.dto.AwardsViewDto;
import com.cricketlegend.dto.LeaderboardCatalogueDto;
import com.cricketlegend.dto.LeaderboardFilterOptionsDto;
import com.cricketlegend.dto.LeaderboardTableDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/103-player-stats.md, "Leaderboards": standings and awards computed on read from the club's published results,
 * through the same counters and {@code PlayerStatsCalculator} as the Player page. Every filter is optional (none is all
 * time). A section-scoped caller is narrowed to the teams of their accessible sections.
 *
 * <p>Filter errors on every method that takes filters: an unknown or other-club season, league, team or section is a
 * {@code NotFoundException}; a section or team outside a section-scoped caller's reach is refused with 403.
 */
public interface LeaderboardService {

    /** The catalogue: groups with their standings columns, and the boards (definitions, tie-break help, award eligibility). */
    LeaderboardCatalogueDto catalogue();

    /**
     * One page of one standings table. {@code group} is batting, bowling or fielding (anything else is a {@code
     * NotFoundException}); {@code sort} is a column code of the group, absent for the group's default (an unknown code is
     * a {@code ValidationException}). {@code direction} is {@code asc} or {@code desc} (absent: the column's natural
     * direction; anything else a {@code ValidationException}) and reverses the sort column only. {@code minimum} (text, so a bad value is a 400, not a type error) is absent for none
     * and is ignored unless the sort is a rate. A negative or non-numeric {@code minimum}, a negative {@code page} or a
     * {@code size} below 1 is a {@code ValidationException}; {@code size} above 100 is capped at 100. More than 5,000
     * players in scope is a {@code ValidationException} (the bounded server-side ranking exception to the LIMIT/OFFSET
     * rule: spec 103 "Architecture proposal" point 5, backend.md Statistics section).
     */
    LeaderboardTableDto table(
            Authentication authentication,
            UUID clubId,
            String group,
            String sort,
            String direction,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            UUID sectionId,
            String minimum,
            Integer page,
            Integer size);

    /**
     * The leaders of each of the club's award categories. An absent minimum means the filter-aware default, echoed in the
     * response; a bad one is a {@code ValidationException}.
     */
    AwardsViewDto awards(
            Authentication authentication,
            UUID clubId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            UUID sectionId,
            String minimumInnings,
            String minimumOvers);

    /** The seasons, leagues, teams, sections and competition types that have counted data in the club. */
    LeaderboardFilterOptionsDto filterOptions(Authentication authentication, UUID clubId);
}
