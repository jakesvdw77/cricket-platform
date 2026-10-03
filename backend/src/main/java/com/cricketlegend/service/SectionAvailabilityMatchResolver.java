package com.cricketlegend.service;

import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Team;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Shared (section, date, day-part)-bracket resolution, needed by Part A's fixture-group resolver
 * (to flag a candidate match as already covered by an existing window) and Part B/C's {@code
 * MatchSquadServiceImpl} ({@link #resolveWindowKey}, to resolve which window a match+team's own
 * bracket maps to) — extracted rather than duplicated, per docs/standards/backend.md's "shared
 * logic lives in one place" rule. Not named in the spec's own prose (which only names a dedicated
 * resolver for the *audience*), added here as a genuinely new shared component.
 *
 * <p>Per this spec's fixture-group-selection revision: {@code resolveCoveredMatches} (a window's
 * covered matches, resolved live via a time-based scan) is gone — a window's matches are now an
 * explicit, stored selection ({@code SectionAvailabilityWindowMatch}), never re-scanned, and
 * {@link #resolveWindowKey}'s own untouched business logic is all this resolver still does. See
 * docs/specs/063-section-availability-and-flexible-squads.md.
 */
public interface SectionAvailabilityMatchResolver {

    /** The {@code (sectionId, windowDate, dayPart)} triple a given {@code team}+{@code match} resolves to. */
    WindowKey resolveWindowKey(Team team, Match match);

    /**
     * The one day-part rule: local time ({@code ZoneId.systemDefault()}) before noon is {@code
     * MORNING}, otherwise {@code AFTERNOON}. Also used by the player availability grid
     * (docs/specs/068-player-availability-grid.md) for games not covered by a group window.
     */
    DayPart dayPartOf(Instant matchDate);

    /** The identity of a {@code SectionAvailabilityWindow}, before it's known whether one actually exists yet. */
    record WindowKey(UUID sectionId, LocalDate windowDate, DayPart dayPart) {
    }
}
