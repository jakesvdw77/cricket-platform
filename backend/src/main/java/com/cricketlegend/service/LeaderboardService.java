package com.cricketlegend.service;

import com.cricketlegend.dto.AwardsViewDto;
import com.cricketlegend.dto.LeaderboardCatalogueDto;
import com.cricketlegend.dto.LeaderboardFilterOptionsDto;
import com.cricketlegend.dto.LeaderboardTableDto;
import com.cricketlegend.service.support.HeldLeaderboardTable;
import com.cricketlegend.service.support.HubLeaderboardReach;
import com.cricketlegend.service.support.LeaderboardPlayers;
import com.cricketlegend.service.support.StatsScope;
import java.util.List;
import java.util.Set;
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

    /**
     * docs/specs/147, the Player Hub: the same table as {@link #table} for the Player Hub scope (only results a manager
     * switched on for the Player Hub, no section reach, the caller was authorised by {@code MyPlayerAccess}), limited to the
     * players of the leagues in {@code leagueReach} (an empty set lists nobody), with the held player's own row and its
     * position in the whole ordered table. Parameter errors are {@link #table}'s; an unknown or other-club season, league
     * or team is a {@code NotFoundException}.
     */
    HeldLeaderboardTable tableForHeldPlayer(
            UUID clubId,
            UUID playerId,
            String group,
            String sort,
            String direction,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            Set<UUID> leagueReach,
            String minimum,
            Integer page,
            Integer size);

    /** docs/specs/147: the category leaders of {@link #awards} for the Player Hub scope and league reach (default minimums). */
    AwardsViewDto awardsForHeldPlayer(UUID clubId, UUID seasonId, UUID leagueId, UUID teamId, Set<UUID> leagueReach);

    /**
     * docs/specs/147: everyone in a Player Hub scope as ranker candidates, for the held player's standing, the league
     * batting rank and the team's fielding totals. {@code leagueReach} and {@code teamIds} are null for no restriction (an
     * empty set lists nobody). Reads the aggregate and the roster, and the number of results behind them only when {@code
     * countResults} (otherwise {@code resultsCounted} is 0).
     */
    LeaderboardPlayers playersForHeldPlayer(
            UUID clubId,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            StatsScope.Competition competition,
            Set<UUID> leagueReach,
            Set<UUID> teamIds,
            boolean countResults);

    /**
     * docs/specs/147: the distinct (season, league, team) combinations of the flagged, counted appearances of every player
     * in the leagues the reach names, restricted to the reach's (season, league) pairs: the leaderboard filter options.
     */
    List<PlayerStatsService.PlayerStatsCombo> comboOptionsForHeldPlayer(UUID clubId, HubLeaderboardReach reach);
}
