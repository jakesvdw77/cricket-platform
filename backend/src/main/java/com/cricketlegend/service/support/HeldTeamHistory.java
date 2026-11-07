package com.cricketlegend.service.support;

import com.cricketlegend.dto.TeamStatsDto;
import java.util.List;

/**
 * docs/specs/147: everything the Player Hub "Team stats" figures are built from, read once for a team in the Player Hub scope
 * (only published results a manager switched on): the team page ({@link TeamStatsDto}, the manager figures for the same
 * scope) with the counters it came from, the counted results (newest {@code DashboardLimits#HISTORY_CAP}, oldest first, as stored facts), the per-player
 * runs and wickets, the additive extras, card-coverage and squad counters, and the batting, venue, wicket-type and fielding facts of the Hub's amendment 3 blocks (all rows of the scope; the calculator keeps the capped results'). Pure data: no Spring, repository, entity,
 * caller or access information.
 */
public record HeldTeamHistory(
        TeamStatsDto stats,
        TeamStatsCounters counters,
        boolean truncated,
        List<TeamStatsCalculator.ResultFact> resultsOldestFirst,
        List<TeamStatsCalculator.ContributionFact> contribution,
        TeamStatsCalculator.Extent extent,
        TeamStatsCalculator.HubFacts hub) {
}
