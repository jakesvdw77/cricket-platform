package com.cricketlegend.service.impl;

import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Team;
import com.cricketlegend.service.SectionAvailabilityMatchResolver;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import org.springframework.stereotype.Service;

/**
 * See {@link SectionAvailabilityMatchResolver} and
 * docs/specs/063-section-availability-and-flexible-squads.md. {@code ZoneId.systemDefault()} is
 * used for the {@code Instant}-to-local-date/time-of-day split, per {@code
 * MatchServiceImpl.startOfToday()}'s own documented precedent — the one existing timezone
 * precedent in this codebase, no per-club timezone concept yet. {@link #resolveWindowKey} is
 * completely unchanged by the fixture-group-selection revision — confirmed by the spec itself,
 * this method operates on a single already-resolved match+team, knowing nothing about how a
 * window's matches get chosen.
 */
@Service
public class SectionAvailabilityMatchResolverImpl implements SectionAvailabilityMatchResolver {

    @Override
    public WindowKey resolveWindowKey(Team team, Match match) {
        ZoneId zone = ZoneId.systemDefault();
        LocalDate windowDate = match.getMatchDate().atZone(zone).toLocalDate();
        return new WindowKey(team.getSectionId(), windowDate, dayPartOf(match, zone));
    }

    private DayPart dayPartOf(Match match, ZoneId zone) {
        LocalTime localTime = match.getMatchDate().atZone(zone).toLocalTime();
        return localTime.isBefore(LocalTime.NOON) ? DayPart.MORNING : DayPart.AFTERNOON;
    }
}
