package com.cricketlegend.service.support.schedule;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * The own-team and venue passes of the schedule rules (docs/specs/098-league-schedule-import.md, "Validation list";
 * docs/specs/132-match-scheduling-rules.md). Pure: it decides which matches clash and with whom, and leaves the wording
 * to the caller, so the import validator and {@code MatchScheduleRules} (every manual route) apply one rule and
 * cannot drift. Only those two callers may use it (ArchUnit, {@code ScheduleRuleBypassTest}).
 *
 * <p>An {@link Item} with a non-null {@code row} is a subject (a row of the file, or the match being saved); one with a
 * null {@code row} is an existing match, compared against but never reported on.
 */
public final class ScheduleOverlapRules {

    private ScheduleOverlapRules() {}

    /** One match on the calendar as the two passes see it. {@code ownKeys} are the identities of our own teams in it. */
    public record Item(Integer row, UUID matchId, Instant start, LocalDate date, String venueKey, String venueText,
            Set<String> ownKeys) {}

    /**
     * A clash for {@code item}. {@code rule} is OWN_TEAM_OVERLAP, OWN_TEAM_SAME_DATE or VENUE_TIME_CLASH; {@code ownKey}
     * names the team for the first two (null for the venue rule); {@code others} are the matches it clashes with, the
     * first of them the one the own-team message names.
     */
    public record Finding(Item item, ScheduleRule rule, String field, String ownKey, List<Item> others) {}

    /** Our own team in two matches on one date: an overlap (error) when less than the gap apart, else the same date. */
    public static List<Finding> ownTeam(List<Item> items) {
        Map<String, List<Item>> groups = new HashMap<>();
        for (Item item : items) {
            for (String key : item.ownKeys()) {
                groups.computeIfAbsent(key + "|" + item.date(), k -> new ArrayList<>()).add(item);
            }
        }
        List<Finding> out = new ArrayList<>();
        for (Item item : items) {
            if (item.row() == null) {
                continue;
            }
            for (String key : item.ownKeys()) {
                List<Item> others = new ArrayList<>(groups.get(key + "|" + item.date()));
                others.remove(item);
                if (others.isEmpty()) {
                    continue;
                }
                Item close = others.stream().filter(o -> gapMinutes(item, o) < ScheduleConstants.OWN_TEAM_MIN_GAP_MINUTES)
                        .findFirst().orElse(null);
                if (close != null) {
                    out.add(new Finding(item, ScheduleRule.OWN_TEAM_OVERLAP, "time", key, List.of(close)));
                } else {
                    out.add(new Finding(item, ScheduleRule.OWN_TEAM_SAME_DATE, "date", key, List.of(others.get(0))));
                }
            }
        }
        return out;
    }

    /** The same (normalised) venue on one date less than the venue gap apart. A blank venue never clashes. */
    public static List<Finding> venue(List<Item> items) {
        Map<String, List<Item>> groups = new HashMap<>();
        for (Item item : items) {
            if (!item.venueKey().isEmpty()) {
                groups.computeIfAbsent(item.venueKey() + "|" + item.date(), k -> new ArrayList<>()).add(item);
            }
        }
        List<Finding> out = new ArrayList<>();
        for (Item item : items) {
            if (item.row() == null || item.venueKey().isEmpty()) {
                continue;
            }
            List<Item> clashes = new ArrayList<>(groups.get(item.venueKey() + "|" + item.date()));
            clashes.remove(item);
            clashes.removeIf(o -> gapMinutes(item, o) >= ScheduleConstants.VENUE_MIN_GAP_MINUTES);
            if (!clashes.isEmpty()) {
                out.add(new Finding(item, ScheduleRule.VENUE_TIME_CLASH, "venue", null, clashes));
            }
        }
        return out;
    }

    public static long gapMinutes(Item a, Item b) {
        return Math.abs(Duration.between(a.start(), b.start()).toMinutes());
    }
}
