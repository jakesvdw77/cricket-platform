package com.cricketlegend.service.support;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Season;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchRepository.LeagueSeasonFirstMatch;
import com.cricketlegend.repository.SeasonRepository;
import java.time.LocalDate;
import java.time.Month;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * The one place the age reference date of a league in a season is computed
 * (docs/specs/110-league-age-cutoff-day-and-month.md). The league start is the date of the league's earliest active
 * match in the season, else the season's start date. With a cut-off day and month the reference date is that day in the
 * calendar year of the league start (29 February in a year without one becomes 28 February); without one it is the
 * league start itself. Eligibility, the team selection batch rules and the age-reference-date endpoint all call this
 * class, so the rule cannot drift.
 */
@Component
public class LeagueAgeReference {

    /** Whether the reference date is the league's cut-off or its start. */
    public enum Source { CUTOFF, LEAGUE_START }

    /** Where the league start came from. */
    public enum StartSource { FIRST_MATCH, SEASON_START }

    /** The league and season a reference date is asked for. */
    public record Key(UUID leagueId, UUID seasonId) {}

    /** The computed reference date with how it was reached. */
    public record Reference(LocalDate referenceDate, Source source, LocalDate leagueStart, StartSource leagueStartSource) {}

    private final MatchRepository matchRepository;
    private final SeasonRepository seasonRepository;

    public LeagueAgeReference(MatchRepository matchRepository, SeasonRepository seasonRepository) {
        this.matchRepository = matchRepository;
        this.seasonRepository = seasonRepository;
    }

    /** The reference date of one league in one season; a missing season is a 404. */
    public Reference of(League league, UUID seasonId) {
        Season season = seasonRepository
                .findById(seasonId)
                .orElseThrow(() -> new NotFoundException("Season not found: " + seasonId));
        return of(league, season);
    }

    /** As {@link #of(League, UUID)} for a season the caller has already loaded. */
    public Reference of(League league, Season season) {
        LocalDate firstMatch = matchRepository.findFirstMatchDates(Set.of(league.getId()), Set.of(season.getId())).stream()
                .filter(row -> row.getLeagueId().equals(league.getId()) && row.getSeasonId().equals(season.getId()))
                .map(row -> ServerClock.localDate(row.getFirstMatchDate()))
                .findFirst()
                .orElse(null);
        return compute(league, season, firstMatch);
    }

    /**
     * The reference date for many (league, season) pairs: one query for the seasons and one for every first match date,
     * however many pairs. A pair whose season does not exist is absent from the result.
     */
    public Map<Key, Reference> ofAll(Map<UUID, League> leagues, Collection<Key> keys) {
        Map<Key, Reference> result = new HashMap<>();
        if (keys.isEmpty()) {
            return result;
        }
        Set<UUID> leagueIds = new HashSet<>();
        Set<UUID> seasonIds = new HashSet<>();
        for (Key key : keys) {
            leagueIds.add(key.leagueId());
            seasonIds.add(key.seasonId());
        }
        Map<UUID, Season> seasons = new HashMap<>();
        seasonRepository.findAllById(seasonIds).forEach(season -> seasons.put(season.getId(), season));
        Map<Key, LocalDate> firstMatches = new HashMap<>();
        for (LeagueSeasonFirstMatch row : matchRepository.findFirstMatchDates(leagueIds, seasonIds)) {
            firstMatches.put(new Key(row.getLeagueId(), row.getSeasonId()), ServerClock.localDate(row.getFirstMatchDate()));
        }
        for (Key key : new HashSet<>(keys)) {
            League league = leagues.get(key.leagueId());
            Season season = seasons.get(key.seasonId());
            if (league != null && season != null) {
                result.put(key, compute(league, season, firstMatches.get(key)));
            }
        }
        return result;
    }

    private Reference compute(League league, Season season, LocalDate firstMatch) {
        LocalDate leagueStart = firstMatch != null ? firstMatch : season.getStartDate();
        StartSource startSource = firstMatch != null ? StartSource.FIRST_MATCH : StartSource.SEASON_START;
        if (league.getAgeCutoffMonth() == null || league.getAgeCutoffDay() == null) {
            return new Reference(leagueStart, Source.LEAGUE_START, leagueStart, startSource);
        }
        int year = leagueStart.getYear();
        Month month = Month.of(league.getAgeCutoffMonth());
        int day = Math.min(league.getAgeCutoffDay(), month.length(java.time.Year.isLeap(year)));
        return new Reference(LocalDate.of(year, month, day), Source.CUTOFF, leagueStart, startSource);
    }
}
