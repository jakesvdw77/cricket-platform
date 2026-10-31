package com.cricketlegend.service.support;

import com.cricketlegend.exception.MatchOutsideLeagueDatesException;
import com.cricketlegend.repository.LeagueSeasonRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * The one place a match date is checked against a league season's dates (docs/specs/111-league-season-dates.md). Match
 * create, update and reactivate call {@link #assertWithin}, and a future bulk or schedule-import path must call it per
 * fixture, so the rule cannot drift. A league season with no dates, or a match with no league, is not
 * checked. The comparison is on the local calendar day (see {@link ServerClock}).
 */
@Component
public class LeagueSeasonDates {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    private final LeagueSeasonRepository leagueSeasonRepository;

    public LeagueSeasonDates(LeagueSeasonRepository leagueSeasonRepository) {
        this.leagueSeasonRepository = leagueSeasonRepository;
    }

    /** Throws {@link MatchOutsideLeagueDatesException} when the league season has dates and the match date is outside. */
    public void assertWithin(UUID leagueId, UUID seasonId, Instant matchDate) {
        if (leagueId == null || seasonId == null || matchDate == null) {
            return;
        }
        leagueSeasonRepository.findByLeagueIdAndSeasonId(leagueId, seasonId).ifPresent(dates -> {
            LocalDate day = ServerClock.localDate(matchDate);
            if (day.isBefore(dates.getStartDate()) || day.isAfter(dates.getEndDate())) {
                throw new MatchOutsideLeagueDatesException(
                        "This league runs from " + format(dates.getStartDate()) + " to " + format(dates.getEndDate()) + ".");
            }
        });
    }

    /** As {@link #assertWithin} for many dates of one league season, reading the dates once (docs/specs/098). */
    public void assertAllWithin(UUID leagueId, UUID seasonId, java.util.Collection<Instant> matchDates) {
        if (leagueId == null || seasonId == null || matchDates.isEmpty()) {
            return;
        }
        leagueSeasonRepository.findByLeagueIdAndSeasonId(leagueId, seasonId).ifPresent(dates -> {
            for (Instant matchDate : matchDates) {
                if (matchDate == null) {
                    continue;
                }
                LocalDate day = ServerClock.localDate(matchDate);
                if (day.isBefore(dates.getStartDate()) || day.isAfter(dates.getEndDate())) {
                    throw new MatchOutsideLeagueDatesException("This league runs from " + format(dates.getStartDate())
                            + " to " + format(dates.getEndDate()) + ".");
                }
            }
        });
    }

    /** A day as {@code 1 Sep 2026}, the style of every date message. */
    public static String format(LocalDate day) {
        return DAY.format(day);
    }

    /** As {@link #format(LocalDate)} for an instant on the server clock. */
    public static String format(Instant instant) {
        return format(ServerClock.localDate(instant));
    }
}
