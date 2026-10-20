package com.cricketlegend.service.support;

import com.cricketlegend.repository.PlayerStatsFactsRepository.FilterOptionView;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * docs/specs/103-player-stats.md, decision 22: collects the distinct season, league, team, section and competition values
 * of the rows the filter-options query returns, in first-seen order. Shared by the player statistics and leaderboard
 * services, which wrap the lists in their own DTO.
 */
public record StatsFilterOptionLists(
        List<UUID> seasonIds,
        List<UUID> leagueIds,
        List<UUID> teamIds,
        List<UUID> sectionIds,
        List<String> competitions) {

    public static final StatsFilterOptionLists EMPTY =
            new StatsFilterOptionLists(List.of(), List.of(), List.of(), List.of(), List.of());

    public static StatsFilterOptionLists of(List<FilterOptionView> rows) {
        Set<UUID> seasons = new LinkedHashSet<>();
        Set<UUID> leagues = new LinkedHashSet<>();
        Set<UUID> teams = new LinkedHashSet<>();
        Set<UUID> sections = new LinkedHashSet<>();
        Set<String> competitions = new LinkedHashSet<>();
        for (FilterOptionView row : rows) {
            addIfPresent(seasons, row.getSeasonId());
            addIfPresent(leagues, row.getLeagueId());
            addIfPresent(teams, row.getTeamId());
            addIfPresent(sections, row.getSectionId());
            addIfPresent(competitions, row.getCompetition());
        }
        return new StatsFilterOptionLists(
                List.copyOf(seasons),
                List.copyOf(leagues),
                List.copyOf(teams),
                List.copyOf(sections),
                List.copyOf(competitions));
    }

    private static <T> void addIfPresent(Set<T> target, T value) {
        if (value != null) {
            target.add(value);
        }
    }
}
