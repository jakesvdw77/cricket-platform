package com.cricketlegend.service.support.schedule;

import com.cricketlegend.domain.ImportIssueSeverity;
import com.cricketlegend.domain.ImportOutcome;
import com.cricketlegend.domain.ImportRowAction;
import com.cricketlegend.domain.ImportRowStatus;
import com.cricketlegend.domain.ImportScopeMode;
import com.cricketlegend.dto.ImportIssueDto;
import com.cricketlegend.service.support.schedule.LeagueScheduleIdentity.Difference;
import com.cricketlegend.service.support.schedule.LeagueScheduleIdentity.Evaluation;
import com.cricketlegend.service.support.schedule.ScheduleRule.Severity;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;

/**
 * Every deterministic rule of the league schedule import (docs/specs/098-league-schedule-import.md, "Validation list"),
 * as one pure function over parsed rows, resolved teams, the facts of existing matches and the decisions. No
 * repositories, no Spring, no logging. {@code OURS_ONLY} skips the whole-round rules (tag A) and never raises findings
 * about teams that are not ours; rows involving none of our teams are {@code SKIPPED_NOT_OURS}.
 *
 * <p>Interpretations (the spec's stated defaults): an issue is emitted once per occurrence (one row, one message) and
 * the client groups by code; a note is informational and returned separately because the framework severity has only
 * ERROR and WARNING; a blank venue in the file never counts as a change to an existing match's venue; a weekday word
 * in a cell is checked on every row that would be created or updated.
 */
public final class LeagueScheduleValidator {

    private static final DateTimeFormatter DATE = LeagueScheduleIdentity.DATE_FORMAT;
    private static final DateTimeFormatter TIME = LeagueScheduleIdentity.TIME_FORMAT;

    private LeagueScheduleValidator() {}

    /** Inclusive date range; either end may be null (open). */
    public record DateRange(LocalDate start, LocalDate end) {

        public boolean contains(LocalDate date) {
            return (start == null || !date.isBefore(start)) && (end == null || !date.isAfter(end));
        }

        String text() {
            if (start != null && end != null) {
                return DATE.format(start) + " to " + DATE.format(end);
            }
            if (start != null) {
                return "from " + DATE.format(start);
            }
            return end != null ? "up to " + DATE.format(end) : "";
        }
    }

    /**
     * One parsed row. {@code date} and {@code time} are the parser results (null counts as missing); {@code home} and
     * {@code away} are the resolved sides (null while a name is not yet linked or created); {@code excluded} is the
     * user's decision (excluded rows raise nothing and count for nothing).
     */
    public record Row(
            int rowNumber,
            String sourceRef,
            ScheduleDateParser.Result date,
            ScheduleTimeParser.Result time,
            String homeName,
            String awayName,
            String venue,
            ResolvedSide home,
            ResolvedSide away,
            boolean excluded) {}

    /**
     * Everything around the rows. {@code existing} are the club's existing matches that matter: those of this league
     * and season (identity) and any other active match of the club's teams or at the same venues on the file's dates
     * (overlap and venue clashes), whoever created them. {@code leagueSeasonProblem}, {@code templateMadeFor} and
     * {@code previousImportMessage} are file-level findings the handler detected (null when none).
     */
    public record Context(
            ImportScopeMode mode,
            ZoneId zone,
            UUID leagueId,
            UUID seasonId,
            String seasonLabel,
            DateRange season,
            DateRange leagueSeason,
            int windowDays,
            List<ExistingMatch> existing,
            Collection<String> knownVenues,
            Set<Integer> updateRows,
            boolean updateAllDiffering,
            String leagueSeasonProblem,
            String templateMadeFor,
            String previousImportMessage) {

        public Context {
            existing = existing == null ? List.of() : existing;
            knownVenues = knownVenues == null ? List.of() : knownVenues;
            updateRows = updateRows == null ? Set.of() : updateRows;
        }
    }

    /** An informational finding (never acknowledged). */
    public record Note(String code, List<Integer> rowNumbers, String message) {}

    /**
     * The result for one row. {@code venue} is the spelling to store (an existing spelling when the file's differs only
     * by case, spacing or punctuation); {@code start} the instant in the import's zone; {@code existingMatchId} the
     * matching match for DUPLICATE and DIFFERS, with the old and new values in {@code differences}.
     */
    public record RowResult(
            int rowNumber,
            ImportRowStatus status,
            ImportOutcome outcome,
            ImportRowAction action,
            List<String> issueCodes,
            String existingRef,
            UUID existingMatchId,
            List<Difference> differences,
            String venue,
            Instant start) {}

    public record Result(List<RowResult> rows, List<ImportIssueDto> issues, List<Note> notes) {

        public boolean hasErrors() {
            return issues.stream().anyMatch(i -> i.severity() == ImportIssueSeverity.ERROR);
        }
    }

    public static Result validate(List<Row> rows, Context ctx) {
        return new Run(rows, ctx).run();
    }

    // ---------------------------------------------------------------------------------------------------------------

    private static final class Acc {
        final Row row;
        ImportOutcome outcome = ImportOutcome.NEW;
        ImportRowAction action = ImportRowAction.CREATE;
        final Set<String> codes = new LinkedHashSet<>();
        boolean error;
        boolean warning;
        boolean excluded;
        boolean skipped;
        boolean inFileDuplicate;
        UUID existingId;
        List<Difference> differences = List.of();
        String venue;
        Instant start;
        ScheduleFixture fixture;
        Evaluation evaluation;

        Acc(Row row) {
            this.row = row;
        }

        boolean writes() {
            return action == ImportRowAction.CREATE || action == ImportRowAction.UPDATE;
        }

        boolean active() {
            return !excluded && !skipped;
        }
    }

    private record Item(Integer row, UUID matchId, Instant start, LocalDate date, String venueKey, String venueText,
            Set<String> ownKeys) {}

    private static final class Run {
        private final List<Row> rows;
        private final Context ctx;
        private final Map<Integer, Acc> accs = new LinkedHashMap<>();
        private final List<ImportIssueDto> issues = new ArrayList<>();
        private final Map<String, List<Integer>> noteRows = new LinkedHashMap<>();
        private final Map<String, String> noteMessages = new LinkedHashMap<>();
        private final List<Note> notes = new ArrayList<>();
        private final Set<UUID> linkedExisting = new HashSet<>();

        Run(List<Row> rows, Context ctx) {
            this.rows = rows;
            this.ctx = ctx;
        }

        Result run() {
            fileLevel();
            for (Row row : rows) {
                accs.put(row.rowNumber(), new Acc(row));
            }
            classifyRows();
            for (Acc a : accs.values()) {
                if (a.active()) {
                    fieldChecks(a);
                }
            }
            dateNotes();
            seasonMajority();
            buildFixtures();
            inFileDuplicates();
            identity();
            meetings();
            ownTeamAndVenueRules();
            if (ScheduleRule.TEAM_TWICE_SAME_DATE.appliesIn(ctx.mode())) {
                roundRules();
            }
            weekdayRule();
            derbyAndTwoNames();
            flushNotes();
            return new Result(results(), List.copyOf(issues), List.copyOf(notes));
        }

        // ---- plumbing ------------------------------------------------------------------------------------------

        /**
         * Rows are named by their number only. The row's {@code sourceRef} is the first cell of the row (the Date
         * column), so quoting it beside a team, time or venue message pointed at the wrong cell.
         */
        private static String ref(Acc a) {
            return ScheduleRows.label(a.row.rowNumber());
        }

        private void fileIssue(ScheduleRule rule, String message) {
            issues.add(new ImportIssueDto(rule.name(), severity(rule.severity()), List.of(), null, message, null));
        }

        private void add(Acc a, ScheduleRule rule, String field, String message) {
            add(a, rule, rule.severity(), field, message);
        }

        private void add(Acc a, ScheduleRule rule, Severity severity, String field, String message) {
            add(a, rule, severity, field, message, null);
        }

        private void add(Acc a, ScheduleRule rule, Severity severity, String field, String message, String hint) {
            a.codes.add(rule.name());
            if (severity == Severity.NOTE) {
                noteRows.computeIfAbsent(rule.name(), k -> new ArrayList<>()).add(a.row.rowNumber());
                noteMessages.putIfAbsent(rule.name(), message);
                return;
            }
            if (severity == Severity.ERROR) {
                a.error = true;
            } else {
                a.warning = true;
            }
            issues.add(new ImportIssueDto(rule.name(), severity(severity), List.of(a.row.rowNumber()), field, message, hint));
        }

        /** A note per row with its own message (kept apart from the aggregated notes). */
        private void rowNote(Acc a, ScheduleRule rule, String message) {
            a.codes.add(rule.name());
            notes.add(new Note(rule.name(), List.of(a.row.rowNumber()), message));
        }

        private static ImportIssueSeverity severity(Severity s) {
            return s == Severity.ERROR ? ImportIssueSeverity.ERROR : ImportIssueSeverity.WARNING;
        }

        private void flushNotes() {
            noteRows.forEach((code, numbers) -> {
                String message = switch (code) {
                    case "SKIPPED_NOT_OURS" -> numbers.size() + " of " + rows.size()
                            + " rows do not involve your teams and will not be imported.";
                    case "ALREADY_EXISTS" -> numbers.size() + " matches already exist and will be skipped.";
                    default -> noteMessages.get(code);
                };
                notes.add(new Note(code, List.copyOf(numbers), message));
            });
        }

        private static boolean blank(String s) {
            return s == null || s.trim().isEmpty();
        }

        // ---- file level -------------------------------------------------------------------------------------------

        private void fileLevel() {
            if (ctx.leagueSeasonProblem() != null) {
                fileIssue(ScheduleRule.LEAGUE_OR_SEASON_INVALID, ctx.leagueSeasonProblem());
            }
            if (ctx.templateMadeFor() != null) {
                fileIssue(ScheduleRule.TEMPLATE_SCOPE_MISMATCH, "This template was made for " + ctx.templateMadeFor() + ".");
            }
            if (ctx.previousImportMessage() != null) {
                fileIssue(ScheduleRule.FILE_IMPORTED_BEFORE, ctx.previousImportMessage());
            }
        }

        private void classifyRows() {
            for (Acc a : accs.values()) {
                Row r = a.row;
                if (r.excluded()) {
                    a.excluded = true;
                    a.action = ImportRowAction.EXCLUDED;
                    a.outcome = null;
                    continue;
                }
                if (ctx.mode() == ImportScopeMode.OURS_ONLY && !blank(r.homeName()) && !blank(r.awayName())
                        && !(r.home() != null && r.home().ours()) && !(r.away() != null && r.away().ours())) {
                    a.skipped = true;
                    a.action = ImportRowAction.SKIP;
                    a.outcome = ImportOutcome.SKIPPED_NOT_OURS;
                    add(a, ScheduleRule.SKIPPED_NOT_OURS, null, "");
                }
            }
        }

        private void fieldChecks(Acc a) {
            Row r = a.row;
            // Date.
            var date = r.date();
            if (date == null || !date.ok()) {
                add(a, ScheduleRule.DATE_INVALID, "date", ref(a) + ": " + (date == null ? "The date is missing." : date.message()));
            } else {
                if (date.excelSerial()) {
                    add(a, ScheduleRule.DATE_EXCEL_NUMBER, "date", ref(a) + ": the date was read as an Excel date number ("
                            + DATE.format(date.date()) + "). Check it is right.");
                }
                LocalDate d = date.date();
                if (ctx.season() != null && !ctx.season().contains(d)) {
                    add(a, ScheduleRule.DATE_OUTSIDE_SEASON, "date", ref(a) + ": " + DATE.format(d) + " is outside "
                            + seasonName() + ctx.season().text() + ".");
                } else if (ctx.leagueSeason() != null && !ctx.leagueSeason().contains(d)) {
                    add(a, ScheduleRule.DATE_OUTSIDE_LEAGUE_DATES, ScheduleRule.DATE_OUTSIDE_LEAGUE_DATES.severity(), "date",
                            ref(a) + ": " + DATE.format(d) + " is outside this league's dates, " + ctx.leagueSeason().text() + ".",
                            "Extend the league dates to include these matches, or change the date.");
                }
            }
            // Time.
            var time = r.time();
            if (time == null || !time.ok()) {
                add(a, ScheduleRule.TIME_INVALID, "time", ref(a) + ": " + (time == null ? "The start time is missing." : time.message()));
            } else if (date != null && date.ok()) {
                var instant = ScheduleTimeParser.toInstant(date.date(), time.time(), ctx.zone());
                if (instant.ok()) {
                    a.start = instant.instant();
                } else {
                    add(a, ScheduleRule.TIME_INVALID, "time", ref(a) + ": " + instant.message());
                }
            }
            // Teams.
            if (blank(r.homeName())) {
                add(a, ScheduleRule.TEAM_MISSING, "home", ref(a) + ": the home team is blank.");
            }
            if (blank(r.awayName())) {
                add(a, ScheduleRule.TEAM_MISSING, "away", ref(a) + ": the away team is blank.");
            }
            sideChecks(a, "home", r.homeName(), r.home());
            sideChecks(a, "away", r.awayName(), r.away());
            if (r.home() != null && r.away() != null && r.home().identity().equals(r.away().identity())) {
                add(a, ScheduleRule.TEAM_SAME_BOTH_SIDES, "away", ref(a) + ": " + r.home().name() + " plays itself.");
            }
            // Venue.
            String venue = r.venue() == null ? "" : r.venue().trim().replaceAll("\\s+", " ");
            a.venue = venue;
            if (!venue.isEmpty()) {
                String key = LeagueScheduleIdentity.normaliseVenue(venue);
                for (String known : ctx.knownVenues()) {
                    if (known != null && LeagueScheduleIdentity.normaliseVenue(known).equals(key) && !known.equals(venue)) {
                        a.venue = known;
                        rowNote(a, ScheduleRule.VENUE_SPELLING, ref(a) + ": the venue is spelled '" + venue
                                + "' in the file; the existing spelling '" + known + "' will be used.");
                        break;
                    }
                }
            }
        }

        private String seasonName() {
            return (ctx.seasonLabel() == null ? "the season" : ctx.seasonLabel()) + ", ";
        }

        private void sideChecks(Acc a, String field, String name, ResolvedSide side) {
            if (blank(name)) {
                return;
            }
            if (side == null) {
                add(a, ScheduleRule.TEAM_UNRESOLVED, field, ref(a) + ": '" + name.trim()
                        + "' is not linked to a team yet. Link it or create it in the team step.");
                return;
            }
            if (side.collision() != null) {
                add(a, ScheduleRule.TEAM_NAME_COLLISION, field, ref(a) + ": A league team called '"
                        + side.collision().existingName() + "' already exists"
                        + (side.collision().existingInactive() ? " (inactive)" : "")
                        + ": link it" + (side.collision().existingInactive() ? " or reactivate it" : "") + " first.");
            }
            if (side.kind() == ResolvedSide.Kind.LEAGUE_TEAM && !side.active()) {
                add(a, ScheduleRule.TEAM_INACTIVE, field, ref(a) + ": " + side.name()
                        + " is inactive. Reactivate it in the Teams tab first, or choose another team.");
            }
        }

        // ---- file-wide date notes ---------------------------------------------------------------------------------

        private void dateNotes() {
            List<Acc> counted = new ArrayList<>();
            List<ScheduleDateParser.Result> results = new ArrayList<>();
            for (Acc a : accs.values()) {
                if (!a.excluded && a.row.date() != null) {
                    counted.add(a);
                    results.add(a.row.date());
                }
            }
            for (var note : ScheduleDateParser.fileNotes(results)) {
                List<Integer> numbers = note.rowIndexes().stream().map(i -> counted.get(i).row.rowNumber()).toList();
                if (note.warning()) {
                    ScheduleRule rule = ScheduleRule.valueOf(note.code());
                    issues.add(new ImportIssueDto(rule.name(), ImportIssueSeverity.WARNING, numbers, "date", note.message(), null));
                    numbers.forEach(n -> {
                        Acc a = accs.get(n);
                        a.codes.add(rule.name());
                        a.warning = true;
                    });
                } else {
                    notes.add(new Note(note.code(), numbers, note.message()));
                    numbers.forEach(n -> accs.get(n).codes.add(note.code()));
                }
            }
        }

        private void seasonMajority() {
            if (ctx.season() == null) {
                return;
            }
            int total = 0;
            int outside = 0;
            for (Acc a : accs.values()) {
                if (a.active() && a.row.date() != null && a.row.date().ok()) {
                    total++;
                    if (!ctx.season().contains(a.row.date().date())) {
                        outside++;
                    }
                }
            }
            if (total > 0 && outside * 2 > total) {
                fileIssue(ScheduleRule.FILE_DATES_OUTSIDE_SEASON, outside + " of " + total + " dates are outside "
                        + seasonName() + ctx.season().text() + ". Was the wrong season chosen?");
            }
        }

        // ---- identity ---------------------------------------------------------------------------------------------

        private void buildFixtures() {
            for (Acc a : accs.values()) {
                Row r = a.row;
                boolean usable = a.active() && r.date() != null && r.date().ok() && a.start != null
                        && r.time() != null && r.time().ok() && r.home() != null && r.away() != null
                        && !r.home().identity().equals(r.away().identity());
                if (usable) {
                    a.fixture = new ScheduleFixture(r.rowNumber(), r.home(), r.away(), r.date().date(), r.time().time(), a.venue);
                }
            }
        }

        private void inFileDuplicates() {
            List<ScheduleFixture> fixtures = accs.values().stream().map(a -> a.fixture).filter(f -> f != null).toList();
            for (var finding : LeagueScheduleIdentity.duplicatesInFile(ctx.leagueId(), ctx.seasonId(), fixtures)) {
                Acc a = accs.get(finding.rowNumber());
                ScheduleRule rule = ScheduleRule.valueOf(finding.code());
                a.inFileDuplicate = true;
                a.action = ImportRowAction.SKIP;
                add(a, rule, null, finding.message());
            }
        }

        private void identity() {
            for (Acc a : accs.values()) {
                if (a.fixture == null || a.inFileDuplicate) {
                    continue;
                }
                Evaluation e = LeagueScheduleIdentity.evaluate(
                        ctx.leagueId(), ctx.seasonId(), a.fixture, ctx.existing(), ctx.zone(), ctx.windowDays());
                a.evaluation = e;
                a.outcome = e.outcome();
                switch (e.outcome()) {
                    case DUPLICATE -> {
                        a.action = ImportRowAction.SKIP;
                        a.existingId = e.existing().id();
                        linkedExisting.add(a.existingId);
                        add(a, ScheduleRule.ALREADY_EXISTS, null, "");
                    }
                    case DIFFERS -> differs(a, e);
                    case POSSIBLE_DUPLICATE -> e.possibles().forEach(p ->
                            add(a, ScheduleRule.valueOf(p.code()), null, ref(a) + ": " + p.message()));
                    default -> { }
                }
            }
        }

        private void differs(Acc a, Evaluation e) {
            a.existingId = e.existing().id();
            a.differences = e.differences();
            linkedExisting.add(a.existingId);
            a.action = ImportRowAction.SKIP;
            boolean explicit = ctx.updateRows().contains(a.row.rowNumber());
            boolean wanted = explicit || ctx.updateAllDiffering();
            boolean updatable = e.timeChanges() || e.venueChanges();
            String text = describe(e.differences());
            boolean dependants = !e.existing().dependants().isEmpty();
            if (wanted && updatable) {
                if (e.timeChanges() && dependants) {
                    if (explicit) {
                        add(a, ScheduleRule.UPDATE_BLOCKED, null, ref(a) + ": this match cannot be updated because it has "
                                + String.join(", ", new java.util.TreeSet<>(e.existing().dependants()))
                                + " attached and the start time would change.");
                    }
                    rowNote(a, ScheduleRule.ROW_DIFFERS, ref(a) + ": already exists with a different " + text
                            + ". It cannot be updated because the start time is tied to its poll or selection.");
                    return;
                }
                a.action = ImportRowAction.UPDATE;
                if (!e.timeChanges() && dependants) {
                    add(a, ScheduleRule.ROW_DIFFERS, Severity.WARNING, null, ref(a) + ": the venue will be updated (" + text
                            + "). This match has a poll or announced team; players are not told about the venue change.");
                } else {
                    rowNote(a, ScheduleRule.ROW_DIFFERS, ref(a) + ": will be updated (" + text + ").");
                }
                return;
            }
            rowNote(a, ScheduleRule.ROW_DIFFERS, ref(a) + ": already exists but differs (" + text + "). It is skipped unless you choose to update it.");
        }

        private static String describe(List<Difference> diffs) {
            List<String> parts = new ArrayList<>();
            for (Difference d : diffs) {
                String label = switch (d.field()) {
                    case "TIME" -> "start time";
                    case "VENUE" -> "venue";
                    default -> "home and away swapped";
                };
                parts.add("HOME_AWAY".equals(d.field()) ? label : label + " " + d.oldValue() + " to " + d.newValue());
            }
            return String.join(", ", parts);
        }

        // ---- rule (b): meetings -----------------------------------------------------------------------------------

        private static String sheetPair(Row r) {
            String x = TeamNameMatcher.normalise(r.homeName());
            String y = TeamNameMatcher.normalise(r.awayName());
            return x.compareTo(y) <= 0 ? x + "|" + y : y + "|" + x;
        }

        private static String sidePair(ScheduleFixture f) {
            String x = f.home().identity();
            String y = f.away().identity();
            return x.compareTo(y) <= 0 ? x + "|" + y : y + "|" + x;
        }

        private void meetings() {
            Map<String, Integer> fileCounts = new HashMap<>();
            int max = 1;
            for (Acc a : accs.values()) {
                if (!a.excluded && !blank(a.row.homeName()) && !blank(a.row.awayName())) {
                    max = Math.max(max, fileCounts.merge(sheetPair(a.row), 1, Integer::sum));
                }
            }
            Map<String, Integer> byIdentity = new HashMap<>();
            for (Acc a : accs.values()) {
                if (a.fixture != null && !a.inFileDuplicate) {
                    byIdentity.merge(sidePair(a.fixture), 1, Integer::sum);
                }
            }
            for (Acc a : accs.values()) {
                if (a.fixture == null || a.inFileDuplicate || !a.writes() || a.action == ImportRowAction.UPDATE) {
                    continue;
                }
                int total = byIdentity.get(sidePair(a.fixture)) + LeagueScheduleIdentity.existingMeetings(
                        ctx.leagueId(), ctx.seasonId(), a.fixture, ctx.existing(), linkedExisting);
                if (total > max) {
                    a.outcome = ImportOutcome.POSSIBLE_DUPLICATE;
                    add(a, ScheduleRule.MEETINGS_EXCEED, null, ref(a) + ": these teams would meet " + total
                            + " times this season; the most any pair meets in this file is " + max + ".");
                }
            }
        }

        // ---- own team overlap, same date, venue clashes -----------------------------------------------------------

        private void ownTeamAndVenueRules() {
            List<Item> items = new ArrayList<>();
            Set<UUID> replaced = new HashSet<>();
            Set<LocalDate> fileDates = new HashSet<>();
            for (Acc a : accs.values()) {
                if (a.fixture != null && a.writes() && !a.inFileDuplicate) {
                    ScheduleFixture f = a.fixture;
                    Set<String> own = new HashSet<>();
                    if (f.home().ours()) {
                        own.add(f.home().identity());
                    }
                    if (f.away().ours()) {
                        own.add(f.away().identity());
                    }
                    String venue = a.venue;
                    if (a.action == ImportRowAction.UPDATE) {
                        replaced.add(a.existingId);
                        if (blank(venue) && a.evaluation != null) {
                            venue = a.evaluation.existing().venue();
                        }
                    }
                    items.add(new Item(f.rowNumber(), null, a.start, f.date(), LeagueScheduleIdentity.normaliseVenue(venue),
                            venue, own));
                    fileDates.add(f.date());
                }
            }
            if (items.isEmpty()) {
                return;
            }
            for (ExistingMatch m : ctx.existing()) {
                LocalDate date = m.start().atZone(ctx.zone()).toLocalDate();
                if (!m.active() || replaced.contains(m.id()) || !fileDates.contains(date)) {
                    continue;
                }
                Set<String> own = new HashSet<>();
                if (m.home().teamId() != null) {
                    own.add("T:" + m.home().teamId());
                }
                if (m.away().teamId() != null) {
                    own.add("T:" + m.away().teamId());
                }
                items.add(new Item(null, m.id(), m.start(), date, LeagueScheduleIdentity.normaliseVenue(m.venue()), m.venue(), own));
            }
            ownTeamRules(items);
            venueRules(items);
        }

        private void ownTeamRules(List<Item> items) {
            Map<String, List<Item>> groups = new HashMap<>();
            for (Item item : items) {
                for (String key : item.ownKeys()) {
                    groups.computeIfAbsent(key + "|" + item.date(), k -> new ArrayList<>()).add(item);
                }
            }
            for (Item item : items) {
                if (item.row() == null) {
                    continue;
                }
                Acc a = accs.get(item.row());
                for (String key : item.ownKeys()) {
                    List<Item> others = new ArrayList<>(groups.get(key + "|" + item.date()));
                    others.remove(item);
                    if (others.isEmpty()) {
                        continue;
                    }
                    String team = teamName(a.fixture, key);
                    Item close = others.stream().filter(o -> gapMinutes(item, o) < ScheduleConstants.OWN_TEAM_MIN_GAP_MINUTES)
                            .findFirst().orElse(null);
                    if (close != null) {
                        add(a, ScheduleRule.OWN_TEAM_OVERLAP, "time", ref(a) + ": " + team + " also plays at "
                                + localTime(close) + " on " + DATE.format(item.date()) + " (" + which(close)
                                + "), less than " + ScheduleConstants.OWN_TEAM_MIN_GAP_MINUTES / 60 + " hours from "
                                + localTime(item) + ".");
                    } else {
                        Item other = others.get(0);
                        add(a, ScheduleRule.OWN_TEAM_SAME_DATE, "date", ref(a) + ": " + team + " has another match on "
                                + DATE.format(item.date()) + " at " + localTime(other) + " (" + which(other) + ").");
                    }
                }
            }
        }

        private static String teamName(ScheduleFixture f, String key) {
            return f.home().identity().equals(key) ? f.home().name() : f.away().name();
        }

        private String localTime(Item item) {
            return TIME.format(item.start().atZone(ctx.zone()).toLocalTime());
        }

        private static String which(Item other) {
            return other.row() == null ? "an existing match" : ScheduleRows.label(other.row());
        }

        private static long gapMinutes(Item a, Item b) {
            return Math.abs(java.time.Duration.between(a.start(), b.start()).toMinutes());
        }

        private void venueRules(List<Item> items) {
            Map<String, List<Item>> groups = new HashMap<>();
            for (Item item : items) {
                if (!item.venueKey().isEmpty()) {
                    groups.computeIfAbsent(item.venueKey() + "|" + item.date(), k -> new ArrayList<>()).add(item);
                }
            }
            for (Item item : items) {
                if (item.row() == null || item.venueKey().isEmpty()) {
                    continue;
                }
                List<Item> clashes = new ArrayList<>(groups.get(item.venueKey() + "|" + item.date()));
                clashes.remove(item);
                clashes.removeIf(o -> gapMinutes(item, o) >= ScheduleConstants.VENUE_MIN_GAP_MINUTES);
                if (clashes.isEmpty()) {
                    continue;
                }
                Acc a = accs.get(item.row());
                List<String> others = clashes.stream().limit(3).map(o -> localTime(o) + " (" + which(o) + ")").toList();
                add(a, ScheduleRule.VENUE_TIME_CLASH, "venue", ref(a) + ": " + item.venueText() + " is also used on "
                        + DATE.format(item.date()) + " at " + String.join(", ", others) + ", less than "
                        + ScheduleConstants.VENUE_MIN_GAP_MINUTES / 60 + " hours from " + localTime(item) + ".");
            }
        }

        // ---- whole-round rules (ALL only) -------------------------------------------------------------------------

        private String teamKey(String name, ResolvedSide side) {
            return side != null ? side.identity() : "S:" + TeamNameMatcher.normalise(name);
        }

        private void roundRules() {
            List<Acc> population = new ArrayList<>();
            for (Acc a : accs.values()) {
                Row r = a.row;
                if (a.active() && !a.inFileDuplicate && r.date() != null && r.date().ok()
                        && !blank(r.homeName()) && !blank(r.awayName())) {
                    population.add(a);
                }
            }
            Map<String, String> display = new LinkedHashMap<>();
            Map<String, List<Acc>> byTeamDate = new LinkedHashMap<>();
            Map<LocalDate, Set<String>> playing = new TreeMap<>();
            Map<LocalDate, List<Acc>> rowsOnDate = new TreeMap<>();
            for (Acc a : population) {
                LocalDate date = a.row.date().date();
                for (boolean home : new boolean[] {true, false}) {
                    String name = home ? a.row.homeName() : a.row.awayName();
                    ResolvedSide side = home ? a.row.home() : a.row.away();
                    String key = teamKey(name, side);
                    display.putIfAbsent(key, side != null ? side.name() : name.trim());
                    byTeamDate.computeIfAbsent(date + "|" + key, k -> new ArrayList<>()).add(a);
                    playing.computeIfAbsent(date, k -> new LinkedHashSet<>()).add(key);
                }
                rowsOnDate.computeIfAbsent(date, k -> new ArrayList<>()).add(a);
            }
            byTeamDate.forEach((k, group) -> {
                List<Acc> distinct = group.stream().distinct().toList();
                if (distinct.size() > 1 && distinct.stream().anyMatch(Acc::writes)) {
                    String key = k.substring(k.indexOf('|') + 1);
                    String rowsText = ScheduleRows.labels(distinct.stream().map(x -> x.row.rowNumber()).toList());
                    for (Acc a : distinct) {
                        if (a.writes()) {
                            add(a, ScheduleRule.TEAM_TWICE_SAME_DATE, "date", ref(a) + ": " + display.get(key) + " plays "
                                    + distinct.size() + " times on " + DATE.format(a.row.date().date()) + " ("
                                    + rowsText + ").");
                        }
                    }
                }
            });
            int teams = display.size();
            playing.forEach((date, keys) -> {
                List<Acc> onDate = rowsOnDate.get(date);
                if (!ScheduleConstants.atLeastHalfOfTeams(keys.size(), teams) || keys.size() >= teams
                        || onDate.stream().noneMatch(Acc::writes)) {
                    return;
                }
                List<Integer> numbers = onDate.stream().map(x -> x.row.rowNumber()).toList();
                for (String key : display.keySet()) {
                    if (!keys.contains(key)) {
                        issues.add(new ImportIssueDto(ScheduleRule.TEAM_MISSING_ON_DATE.name(), ImportIssueSeverity.WARNING,
                                numbers, "date", "No match for " + display.get(key) + " on " + DATE.format(date)
                                        + ": a bye or a missing row?", null));
                        onDate.forEach(x -> {
                            x.codes.add(ScheduleRule.TEAM_MISSING_ON_DATE.name());
                            if (x.writes()) {
                                x.warning = true;
                            }
                        });
                    }
                }
            });
        }

        // ---- weekday, derby, two names ---------------------------------------------------------------------------

        private void weekdayRule() {
            Map<DayOfWeek, Integer> counts = new EnumMap<>(DayOfWeek.class);
            int total = 0;
            for (Acc a : accs.values()) {
                if (!a.excluded && a.row.date() != null && a.row.date().ok()) {
                    counts.merge(a.row.date().date().getDayOfWeek(), 1, Integer::sum);
                    total++;
                }
            }
            DayOfWeek usual = null;
            if (total > 0) {
                var top = counts.entrySet().stream().max(Map.Entry.comparingByValue()).orElse(null);
                if (top != null && (double) top.getValue() / total >= ScheduleConstants.WEEKDAY_SHARE) {
                    usual = top.getKey();
                }
            }
            for (Acc a : accs.values()) {
                if (!a.active() || !a.writes() || a.row.date() == null || !a.row.date().ok()) {
                    continue;
                }
                DayOfWeek actual = a.row.date().date().getDayOfWeek();
                if (usual != null && actual != usual) {
                    add(a, ScheduleRule.WEEKDAY_MISMATCH, "date", ref(a) + ": most matches are on " + plural(usual) + "; "
                            + DATE.format(a.row.date().date()) + " is a " + name(actual) + ".");
                }
                DayOfWeek written = a.row.date().weekday();
                if (written != null && written != actual) {
                    add(a, ScheduleRule.WEEKDAY_MISMATCH, "date", ref(a) + ": the cell says " + name(written) + " but "
                            + DATE.format(a.row.date().date()) + " is a " + name(actual) + ".");
                }
            }
        }

        private static String name(DayOfWeek d) {
            return d.getDisplayName(TextStyle.FULL, Locale.ENGLISH);
        }

        private static String plural(DayOfWeek d) {
            return name(d) + "s";
        }

        private void derbyAndTwoNames() {
            Map<String, Map<String, String>> namesByIdentity = new LinkedHashMap<>();
            for (Acc a : accs.values()) {
                if (!a.active()) {
                    continue;
                }
                for (boolean home : new boolean[] {true, false}) {
                    ResolvedSide side = home ? a.row.home() : a.row.away();
                    String name = home ? a.row.homeName() : a.row.awayName();
                    if (side != null && !blank(name)) {
                        namesByIdentity.computeIfAbsent(side.identity(), k -> new LinkedHashMap<>())
                                .putIfAbsent(TeamNameMatcher.normalise(name), name.trim());
                    }
                }
            }
            for (Acc a : accs.values()) {
                if (!a.active() || a.action == ImportRowAction.SKIP && a.outcome == ImportOutcome.DUPLICATE) {
                    continue;
                }
                Row r = a.row;
                if (!blank(r.homeName()) && !blank(r.awayName()) && a.writes()) {
                    boolean bothOurs = r.home() != null && r.away() != null && r.home().ours() && r.away().ours();
                    if (bothOurs || TeamNameMatcher.sisterTeams(r.homeName(), r.awayName())) {
                        add(a, ScheduleRule.SAME_CLUB_DERBY, null, ref(a) + ": this is a derby, " + r.homeName().trim() + " v " + r.awayName().trim()
                                + " are both your club's teams. Tick to confirm.");
                    }
                }
                Set<String> flagged = new HashSet<>();
                for (ResolvedSide side : new ResolvedSide[] {r.home(), r.away()}) {
                    if (side == null || !flagged.add(side.identity())) {
                        continue;
                    }
                    Map<String, String> names = namesByIdentity.get(side.identity());
                    if (names != null && names.size() > 1) {
                        add(a, ScheduleRule.TWO_NAMES_ONE_TEAM, null, ref(a) + ": " + String.join(" and ", names.values())
                                + " both link to " + side.name() + ".");
                    }
                }
            }
            // Row-level checks that depend on the final action.
            for (Acc a : accs.values()) {
                if (a.active() && a.writes() && a.action == ImportRowAction.CREATE) {
                    for (boolean home : new boolean[] {true, false}) {
                        ResolvedSide side = home ? a.row.home() : a.row.away();
                        if (side != null && side.kind() == ResolvedSide.Kind.OWN_TEAM && !side.affiliated()) {
                            add(a, ScheduleRule.OWN_TEAM_NOT_AFFILIATED, home ? "home" : "away", ref(a) + ": " + side.name()
                                    + " is not affiliated to this league this season. The import does not affiliate it.");
                        }
                    }
                    if (blank(a.row.venue())) {
                        add(a, ScheduleRule.VENUE_MISSING, "venue", ref(a) + ": no venue.");
                    }
                }
            }
        }

        // ---- results ----------------------------------------------------------------------------------------------

        private List<RowResult> results() {
            List<RowResult> out = new ArrayList<>(accs.size());
            for (Acc a : accs.values()) {
                ImportRowStatus status = a.excluded ? ImportRowStatus.OK
                        : a.skipped ? ImportRowStatus.SKIPPED_NOT_OURS
                        : a.error ? ImportRowStatus.ERROR
                        : a.warning ? ImportRowStatus.WARNING : ImportRowStatus.OK;
                out.add(new RowResult(a.row.rowNumber(), status, a.outcome, a.action, List.copyOf(a.codes),
                        a.existingId == null ? null : a.existingId.toString(), a.existingId, a.differences, a.venue, a.start));
            }
            return out;
        }
    }
}
