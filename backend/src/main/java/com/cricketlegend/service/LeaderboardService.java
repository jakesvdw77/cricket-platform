package com.cricketlegend.service;

import com.cricketlegend.dto.AwardsViewDto;
import com.cricketlegend.dto.LeaderboardCatalogueDto;
import com.cricketlegend.dto.LeaderboardFilterOptionsDto;
import com.cricketlegend.dto.LeaderboardPageDto;
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

    /** The board catalogue: groups, boards, definitions and tie-break help. */
    LeaderboardCatalogueDto catalogue();

    /**
     * One page of one board. {@code minimum} (text, so a bad value is a 400, not a type error) is absent for none and is
     * ignored on a board that has no minimum. An unknown {@code board} is a {@code NotFoundException}; a negative or
     * non-numeric {@code minimum}, a negative {@code page} or a {@code size} below 1 is a {@code ValidationException};
     * {@code size} above 100 is capped at 100. More than 5,000 players in scope is a {@code ValidationException}.
     */
    LeaderboardPageDto board(
            Authentication authentication,
            UUID clubId,
            String board,
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
