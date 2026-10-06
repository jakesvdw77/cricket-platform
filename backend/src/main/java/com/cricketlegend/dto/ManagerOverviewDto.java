package com.cricketlegend.dto;

import java.util.List;

/**
 * The manager overview dashboard (docs/specs/079-manager-shell-and-overview.md), scoped to the
 * caller: a club admin sees the whole club, a section manager only the sections they administer.
 * "This week" is the half-open window from the start of today to the start of today plus 7 days in
 * the server's default time zone ({@code ZoneId.systemDefault()}, the same zone convention as
 * {@code MatchSlots}); only active matches count anywhere in this response.
 *
 * @param matchesThisWeek active in-scope matches whose date is in this week
 * @param teamsNotAnnounced own-club sides in this week's matches that are not announced (a match
 *     with no side row yet counts as not announced)
 * @param pollAnswersAwaited sum over every open in-scope poll (squad and group) of the players who
 *     still owe an answer
 * @param activePlayers active players of the club within the caller's sections
 * @param upcomingMatches at most 5 in-scope matches from the start of today, soonest first
 * @param openPolls at most 5 open in-scope polls, soonest scheduled close first (no close time last)
 * @param recentResults always empty for now: results do not exist yet
 * @param quickActions which shortcuts the caller may use
 */
public record ManagerOverviewDto(
        int matchesThisWeek,
        int teamsNotAnnounced,
        long pollAnswersAwaited,
        long activePlayers,
        List<OverviewMatchDto> upcomingMatches,
        List<OverviewPollDto> openPolls,
        List<OverviewResultDto> recentResults,
        OverviewQuickActionsDto quickActions) {
}
