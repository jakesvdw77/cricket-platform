package com.cricketlegend.service.support;

import com.cricketlegend.domain.AwardType;
import com.cricketlegend.domain.CreditSource;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.BattingEntryDto;
import com.cricketlegend.dto.BowlingEntryDto;
import com.cricketlegend.dto.ImportCountsDto;
import com.cricketlegend.dto.ImportExactness;
import com.cricketlegend.dto.ImportNoteDto;
import com.cricketlegend.dto.ImportNoteSeverity;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.MatchAwardDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.service.support.ImportCandidateLoader.SideCandidates;
import com.cricketlegend.service.support.ImportPlayerResolver.Person;
import com.cricketlegend.service.support.ImportPlayerResolver.SideNames;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * docs/specs/104-match-results-import-adaptors.md, "The Result Processor": accepts only the common import document plus
 * the club, the chosen match and the manager's confirmed team mapping; knows nothing of adaptors or files. Resolves the
 * names of each side ({@link ImportPlayerResolver}) and derives a {@link ResultDraft} with its scorecard, always a
 * DRAFT, with no fielding rows and no standouts (the server derives those on save and on read). It never creates a
 * person or profile, never publishes, and touches no result entity or repository: persisting is {@code
 * ResultService.saveImportedDraft}. Names are never logged.
 */
@Component
public class ResultImportProcessor {

    /** The draft, what to tell the manager, and per-section exactness (match is added by the caller, who located it). */
    public record ProcessedImport(
            ResultDraft draft, List<ImportNoteDto> notes, ImportCountsDto counts, Map<String, ImportExactness> exactness) {}

    private static final String SUPER_OVER_NOTE = "SUPER_OVER_ROWS_DROPPED";

    private final ImportCandidateLoader candidateLoader;
    private final ImportPlayerResolver playerResolver;

    public ResultImportProcessor(ImportCandidateLoader candidateLoader, ImportPlayerResolver playerResolver) {
        this.candidateLoader = candidateLoader;
        this.playerResolver = playerResolver;
    }

    /** A regular innings of the file with its place in the document, the side batting and the side fielding. */
    private record Used(int index, ImportedResultDto.Innings innings, ResultSide batting, ResultSide fielding) {}

    /** The names of each side the file used, in order of first appearance, and the lists a person appears in once. */
    private static final class Sheet {
        final Map<ResultSide, Set<String>> names = new EnumMap<>(ResultSide.class);
        final Map<ResultSide, List<List<String>>> lists = new EnumMap<>(ResultSide.class);
        final Map<ResultSide, Set<String>> substitutes = new EnumMap<>(ResultSide.class);

        Sheet() {
            for (ResultSide side : ResultSide.values()) {
                names.put(side, new LinkedHashSet<>());
                lists.put(side, new ArrayList<>());
                substitutes.put(side, new HashSet<>());
            }
        }

        void add(ResultSide side, String name) {
            if (name != null && !name.isBlank()) {
                names.get(side).add(name.trim());
            }
        }
    }

    public ProcessedImport process(
            UUID clubId, Match match, ImportedResultDto document, Map<String, ResultSide> sideByKey,
            Map<String, ImportExactness> teamExactness) {
        List<ImportNoteDto> notes = new ArrayList<>();
        Map<ResultSide, SideCandidates> candidates = candidateLoader.load(clubId, match);
        int bpo = document.result() == null ? 6 : document.result().ballsPerOverOrDefault();

        List<Used> used = regularInnings(document, sideByKey, notes);
        Sheet sheet = collect(document, sideByKey, used, notes);
        notes.addAll(noCandidateNotes(candidates, sheet));

        AtomicInteger counter = new AtomicInteger();
        Map<ResultSide, SideNames> resolved = new EnumMap<>(ResultSide.class);
        for (ResultSide side : ResultSide.values()) {
            resolved.put(side, playerResolver.resolve(
                    clubId, side, candidates.get(side), new ArrayList<>(sheet.names.get(side)), sheet.lists.get(side),
                    () -> "p" + counter.incrementAndGet()));
        }
        int exact = 0;
        int normalised = 0;
        int ai = 0;
        int unresolved = 0;
        for (ResultSide side : ResultSide.values()) {
            SideNames names = resolved.get(side);
            notes.addAll(names.notes());
            exact += names.exact();
            normalised += names.normalised();
            ai += names.aiSuggested();
            unresolved += names.unresolved();
        }

        Map<String, ImportExactness> sections = new LinkedHashMap<>();
        List<BattingEntryDto> batting = new ArrayList<>();
        List<BowlingEntryDto> bowling = new ArrayList<>();
        List<InningsDto> inningsDtos = inningsOf(document, sideByKey, bpo, used, notes);
        for (Used u : used) {
            ImportExactness section = teamExactness.getOrDefault(u.innings().battingTeam(), ImportExactness.EXACT);
            section = worst(section, entries(u, resolved, bpo, batting, bowling, notes));
            sections.put("innings[" + u.index() + "]", section);
        }
        ImportedResultDto.PlayerOfMatch pom = document.awards() == null ? null : document.awards().playerOfMatch();
        List<MatchAwardDto> awards = new ArrayList<>();
        if (pom != null && pom.name() != null) {
            ImportExactness awardLevel = award(pom, sideByKey, resolved, awards, notes);
            if (awardLevel != null) {
                sections.put("awards", awardLevel);
            }
        }
        List<ResultPlayerDto> players = playersOf(resolved, sheet, batting);
        ImportExactness playerLevel = ImportExactness.EXACT;
        for (Person person : resolved.values().stream().flatMap(n -> n.people().stream()).toList()) {
            playerLevel = worst(playerLevel, person.level());
        }
        sections.put("players", playerLevel);
        sections.put("teams", teamExactness.values().stream().reduce(ImportExactness.EXACT, ResultImportProcessor::worst));
        if (document.toss() != null && document.toss().wonBy() != null) {
            sections.put("toss", teamExactness.getOrDefault(document.toss().wonBy(), ImportExactness.EXACT));
        }
        if (document.result() != null) {
            String winner = document.result().winner();
            sections.put("result", winner == null ? ImportExactness.EXACT : teamExactness.getOrDefault(winner, ImportExactness.EXACT));
        }

        ScorecardDto scorecard = players.isEmpty()
                ? null
                : new ScorecardDto(players, batting, bowling, List.of(), awards, List.of(), List.of());
        ResultDraft draft = draft(document, sideByKey, bpo, inningsDtos, scorecard);
        return new ProcessedImport(draft, notes, new ImportCountsDto(exact, normalised, ai, unresolved), sections);
    }

    // ---- which innings and which names ----

    /**
     * The regular innings to take rows from. A super-over innings keeps its totals but its rows are dropped (super-over
     * scorecards are not supported yet). A forfeit's empty innings (no runs, no wickets, no rows) are dropped entirely.
     */
    private List<Used> regularInnings(ImportedResultDto document, Map<String, ResultSide> sideByKey, List<ImportNoteDto> notes) {
        List<Used> used = new ArrayList<>();
        List<ImportedResultDto.Innings> all = document.innings() == null ? List.of() : document.innings();
        for (int i = 0; i < all.size(); i++) {
            ImportedResultDto.Innings innings = all.get(i);
            if (isEmptyForfeit(document, innings)) {
                continue;
            }
            if (innings.kind() == InningsKind.SUPER_OVER) {
                if (hasRows(innings)) {
                    notes.add(ImportNoteDto.of(SUPER_OVER_NOTE, ImportNoteSeverity.WARNING, "innings[" + i + "]",
                            "The batting and bowling rows of the super over were not imported; its totals were."));
                }
                continue;
            }
            ResultSide batting = sideByKey.get(innings.battingTeam());
            used.add(new Used(i, innings, batting, batting == ResultSide.HOME ? ResultSide.AWAY : ResultSide.HOME));
        }
        return used;
    }

    private static boolean isEmptyForfeit(ImportedResultDto document, ImportedResultDto.Innings innings) {
        return document.result() != null && document.result().outcome() == ResultOutcomeType.FORFEIT
                && (innings.runs() == null || innings.runs() == 0)
                && (innings.wickets() == null || innings.wickets() == 0)
                && !hasRows(innings);
    }

    private static boolean hasRows(ImportedResultDto.Innings innings) {
        return !(innings.batting() == null || innings.batting().isEmpty())
                || !(innings.didNotBat() == null || innings.didNotBat().isEmpty())
                || !(innings.bowling() == null || innings.bowling().isEmpty());
    }

    private Sheet collect(
            ImportedResultDto document, Map<String, ResultSide> sideByKey, List<Used> used, List<ImportNoteDto> notes) {
        Sheet sheet = new Sheet();
        for (Used u : used) {
            ImportedResultDto.Innings innings = u.innings();
            List<String> batterNames = new ArrayList<>();
            for (ImportedResultDto.Batting row : orEmpty(innings.batting())) {
                sheet.add(u.batting(), row.player());
                batterNames.add(row.player());
            }
            for (String name : orEmpty(innings.didNotBat())) {
                sheet.add(u.batting(), name);
                batterNames.add(name);
            }
            sheet.lists.get(u.batting()).add(batterNames);
            List<String> bowlerNames = new ArrayList<>();
            for (ImportedResultDto.Bowling row : orEmpty(innings.bowling())) {
                sheet.add(u.fielding(), row.player());
                bowlerNames.add(row.player());
            }
            sheet.lists.get(u.fielding()).add(bowlerNames);
            for (ImportedResultDto.Batting row : orEmpty(innings.batting())) {
                sheet.add(u.fielding(), row.bowler());
                sheet.add(u.fielding(), row.fielder());
            }
            if (innings.fallOfWickets() != null && !innings.fallOfWickets().isNull()
                    || innings.overByOver() != null && !innings.overByOver().isNull()) {
                notes.add(ImportNoteDto.of("IGNORED_FALL_OF_WICKETS", ImportNoteSeverity.INFO, "innings[" + u.index() + "]",
                        "Fall of wickets and over by over are not imported."));
            }
        }
        for (ImportedResultDto.PlayerEntry entry : orEmpty(document.players())) {
            ResultSide side = sideByKey.get(entry.team());
            if (side != null && entry.name() != null && !entry.name().isBlank()) {
                sheet.add(side, entry.name());
                if (Boolean.TRUE.equals(entry.substitute())) {
                    sheet.substitutes.get(side).add(entry.name().trim());
                }
            }
        }
        ImportedResultDto.PlayerOfMatch pom = document.awards() == null ? null : document.awards().playerOfMatch();
        if (pom != null && pom.name() != null && !pom.name().isBlank()) {
            ResultSide side = pom.team() != null ? sideByKey.get(pom.team()) : sideNamed(sheet, pom.name());
            if (side != null) {
                sheet.add(side, pom.name());
            }
        }
        return sheet;
    }

    /** The one side whose names already include this person (apart from case, spacing and word order), or null. */
    private static ResultSide sideNamed(Sheet sheet, String name) {
        String signature = signature(name);
        List<ResultSide> sides = new ArrayList<>();
        for (ResultSide side : ResultSide.values()) {
            if (sheet.names.get(side).stream().anyMatch(known -> signature(known).equals(signature))) {
                sides.add(side);
            }
        }
        return sides.size() == 1 ? sides.get(0) : null;
    }

    private static String signature(String name) {
        return NameTokens.of(name).words().stream()
                .map(PlayerNameMatcher::canonical)
                .sorted()
                .collect(Collectors.joining(" "));
    }

    private static List<ImportNoteDto> noCandidateNotes(Map<ResultSide, SideCandidates> candidates, Sheet sheet) {
        List<ImportNoteDto> notes = new ArrayList<>();
        for (ResultSide side : ResultSide.values()) {
            SideCandidates ours = candidates.get(side);
            if (ours != null && ours.candidates().isEmpty() && !sheet.names.get(side).isEmpty()) {
                notes.add(ImportNoteDto.of("NO_CANDIDATES", ImportNoteSeverity.INFO, "players",
                        "No team is selected and the squad is empty for the " + side.name().toLowerCase(Locale.ROOT)
                                + " side, so every name of ours is a guest."));
            }
        }
        return notes;
    }

    // ---- the scorecard ----

    /** Everyone the file named, per side. A listed substitute who batted is not a substitute fielder, so is not marked. */
    private List<ResultPlayerDto> playersOf(
            Map<ResultSide, SideNames> resolved, Sheet sheet, List<BattingEntryDto> batting) {
        Set<String> batted = batting.stream()
                .filter(e -> e.howOut() != DismissalType.DID_NOT_BAT)
                .map(BattingEntryDto::playerClientKey)
                .collect(Collectors.toSet());
        List<ResultPlayerDto> players = new ArrayList<>();
        for (ResultSide side : ResultSide.values()) {
            SideNames names = resolved.get(side);
            Set<String> substituteSpellings = sheet.substitutes.get(side);
            Set<String> substituteKeys = new HashSet<>();
            substituteSpellings.forEach(spelling -> {
                Person person = names.of(spelling);
                if (person != null && !batted.contains(person.clientKey())) {
                    substituteKeys.add(person.clientKey());
                }
            });
            for (Person person : names.people()) {
                players.add(new ResultPlayerDto(
                        null, person.clientKey(), side, person.playerProfileId(), person.displayName(),
                        person.plannedBattingOrder(), null, substituteKeys.contains(person.clientKey()),
                        person.opposition(), null, null, false, null, null, person.importMatch()));
            }
        }
        return players;
    }

    /**
     * Batting and bowling rows of one innings, in file order, plus the did-not-bat rows. Returns the worst exactness of
     * the people used. A person already on a list (two spellings that unified) is not added twice.
     */
    private ImportExactness entries(
            Used used, Map<ResultSide, SideNames> resolved, int bpo, List<BattingEntryDto> batting,
            List<BowlingEntryDto> bowling, List<ImportNoteDto> notes) {
        ImportedResultDto.Innings innings = used.innings();
        SideNames batters = resolved.get(used.batting());
        SideNames fielders = resolved.get(used.fielding());
        String section = "innings[" + used.index() + "]";
        ImportExactness worst = ImportExactness.EXACT;
        Set<String> onBatting = new HashSet<>();

        List<ImportedResultDto.Batting> rows = orEmpty(innings.batting());
        boolean givenPositionsUsable = positionsUsable(rows);
        int order = 0;
        int notOutNoBalls = 0;
        for (ImportedResultDto.Batting row : rows) {
            Person person = batters.of(row.player());
            if (person == null || !onBatting.add(person.clientKey())) {
                notes.add(ImportNoteDto.of("DUPLICATE_ROW_SKIPPED", ImportNoteSeverity.WARNING, section,
                        "A batting row for a player already listed in this innings was skipped."));
                continue;
            }
            order++;
            if (row.howOut() == DismissalType.NOT_OUT && isZeroOrNull(row.runs()) && isZeroOrNull(row.balls())) {
                notOutNoBalls++;
            }
            Person bowler = row.bowler() == null ? null : fielders.of(row.bowler());
            Person fielder = row.fielder() == null ? null : fielders.of(row.fielder());
            batting.add(new BattingEntryDto(
                    null, used.batting(), InningsKind.REGULAR, null, person.clientKey(),
                    givenPositionsUsable ? row.position() : order, row.howOut(), row.runs(), row.balls(), row.fours(),
                    row.sixes(), bowler == null ? null : bowler.clientKey(), fielder == null ? null : fielder.clientKey(),
                    null, null, null));
            worst = worst(worst, person.level());
            worst = worst(worst, bowler == null ? ImportExactness.EXACT : bowler.level());
            worst = worst(worst, fielder == null ? ImportExactness.EXACT : fielder.level());
        }
        if (notOutNoBalls > 0) {
            // Only a nudge: the rows are imported as the file says. CricClubs has no did-not-bat marker, so a 0 (0) not out
            // may be someone who never batted. No names here, the manager sees the rows in the wizard.
            notes.add(ImportNoteDto.of("NOT_OUT_NO_BALLS", ImportNoteSeverity.WARNING, section,
                    (notOutNoBalls == 1 ? "1 batter is" : notOutNoBalls + " batters are")
                            + " not out with 0 balls faced. If they did not bat, set them to Did not bat."));
        }
        for (String name : orEmpty(innings.didNotBat())) {
            Person person = batters.of(name);
            if (person == null || !onBatting.add(person.clientKey())) {
                continue;
            }
            batting.add(new BattingEntryDto(
                    null, used.batting(), InningsKind.REGULAR, null, person.clientKey(), null, DismissalType.DID_NOT_BAT,
                    null, null, null, null, null, null, null, null, null));
            worst = worst(worst, person.level());
        }

        Set<String> onBowling = new HashSet<>();
        int bowlingOrder = 0;
        for (ImportedResultDto.Bowling row : orEmpty(innings.bowling())) {
            Person person = fielders.of(row.player());
            if (person == null || !onBowling.add(person.clientKey())) {
                notes.add(ImportNoteDto.of("DUPLICATE_ROW_SKIPPED", ImportNoteSeverity.WARNING, section,
                        "A bowling row for a player already listed in this innings was skipped."));
                continue;
            }
            bowlingOrder++;
            Integer balls = ballsOf(row.overs(), bpo);
            bowling.add(new BowlingEntryDto(
                    null, used.batting(), InningsKind.REGULAR, null, person.clientKey(), bowlingOrder, balls,
                    row.maidens(), row.runs(), row.wickets(), row.wides(), row.noBalls(), row.dots(), CreditSource.MANUAL,
                    null, null, null, null));
            worst = worst(worst, person.level());
        }
        return worst;
    }

    private static boolean isZeroOrNull(Integer value) {
        return value == null || value == 0;
    }

    private static boolean positionsUsable(List<ImportedResultDto.Batting> rows) {
        Set<Integer> seen = new HashSet<>();
        for (ImportedResultDto.Batting row : rows) {
            if (row.position() == null || row.position() < 1 || !seen.add(row.position())) {
                return false;
            }
        }
        return true;
    }

    private ImportExactness award(
            ImportedResultDto.PlayerOfMatch pom, Map<String, ResultSide> sideByKey, Map<ResultSide, SideNames> resolved,
            List<MatchAwardDto> awards, List<ImportNoteDto> notes) {
        Person person = null;
        if (pom.team() != null && sideByKey.get(pom.team()) != null) {
            person = resolved.get(sideByKey.get(pom.team())).of(pom.name());
        } else {
            for (ResultSide side : ResultSide.values()) {
                Person found = resolved.get(side).of(pom.name());
                if (found != null) {
                    person = found;
                    break;
                }
            }
        }
        if (person == null) {
            notes.add(ImportNoteDto.of("AWARD_NOT_PLACED", ImportNoteSeverity.WARNING, "awards",
                    "The player of the match is not named elsewhere in the file and no team was given, so the award was"
                            + " not imported."));
            return null;
        }
        awards.add(new MatchAwardDto(null, AwardType.PLAYER_OF_MATCH, person.side(), null, person.clientKey(), null, null));
        return person.level();
    }

    // ---- the draft ----

    private List<InningsDto> inningsOf(
            ImportedResultDto document, Map<String, ResultSide> sideByKey, int bpo, List<Used> used, List<ImportNoteDto> notes) {
        Set<Integer> regular = used.stream().map(Used::index).collect(Collectors.toSet());
        List<InningsDto> out = new ArrayList<>();
        List<ImportedResultDto.Innings> all = document.innings() == null ? List.of() : document.innings();
        for (int i = 0; i < all.size(); i++) {
            ImportedResultDto.Innings innings = all.get(i);
            boolean superOver = innings.kind() == InningsKind.SUPER_OVER;
            if (!regular.contains(i) && !superOver) {
                continue; // an empty forfeit innings
            }
            ImportedResultDto.Extras extras = innings.extras();
            out.add(new InningsDto(
                    out.size() + 1, superOver ? InningsKind.SUPER_OVER : InningsKind.REGULAR,
                    sideByKey.get(innings.battingTeam()), innings.runs(), innings.wickets(), ballsOf(innings.overs(), bpo),
                    null, null, null, extras == null ? null : extras.wides(), extras == null ? null : extras.noBalls(),
                    extras == null ? null : extras.byes(), extras == null ? null : extras.legByes(),
                    extras == null ? null : extras.penalty(), null));
        }
        return out;
    }

    private ResultDraft draft(
            ImportedResultDto document, Map<String, ResultSide> sideByKey, int bpo, List<InningsDto> innings,
            ScorecardDto scorecard) {
        ImportedResultDto.Result result = document.result();
        ResultOutcomeType outcome = result == null ? null : result.outcome();
        boolean decided = outcome == ResultOutcomeType.WON;
        ResultDecidedBy decidedBy = result == null || result.decidedBy() == null || !decided
                ? ResultDecidedBy.REGULAR
                : result.decidedBy();
        boolean hasWinner = outcome == ResultOutcomeType.WON || outcome == ResultOutcomeType.FORFEIT;
        ResultSide winner = hasWinner && result.winner() != null ? sideByKey.get(result.winner()) : null;
        boolean hasMargin = decided && decidedBy != ResultDecidedBy.SUPER_OVER && result.margin() != null;
        ResultMarginType marginType = hasMargin ? result.margin().type() : null;
        Integer marginValue = hasMargin ? result.margin().value() : null;
        Integer dlsTarget = result != null && result.dls() != null ? result.dls().target() : null;
        Integer dlsBalls = result != null && result.dls() != null && result.dls().revisedOvers() != null
                ? result.dls().revisedOvers() * bpo : null;
        Integer scheduled = result != null && result.scheduledOvers() != null ? result.scheduledOvers() * bpo : null;
        ImportedResultDto.Toss toss = document.toss();
        return new ResultDraft(
                outcome, decidedBy, winner, marginType, marginValue, dlsTarget, dlsBalls, scheduled, bpo,
                toss == null ? null : sideByKey.get(toss.wonBy()), toss == null ? null : toss.decision(), null,
                result == null ? null : result.note(), innings, scorecard);
    }

    // ---- helpers ----

    private static Integer ballsOf(String overs, int bpo) {
        if (overs == null) {
            return null;
        }
        OversFormat.Parsed parsed = OversFormat.parse(overs, bpo);
        return parsed.valid() ? parsed.balls() : null;
    }

    private static <T> List<T> orEmpty(List<T> list) {
        return list == null ? Collections.emptyList() : list;
    }

    /** The worse of two exactness levels: EXACT, then NORMALISED, AI_SUGGESTED, UNRESOLVED. */
    static ImportExactness worst(ImportExactness a, ImportExactness b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.ordinal() >= b.ordinal() ? a : b;
    }
}
