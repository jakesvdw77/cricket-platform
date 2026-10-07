package com.cricketlegend.service.support;

import com.cricketlegend.domain.AvailabilityPollTypeFilter;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.SectionAvailabilityRound;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;

/**
 * The League / Section / Team / poll type / closed choices of the availability views
 * (docs/specs/083-availability-filters-and-toolbars.md), with the one matching rule shared by the
 * summary counters, the overview and the poll lists. Build it with {@link AvailabilityPollFilters}
 * (which validates the ids); a {@code null} id means "no narrowing" on that dimension.
 *
 * <ul>
 *   <li>{@code sectionIds}: the chosen section and its descendants, already intersected with the
 *       caller's accessible sections; {@code null} means no section narrowing. A squad poll matches
 *       when any own-club section of its match is in it, a group poll when its section is.
 *   <li>{@code leagueId}: a squad poll matches when its match is in the league; a group poll when
 *       any match in any of its windows is.
 *   <li>{@code teamId} (one of the club's own teams): a squad poll matches when it is the team's
 *       poll; a group poll when the team is a side of any match in its windows.
 * </ul>
 */
public record AvailabilityPollFilter(
        UUID leagueId, Set<UUID> sectionIds, UUID teamId, AvailabilityPollTypeFilter type, boolean includeClosed) {

    /** The one cap on closed polls of each kind, in the poll lists and the summary counters alike. */
    public static final int CLOSED_POLLS_LIMIT = 50;

    /** Today's behaviour: every open poll of both kinds. */
    public static final AvailabilityPollFilter OPEN_ONLY =
            new AvailabilityPollFilter(null, null, null, AvailabilityPollTypeFilter.ALL, false);

    public AvailabilityPollFilter {
        type = type == null ? AvailabilityPollTypeFilter.ALL : type;
    }

    public boolean includesSquad() {
        return type != AvailabilityPollTypeFilter.GROUP;
    }

    public boolean includesGroup() {
        return type != AvailabilityPollTypeFilter.SQUAD;
    }

    /** Whether deciding on a group poll needs the matches of its windows loaded. */
    public boolean needsGroupMatches() {
        return leagueId != null || teamId != null;
    }

    /** {@code matchSectionIds}: the match's own-club section ids. */
    public boolean matchesSquad(MatchAvailabilityPoll poll, Match match, Collection<UUID> matchSectionIds) {
        if (!includesSquad() || match == null) {
            return false;
        }
        if (leagueId != null && !leagueId.equals(match.getLeagueId())) {
            return false;
        }
        if (teamId != null && !teamId.equals(poll.getTeamId())) {
            return false;
        }
        return sectionIds == null || matchSectionIds.stream().anyMatch(sectionIds::contains);
    }

    /** {@code slotMatches}: every match in the round's windows (only read when league/team is set). */
    public boolean matchesGroup(SectionAvailabilityRound round, Collection<Match> slotMatches) {
        if (!includesGroup()) {
            return false;
        }
        if (sectionIds != null && !sectionIds.contains(round.getSectionId())) {
            return false;
        }
        if (leagueId != null && slotMatches.stream().noneMatch(match -> leagueId.equals(match.getLeagueId()))) {
            return false;
        }
        return teamId == null
                || slotMatches.stream()
                        .anyMatch(match -> teamId.equals(match.getHomeTeamId()) || teamId.equals(match.getAwayTeamId()));
    }
}
