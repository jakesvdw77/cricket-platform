package com.cricketlegend.service.support.schedule;

import com.cricketlegend.domain.ImportScopeMode;
import com.cricketlegend.service.support.schedule.LeagueScheduleValidator.Context;
import com.cricketlegend.service.support.schedule.LeagueScheduleValidator.DateRange;
import com.cricketlegend.service.support.schedule.LeagueScheduleValidator.Row;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Builders shared by the schedule rule tests: rows, resolved sides, existing matches and a validation context. */
final class ScheduleTestSupport {

    static final ZoneId ZONE = ZoneId.of("Africa/Johannesburg");
    static final UUID LEAGUE = UUID.randomUUID();
    static final UUID SEASON = UUID.randomUUID();
    static final DateRange SEASON_RANGE = new DateRange(LocalDate.of(2026, 9, 1), LocalDate.of(2027, 3, 31));

    private ScheduleTestSupport() {}

    static ResolvedSide ours(String name) {
        return ResolvedSide.ownTeam(UUID.randomUUID(), name, true, Set.of());
    }

    static ResolvedSide league(String name) {
        return ResolvedSide.leagueTeam(UUID.randomUUID(), name, true, Set.of());
    }

    static Row row(int number, String date, String time, String homeName, ResolvedSide home, String awayName,
            ResolvedSide away, String venue) {
        return new Row(number, "Schedule!A" + number, ScheduleDateParser.parseText(date), ScheduleTimeParser.parseText(time),
                homeName, awayName, venue, home, away, false);
    }

    static Row row(int number, String date, String time, ResolvedSide home, ResolvedSide away, String venue) {
        return row(number, date, time, home == null ? "Home" : home.name(), home, away == null ? "Away" : away.name(),
                away, venue);
    }

    static Row excluded(Row r) {
        return new Row(r.rowNumber(), r.sourceRef(), r.date(), r.time(), r.homeName(), r.awayName(), r.venue(), r.home(),
                r.away(), true);
    }

    static Context ctx(ImportScopeMode mode, ExistingMatch... existing) {
        return ctx(mode, SEASON_RANGE, null, existing);
    }

    static Context ctx(ImportScopeMode mode, DateRange season, DateRange leagueSeason, ExistingMatch... existing) {
        return new Context(mode, ZONE, LEAGUE, SEASON, "2026/27", season, leagueSeason, 14, List.of(existing),
                List.of(), Set.of(), false, null, null, null);
    }

    static Context ctxWith(ImportScopeMode mode, List<String> knownVenues, Set<Integer> updateRows, boolean updateAll,
            ExistingMatch... existing) {
        return new Context(mode, ZONE, LEAGUE, SEASON, "2026/27", SEASON_RANGE, null, 14, List.of(existing),
                knownVenues, updateRows, updateAll, null, null, null);
    }

    static java.time.Instant at(String date, String time) {
        return LocalDateTime.of(LocalDate.parse(date), LocalTime.parse(time)).atZone(ZONE).toInstant();
    }

    static ExistingMatch.Side side(ResolvedSide s) {
        return s.ours() ? new ExistingMatch.Side(s.id(), null, s.name()) : new ExistingMatch.Side(null, s.id(), s.name());
    }

    static ExistingMatch existing(UUID league, String date, String time, String venue, ResolvedSide home,
            ResolvedSide away, Set<String> dependants) {
        return new ExistingMatch(UUID.randomUUID(), league, SEASON, at(date, time), venue, side(home), side(away), true,
                dependants);
    }

    static ExistingMatch existing(String date, String time, String venue, ResolvedSide home, ResolvedSide away) {
        return existing(LEAGUE, date, time, venue, home, away, Set.of());
    }

    static ExistingMatch freeText(String date, String time, String venue, ResolvedSide home, String awayText) {
        return new ExistingMatch(UUID.randomUUID(), LEAGUE, SEASON, at(date, time), venue, side(home),
                new ExistingMatch.Side(null, null, awayText), true, Set.of());
    }
}
