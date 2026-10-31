package com.cricketlegend.service.support.schedule;

import com.cricketlegend.domain.ImportOutcome;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * "The same match" for the league schedule import (docs/specs/098-league-schedule-import.md, "Match identity"). Pure.
 * The identity key is {@code (leagueId, seasonId, unordered pair of resolved side identities, local date)}; time, venue
 * and which side is home are attributes, not part of the key. A side of an existing manual match that is free text is
 * compared by normalised name against the resolved team's name and known names: an exact match is the same side, a
 * merely similar one only raises a possible duplicate.
 */
public final class LeagueScheduleIdentity {

    static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);
    static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm", Locale.ENGLISH);

    public static final String POSSIBLE_NEARBY = "POSSIBLE_DUPLICATE_NEARBY";
    public static final String POSSIBLE_FREE_TEXT = "POSSIBLE_DUPLICATE_FREE_TEXT";
    public static final String DUPLICATE_IN_FILE = "DUPLICATE_ROW_IN_FILE";
    public static final String CONFLICTING_IN_FILE = "CONFLICTING_ROW_IN_FILE";

    private LeagueScheduleIdentity() {}

    /** The comparable identity of a fixture (sides ordered, so home and away do not matter). */
    public record Key(UUID leagueId, UUID seasonId, String sideA, String sideB, LocalDate date) {}

    public static Key key(UUID leagueId, UUID seasonId, ScheduleFixture f) {
        if (f.home() == null || f.away() == null || f.date() == null) {
            return null;
        }
        String a = f.home().identity();
        String b = f.away().identity();
        return a.compareTo(b) <= 0 ? new Key(leagueId, seasonId, a, b, f.date()) : new Key(leagueId, seasonId, b, a, f.date());
    }

    public enum Relation { SAME, SIMILAR, DIFFERENT }

    /** How one resolved side relates to one side of an existing match. */
    public static Relation relation(ResolvedSide resolved, ExistingMatch.Side existing) {
        if (existing.freeText()) {
            String typed = TeamNameMatcher.normalise(existing.name());
            if (typed.isEmpty()) {
                return Relation.DIFFERENT;
            }
            if (resolved.nameKeys().contains(typed)) {
                return Relation.SAME;
            }
            if (TeamNameMatcher.similar(existing.name(), resolved.name())
                    || resolved.knownNames().stream().anyMatch(n -> TeamNameMatcher.similar(existing.name(), n))) {
                return Relation.SIMILAR;
            }
            return Relation.DIFFERENT;
        }
        boolean same = switch (resolved.kind()) {
            case OWN_TEAM -> existing.teamId() != null && existing.teamId().equals(resolved.id());
            case LEAGUE_TEAM -> existing.leagueTeamId() != null && existing.leagueTeamId().equals(resolved.id());
            default -> false;
        };
        return same ? Relation.SAME : Relation.DIFFERENT;
    }

    public enum PairMatch { SAME, SWAPPED, SIMILAR, NONE }

    /** The fixture's pair against an existing match's pair (home against home is {@code SAME}). */
    public static PairMatch pairMatch(ScheduleFixture f, ExistingMatch m) {
        Relation hh = relation(f.home(), m.home());
        Relation aa = relation(f.away(), m.away());
        if (hh == Relation.SAME && aa == Relation.SAME) {
            return PairMatch.SAME;
        }
        Relation ha = relation(f.home(), m.away());
        Relation ah = relation(f.away(), m.home());
        if (ha == Relation.SAME && ah == Relation.SAME) {
            return PairMatch.SWAPPED;
        }
        boolean direct = hh != Relation.DIFFERENT && aa != Relation.DIFFERENT;
        boolean swapped = ha != Relation.DIFFERENT && ah != Relation.DIFFERENT;
        return direct || swapped ? PairMatch.SIMILAR : PairMatch.NONE;
    }

    /** Venue compared after case, spacing and punctuation are removed. */
    public static String normaliseVenue(String venue) {
        if (venue == null) {
            return "";
        }
        String plain = Normalizer.normalize(venue, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return plain.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", "");
    }

    public static String formatDate(LocalDate date) {
        return DATE_FORMAT.format(date);
    }

    public record Difference(String field, String oldValue, String newValue) {}

    /** A possible duplicate finding; {@code dates} are the other dates the teams already meet on. */
    public record Possible(String code, String message, List<LocalDate> dates) {}

    /**
     * The outcome of one fixture against existing matches. {@code existing} is the matching match for DUPLICATE and
     * DIFFERS. {@code timeChanges} and {@code venueChanges} say what an update would change; {@code swapped} says the
     * existing match has the teams the other way round (not updatable).
     */
    public record Evaluation(
            ImportOutcome outcome,
            ExistingMatch existing,
            List<Difference> differences,
            boolean timeChanges,
            boolean venueChanges,
            boolean swapped,
            List<Possible> possibles) {}

    /**
     * Compares one fixture with the existing matches of this league and season (active or inactive, any creator):
     * NEW, DUPLICATE (same key, time and venue), DIFFERS (same key, other time, venue or orientation) or POSSIBLE
     * DUPLICATE (a) the same pair on another date within {@code windowDays}, (c) a similar free-text opponent within
     * the window. Rule (b), too many meetings, needs the whole file and is applied by the validator.
     */
    public static Evaluation evaluate(
            UUID leagueId,
            UUID seasonId,
            ScheduleFixture f,
            Collection<ExistingMatch> existing,
            ZoneId zone,
            int windowDays) {
        ExistingMatch chosen = null;
        List<Difference> chosenDiffs = List.of();
        boolean chosenSwapped = false;
        List<LocalDate> nearby = new ArrayList<>();
        List<LocalDate> freeText = new ArrayList<>();
        for (ExistingMatch m : existing) {
            if (!leagueId.equals(m.leagueId()) || !seasonId.equals(m.seasonId())) {
                continue;
            }
            ZonedDateTime local = m.start().atZone(zone);
            LocalDate date = local.toLocalDate();
            PairMatch pair = pairMatch(f, m);
            if (pair == PairMatch.NONE) {
                continue;
            }
            long days = Math.abs(ChronoUnit.DAYS.between(date, f.date()));
            if ((pair == PairMatch.SAME || pair == PairMatch.SWAPPED) && date.equals(f.date())) {
                boolean swapped = pair == PairMatch.SWAPPED;
                List<Difference> diffs = differences(f, m, local.toLocalTime(), swapped);
                if (chosen == null || (chosenDiffs.size() > diffs.size())) {
                    chosen = m;
                    chosenDiffs = diffs;
                    chosenSwapped = swapped;
                }
            } else if (pair == PairMatch.SIMILAR) {
                if (days <= windowDays) {
                    freeText.add(date);
                }
            } else if (days <= windowDays) {
                nearby.add(date);
            }
        }
        if (chosen != null) {
            boolean time = chosenDiffs.stream().anyMatch(d -> "TIME".equals(d.field()));
            boolean venue = chosenDiffs.stream().anyMatch(d -> "VENUE".equals(d.field()));
            ImportOutcome outcome = chosenDiffs.isEmpty() ? ImportOutcome.DUPLICATE : ImportOutcome.DIFFERS;
            return new Evaluation(outcome, chosen, chosenDiffs, time, venue, chosenSwapped, List.of());
        }
        List<Possible> possibles = new ArrayList<>();
        if (!nearby.isEmpty()) {
            List<LocalDate> dates = nearby.stream().distinct().sorted().toList();
            possibles.add(new Possible(POSSIBLE_NEARBY,
                    "These teams already play on " + joinDates(dates) + ".", dates));
        }
        if (!freeText.isEmpty()) {
            List<LocalDate> dates = freeText.stream().distinct().sorted().toList();
            possibles.add(new Possible(POSSIBLE_FREE_TEXT,
                    "A manually entered match on " + joinDates(dates) + " has a similar team name.", dates));
        }
        ImportOutcome outcome = possibles.isEmpty() ? ImportOutcome.NEW : ImportOutcome.POSSIBLE_DUPLICATE;
        return new Evaluation(outcome, null, List.of(), false, false, false, possibles);
    }

    private static List<Difference> differences(ScheduleFixture f, ExistingMatch m, LocalTime existingTime, boolean swapped) {
        List<Difference> diffs = new ArrayList<>();
        if (!existingTime.withSecond(0).withNano(0).equals(f.time().withSecond(0).withNano(0))) {
            diffs.add(new Difference("TIME", TIME_FORMAT.format(existingTime), TIME_FORMAT.format(f.time())));
        }
        // A blank venue in the file never counts as a change: it would only blank out a known venue.
        if (f.venue() != null && !f.venue().isBlank()
                && !normaliseVenue(f.venue()).equals(normaliseVenue(m.venue()))) {
            diffs.add(new Difference("VENUE", m.venue() == null || m.venue().isBlank() ? "(none)" : m.venue(), f.venue().trim()));
        }
        if (swapped) {
            diffs.add(new Difference("HOME_AWAY",
                    m.home().name() + " v " + m.away().name(), f.home().name() + " v " + f.away().name()));
        }
        return diffs;
    }

    private static String joinDates(List<LocalDate> dates) {
        List<String> text = dates.stream().map(DATE_FORMAT::format).toList();
        return text.size() <= 1 ? String.join("", text)
                : String.join(", ", text.subList(0, text.size() - 1)) + " and " + text.get(text.size() - 1);
    }

    /** How many existing matches of this league and season are between this pair, whatever the date. */
    public static int existingMeetings(
            UUID leagueId, UUID seasonId, ScheduleFixture f, Collection<ExistingMatch> existing, Set<UUID> ignore) {
        int count = 0;
        for (ExistingMatch m : existing) {
            if (!leagueId.equals(m.leagueId()) || !seasonId.equals(m.seasonId()) || ignore.contains(m.id())) {
                continue;
            }
            PairMatch pair = pairMatch(f, m);
            if (pair == PairMatch.SAME || pair == PairMatch.SWAPPED) {
                count++;
            }
        }
        return count;
    }

    /** A row that repeats an earlier row of the file: identical (time and venue) or conflicting. */
    public record InFileFinding(int rowNumber, int firstRowNumber, String code, String message) {}

    /**
     * Same key twice in the file. The first row (in the order given) stays; each later one is a finding naming both
     * rows, DUPLICATE_ROW_IN_FILE when time and venue are identical and CONFLICTING_ROW_IN_FILE when they differ.
     */
    public static List<InFileFinding> duplicatesInFile(UUID leagueId, UUID seasonId, List<ScheduleFixture> fixtures) {
        Map<Key, ScheduleFixture> first = new HashMap<>();
        List<InFileFinding> findings = new ArrayList<>();
        for (ScheduleFixture f : fixtures) {
            Key key = key(leagueId, seasonId, f);
            if (key == null) {
                continue;
            }
            ScheduleFixture earlier = first.putIfAbsent(key, f);
            if (earlier == null) {
                continue;
            }
            boolean identical = earlier.time().withSecond(0).withNano(0).equals(f.time().withSecond(0).withNano(0))
                    && normaliseVenue(earlier.venue()).equals(normaliseVenue(f.venue()));
            findings.add(identical
                    ? new InFileFinding(f.rowNumber(), earlier.rowNumber(), DUPLICATE_IN_FILE,
                            ScheduleRows.label(f.rowNumber()) + " repeats " + ScheduleRows.label(earlier.rowNumber())
                                    + ": same teams, date, time and venue. Exclude one of them.")
                    : new InFileFinding(f.rowNumber(), earlier.rowNumber(), CONFLICTING_IN_FILE,
                            ScheduleRows.label(f.rowNumber()) + " has the same teams and date as " + ScheduleRows.label(earlier.rowNumber())
                                    + " but a different time or venue. Exclude one of them."));
        }
        return findings;
    }
}
