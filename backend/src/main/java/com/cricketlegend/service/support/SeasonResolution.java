package com.cricketlegend.service.support;

import com.cricketlegend.domain.Season;
import com.cricketlegend.exception.NotFoundException;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * The two season rules shared by every club-scoped summary and list (docs/specs/050-league-schedule-and-fixtures.md,
 * docs/specs/091-leagues-gold-standard.md, docs/specs/094-club-structure-and-seasons.md): which season is "current", and
 * that a requested season must be one of the club's. Extracted from {@code LeagueServiceImpl} so the Leagues and Sections
 * summaries cannot drift apart.
 */
public final class SeasonResolution {

    private SeasonResolution() {}

    /**
     * The requested season (it must be one of {@code seasons}, the club's own, else {@link NotFoundException}), else the
     * club's current season, else {@code null} when the club has no seasons.
     */
    public static UUID resolve(List<Season> seasons, UUID requestedSeasonId) {
        if (requestedSeasonId == null) {
            return currentSeasonId(seasons);
        }
        return seasons.stream()
                .filter(season -> season.getId().equals(requestedSeasonId))
                .findFirst()
                .map(Season::getId)
                .orElseThrow(() -> new NotFoundException("Season not found: " + requestedSeasonId));
    }

    /**
     * The club's own "current" {@link Season} - the season whose {@code [startDate, endDate]} range contains today, else
     * the most-recently-created season, else {@code null} when the club has zero seasons. Ported from {@code
     * ui/src/utils/defaultSeason.ts}'s {@code pickDefaultSeasonId} - keep the two definitions in lockstep; a change to
     * one rule is a change to both.
     */
    public static UUID currentSeasonId(List<Season> seasons) {
        if (seasons.isEmpty()) {
            return null;
        }
        LocalDate today = LocalDate.now();
        return seasons.stream()
                .filter(season -> !season.getStartDate().isAfter(today) && !season.getEndDate().isBefore(today))
                .findFirst()
                .map(Season::getId)
                .orElseGet(() -> seasons.stream()
                        .max(Comparator.comparing(Season::getCreatedAt))
                        .map(Season::getId)
                        .orElse(null));
    }
}
