package com.cricketlegend.service.adaptor;

import static com.cricketlegend.support.ImportedResults.bat;
import static com.cricketlegend.support.ImportedResults.bowl;
import static com.cricketlegend.support.ImportedResults.builder;
import static com.cricketlegend.support.ImportedResults.innings;
import static com.cricketlegend.support.ImportedResults.notOut;
import static com.cricketlegend.support.ImportedResults.team;
import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.TossDecision;
import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.dto.ImportedResultDto.Awards;
import com.cricketlegend.dto.ImportedResultDto.Batting;
import com.cricketlegend.dto.ImportedResultDto.Dls;
import com.cricketlegend.dto.ImportedResultDto.Extras;
import com.cricketlegend.dto.ImportedResultDto.Innings;
import com.cricketlegend.dto.ImportedResultDto.Margin;
import com.cricketlegend.dto.ImportedResultDto.Match;
import com.cricketlegend.dto.ImportedResultDto.PlayerEntry;
import com.cricketlegend.dto.ImportedResultDto.PlayerOfMatch;
import com.cricketlegend.dto.ImportedResultDto.Result;
import com.cricketlegend.dto.ImportedResultDto.Source;
import com.cricketlegend.support.ImportedResults;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * docs/specs/104-match-results-import-adaptors.md Test Plan, {@code ImportedResultValidator} (pure): every shape and
 * reference rule once, each asserting the path and code of the error, plus the reference checks across sections.
 * Cricket arithmetic is {@code ResultValidator}'s and is deliberately not tested here.
 */
class ImportedResultValidatorTest {

    private static List<ImportErrorDto> validate(ImportedResultDto doc) {
        return ImportedResultValidator.validate(doc);
    }

    private static Innings oneInnings(Batting... rows) {
        return innings("A", 100, 5, "20.0", List.of(rows), null, null);
    }

    private static ImportedResultDto withInnings(Innings... innings) {
        return builder().innings(innings).build();
    }

    private record Case(String name, Supplier<ImportedResultDto> document, String path, String code) {
        @Override
        public String toString() {
            return name;
        }
    }

    private static Case c(String name, Supplier<ImportedResultDto> document, String path, String code) {
        return new Case(name, document, path, code);
    }

    private static String longText(int length) {
        return "x".repeat(length);
    }

    // ---- valid ----

    @Test
    void aMinimalDocumentAndAFullScorecardHaveNoErrors() {
        assertThat(validate(builder().build())).isEmpty();
        assertThat(validate(ImportedResults.fullScorecard())).isEmpty();
    }

    @Test
    void aLocatorIsAMatchIdADateOrTheProvidersId() {
        ImportedResults.Builder none = builder().source(null);

        assertThat(validate(none.match(new Match(UUID.randomUUID(), null, null, null, null, null)).build())).isEmpty();
        assertThat(validate(none.match(new Match(null, LocalDate.of(2026, 1, 1), null, null, null, null)).build())).isEmpty();
        assertThat(validate(builder().match(null).source(new Source(null, "P", "id-1", null)).build())).isEmpty();
    }

    @Test
    void everyDismissalTypeIsAcceptedWhereItsBowlerAndFielderAreAllowed() {
        for (DismissalType type : DismissalType.values()) {
            String bowler = type.allowsBowler() ? "Bowler One" : null;
            String fielder = type.allowsFielder() ? "Fielder One" : null;
            Batting row = bat("Batter One", type, bowler, fielder, 1, 1);

            assertThat(validate(withInnings(oneInnings(row)))).as(type.name()).isEmpty();
        }
    }

    @Test
    void aSuperOverInningsIsNotCountedAmongTheRegularInnings() {
        Innings regular = oneInnings();
        Innings superOver = ImportedResults.withKind(oneInnings(), InningsKind.SUPER_OVER);

        assertThat(validate(withInnings(regular, regular, superOver))).isEmpty();
    }

    @Test
    void anOversDigitIsCheckedAgainstTheDocumentsBallsPerOver() {
        Result eightBall = new Result(ResultOutcomeType.WON, "A", null, null, null, null, 8, null, null);
        ImportedResultDto ok = builder().result(eightBall).innings(innings("A", 1, 1, "20.7", null, null, null)).build();
        ImportedResultDto bad = builder().innings(innings("A", 1, 1, "20.7", null, null, null)).build();

        assertThat(validate(ok)).isEmpty();
        assertThat(validate(bad)).extracting(ImportErrorDto::path, ImportErrorDto::code)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("innings[0].overs", "INVALID_OVERS"));
    }

    // ---- every rule once ----

    static Stream<Case> invalidDocuments() {
        return Stream.of(
                c("schemaVersion missing", () -> builder().schemaVersion(null).build(), "schemaVersion", "REQUIRED"),
                c("schemaVersion unsupported", () -> builder().schemaVersion(2).build(), "schemaVersion", "UNSUPPORTED_SCHEMA_VERSION"),
                c("provider blank", () -> builder().source(new Source(null, " ", null, null)).build(), "source.provider", "INVALID_VALUE"),
                c("provider too long", () -> builder().source(new Source(null, longText(41), null, null)).build(), "source.provider", "INVALID_VALUE"),
                c("external id blank", () -> builder().source(new Source(null, "P", " ", null)).build(), "source.externalMatchId", "INVALID_VALUE"),
                c("external id too long", () -> builder().source(new Source(null, "P", longText(256), null)).build(), "source.externalMatchId", "INVALID_VALUE"),
                c("external id without a provider", () -> builder().source(new Source(null, null, "id-1", null)).build(), "source.provider", "REQUIRED"),
                c("no locator at all", () -> builder().match(null).source(null).build(), "match", "LOCATOR_MISSING"),
                c("match without id or date", () -> builder().match(new Match(null, null, null, "Oval", null, null)).source(null).build(), "match", "LOCATOR_MISSING"),
                c("no teams", () -> builder().teams().build(), "teams", "INVALID_VALUE"),
                c("one team", () -> builder().teams(team("A", "Only")).build(), "teams", "INVALID_VALUE"),
                c("three teams", () -> builder().teams(team("A", "One"), team("B", "Two"), team("C", "Three")).build(), "teams", "INVALID_VALUE"),
                c("two teams with one key", () -> builder().teams(team("A", "One"), team("A", "Two")).build(), "teams[1].key", "DUPLICATE"),
                c("team key too long", () -> builder().teams(team("ABCDEFGHI", "One"), team("B", "Two")).build(), "teams[0].key", "INVALID_VALUE"),
                c("team key with a space", () -> builder().teams(team("A B", "One"), team("B", "Two")).build(), "teams[0].key", "INVALID_VALUE"),
                c("team key missing", () -> builder().teams(team(null, "One"), team("B", "Two")).build(), "teams[0].key", "INVALID_VALUE"),
                c("team name blank", () -> builder().teams(team("A", " "), team("B", "Two")).build(), "teams[0].name", "REQUIRED"),
                c("team name too long", () -> builder().teams(team("A", longText(101)), team("B", "Two")).build(), "teams[0].name", "TOO_LONG"),
                c("toss with only a winner", () -> builder().toss("A", null).build(), "toss", "INVALID_VALUE"),
                c("toss with only a decision", () -> builder().toss(null, TossDecision.BAT).build(), "toss", "INVALID_VALUE"),
                c("toss won by an unknown team", () -> builder().toss("Z", TossDecision.BAT).build(), "toss.wonBy", "UNKNOWN_TEAM"),
                c("winner is an unknown team", () -> builder().result(ImportedResults.won("Z", null)).build(), "result.winner", "UNKNOWN_TEAM"),
                c("margin without a type", () -> builder().result(new Result(ResultOutcomeType.WON, "A", null, new Margin(null, 5), null, null, null, null, null)).build(), "result.margin.type", "REQUIRED"),
                c("margin without a value", () -> builder().result(new Result(ResultOutcomeType.WON, "A", null, new Margin(ResultMarginType.RUNS, null), null, null, null, null, null)).build(), "result.margin.value", "REQUIRED"),
                c("margin negative", () -> builder().result(new Result(ResultOutcomeType.WON, "A", null, new Margin(ResultMarginType.RUNS, -1), null, null, null, null, null)).build(), "result.margin.value", "INVALID_VALUE"),
                c("DLS target negative", () -> builder().result(new Result(ResultOutcomeType.WON, "A", null, null, new Dls(-5, null), null, null, null, null)).build(), "result.dls.target", "INVALID_VALUE"),
                c("DLS revised overs negative", () -> builder().result(new Result(ResultOutcomeType.WON, "A", null, null, new Dls(100, -1), null, null, null, null)).build(), "result.dls.revisedOvers", "INVALID_VALUE"),
                c("scheduled overs zero", () -> builder().result(ImportedResults.won("A", 0)).build(), "result.scheduledOvers", "INVALID_VALUE"),
                c("balls per over zero", () -> builder().result(new Result(ResultOutcomeType.WON, "A", null, null, null, null, 0, null, null)).build(), "result.ballsPerOver", "INVALID_VALUE"),
                c("three regular innings", () -> withInnings(oneInnings(), oneInnings(), oneInnings()), "innings", "TOO_MANY"),
                c("an empty innings entry", () -> builder().innings((Innings) null).build(), "innings[0]", "REQUIRED"),
                c("innings without a batting team", () -> withInnings(innings(null, 1, 1, "1.0", null, null, null)), "innings[0].battingTeam", "REQUIRED"),
                c("innings batting team unknown", () -> withInnings(innings("Z", 1, 1, "1.0", null, null, null)), "innings[0].battingTeam", "UNKNOWN_TEAM"),
                c("innings runs negative", () -> withInnings(innings("A", -1, 1, "1.0", null, null, null)), "innings[0].runs", "INVALID_VALUE"),
                c("innings wickets negative", () -> withInnings(innings("A", 1, -1, "1.0", null, null, null)), "innings[0].wickets", "INVALID_VALUE"),
                c("innings overs bad digit", () -> withInnings(innings("A", 1, 1, "20.6", null, null, null)), "innings[0].overs", "INVALID_OVERS"),
                c("innings overs not a number", () -> withInnings(innings("A", 1, 1, "twenty", null, null, null)), "innings[0].overs", "INVALID_OVERS"),
                c("extras negative", () -> withInnings(ImportedResults.withExtras(oneInnings(), new Extras(1, -1, 0, 0, 0))), "innings[0].extras.noBalls", "INVALID_VALUE"),
                c("more than 30 batters", () -> withInnings(innings("A", 1, 1, "1.0", thirtyOneBatters(), null, null)), "innings[0].batting", "TOO_MANY"),
                c("batters and did-not-bat together over 30", () -> withInnings(innings("A", 1, 1, "1.0", thirtyBatters(), List.of("One Extra"), null)), "innings[0].batting", "TOO_MANY"),
                c("more than 30 bowlers", () -> withInnings(innings("A", 1, 1, "1.0", null, null, thirtyOneBowlers())), "innings[0].bowling", "TOO_MANY"),
                c("batter name blank", () -> withInnings(oneInnings(notOut(" ", 1, 1))), "innings[0].batting[0].player", "REQUIRED"),
                c("batter name too long", () -> withInnings(oneInnings(notOut(longText(101), 1, 1))), "innings[0].batting[0].player", "TOO_LONG"),
                c("batting position zero", () -> withInnings(oneInnings(new Batting("Abel Nazar", 0, DismissalType.NOT_OUT, null, null, 1, 1, null, null))), "innings[0].batting[0].position", "INVALID_VALUE"),
                c("batter runs missing", () -> withInnings(oneInnings(notOut("Abel Nazar", null, 1))), "innings[0].batting[0].runs", "REQUIRED"),
                c("batter balls negative", () -> withInnings(oneInnings(notOut("Abel Nazar", 1, -1))), "innings[0].batting[0].balls", "INVALID_VALUE"),
                c("batter fours negative", () -> withInnings(oneInnings(new Batting("Abel Nazar", null, DismissalType.NOT_OUT, null, null, 1, 1, -1, null))), "innings[0].batting[0].fours", "INVALID_VALUE"),
                c("bowler name too long", () -> withInnings(oneInnings(bat("Abel Nazar", DismissalType.BOWLED, longText(101), null, 1, 1))), "innings[0].batting[0].bowler", "TOO_LONG"),
                c("fielder name too long", () -> withInnings(oneInnings(bat("Abel Nazar", DismissalType.CAUGHT, "B One", longText(101), 1, 1))), "innings[0].batting[0].fielder", "TOO_LONG"),
                c("howOut missing", () -> withInnings(oneInnings(bat("Abel Nazar", null, null, null, 1, 1))), "innings[0].batting[0].howOut", "REQUIRED"),
                c("a bowler named on a run-out", () -> withInnings(oneInnings(bat("Abel Nazar", DismissalType.RUN_OUT, "Cees Meyer", "Jon Smith", 1, 1))), "innings[0].batting[0].bowler", "NOT_ALLOWED"),
                c("a bowler named on a not-out", () -> withInnings(oneInnings(bat("Abel Nazar", DismissalType.NOT_OUT, "Cees Meyer", null, 1, 1))), "innings[0].batting[0].bowler", "NOT_ALLOWED"),
                c("a fielder named on a bowled", () -> withInnings(oneInnings(bat("Abel Nazar", DismissalType.BOWLED, "Cees Meyer", "Jon Smith", 1, 1))), "innings[0].batting[0].fielder", "NOT_ALLOWED"),
                c("a fielder named on an lbw", () -> withInnings(oneInnings(bat("Abel Nazar", DismissalType.LBW, "Cees Meyer", "Jon Smith", 1, 1))), "innings[0].batting[0].fielder", "NOT_ALLOWED"),
                c("caught with neither fielder nor bowler", () -> withInnings(oneInnings(bat("Abel Nazar", DismissalType.CAUGHT, null, null, 1, 1))), "innings[0].batting[0].howOut", "FIELDER_OR_BOWLER_REQUIRED"),
                c("did-not-bat name blank", () -> withInnings(innings("A", 1, 1, "1.0", null, List.of(" "), null)), "innings[0].didNotBat[0]", "REQUIRED"),
                c("bowler row name blank", () -> withInnings(innings("A", 1, 1, "1.0", null, null, List.of(bowl("", "4.0", 0, 10, 1)))), "innings[0].bowling[0].player", "REQUIRED"),
                c("bowler row overs missing", () -> withInnings(innings("A", 1, 1, "1.0", null, null, List.of(bowl("Cees Meyer", null, 0, 10, 1)))), "innings[0].bowling[0].overs", "INVALID_OVERS"),
                c("bowler row overs bad digit", () -> withInnings(innings("A", 1, 1, "1.0", null, null, List.of(bowl("Cees Meyer", "4.6", 0, 10, 1)))), "innings[0].bowling[0].overs", "INVALID_OVERS"),
                c("bowler row maidens missing", () -> withInnings(innings("A", 1, 1, "1.0", null, null, List.of(bowl("Cees Meyer", "4.0", null, 10, 1)))), "innings[0].bowling[0].maidens", "REQUIRED"),
                c("bowler row runs negative", () -> withInnings(innings("A", 1, 1, "1.0", null, null, List.of(bowl("Cees Meyer", "4.0", 0, -3, 1)))), "innings[0].bowling[0].runs", "INVALID_VALUE"),
                c("bowler row wickets negative", () -> withInnings(innings("A", 1, 1, "1.0", null, null, List.of(bowl("Cees Meyer", "4.0", 0, 3, -1)))), "innings[0].bowling[0].wickets", "INVALID_VALUE"),
                c("team sheet name blank", () -> builder().players(new PlayerEntry("A", "", null)).build(), "players[0].name", "REQUIRED"),
                c("team sheet team missing", () -> builder().players(new PlayerEntry(null, "Abel Nazar", null)).build(), "players[0].team", "REQUIRED"),
                c("team sheet team unknown", () -> builder().players(new PlayerEntry("Z", "Abel Nazar", null)).build(), "players[0].team", "UNKNOWN_TEAM"),
                c("more than 30 on one team sheet", () -> builder().players(thirtyOnePlayers()).build(), "players", "TOO_MANY"),
                c("player of the match without a name", () -> builder().awards(new Awards(new PlayerOfMatch(null, "A"), null)).build(), "awards.playerOfMatch.name", "REQUIRED"),
                c("player of the match on an unknown team", () -> builder().awards(new Awards(new PlayerOfMatch("Abel Nazar", "Z"), null)).build(), "awards.playerOfMatch.team", "UNKNOWN_TEAM"));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidDocuments")
    void eachRuleReportsItsPathAndCode(Case rule) {
        List<ImportErrorDto> errors = validate(rule.document().get());

        assertThat(errors).as(rule.name()).anySatisfy(error -> {
            assertThat(error.path()).isEqualTo(rule.path());
            assertThat(error.code()).isEqualTo(rule.code());
            assertThat(error.message()).isNotBlank();
        });
    }

    @Test
    void aNullDocumentIsOneRequiredError() {
        assertThat(validate(null)).containsExactly(new ImportErrorDto("", "REQUIRED", "The document is empty."));
    }

    @Test
    void messagesArePlainEnglishAndNameTheProblem() {
        List<ImportErrorDto> errors = validate(withInnings(oneInnings(bat("Abel Nazar", DismissalType.RUN_OUT, "Cees Meyer", "Jon Smith", 1, 1))));

        assertThat(errors).singleElement().satisfies(e -> assertThat(e.message()).isEqualTo("A bowler cannot be named for RUN_OUT."));
    }

    // ---- reference checks across sections ----

    @Test
    void everyTeamKeyReferenceIsCheckedAgainstTheTeamsList() {
        ImportedResultDto doc = builder()
                .toss("X", TossDecision.BAT)
                .result(ImportedResults.won("Y", null))
                .innings(innings("Z", 1, 1, "1.0", null, null, null))
                .players(new PlayerEntry("Q", "Abel Nazar", null))
                .awards(new Awards(new PlayerOfMatch("Abel Nazar", "R"), null))
                .build();

        assertThat(validate(doc)).extracting(ImportErrorDto::path, ImportErrorDto::code).containsExactlyInAnyOrder(
                org.assertj.core.groups.Tuple.tuple("toss.wonBy", "UNKNOWN_TEAM"),
                org.assertj.core.groups.Tuple.tuple("result.winner", "UNKNOWN_TEAM"),
                org.assertj.core.groups.Tuple.tuple("innings[0].battingTeam", "UNKNOWN_TEAM"),
                org.assertj.core.groups.Tuple.tuple("players[0].team", "UNKNOWN_TEAM"),
                org.assertj.core.groups.Tuple.tuple("awards.playerOfMatch.team", "UNKNOWN_TEAM"));
    }

    @Test
    void anAbsentOptionalReferenceIsNotAnError() {
        ImportedResultDto doc = builder()
                .result(new Result(ResultOutcomeType.TIE, null, null, null, null, null, null, null, null))
                .awards(new Awards(new PlayerOfMatch("Abel Nazar", null), null))
                .build();

        assertThat(validate(doc)).isEmpty();
    }

    @Test
    void allProblemsAreReportedNotJustTheFirst() {
        ImportedResultDto doc = builder().schemaVersion(3).match(null).source(null)
                .teams(team("A", "One"), team("A", "Two"))
                .innings(oneInnings(bat("Abel Nazar", null, null, null, -1, 1))).build();

        assertThat(validate(doc)).extracting(ImportErrorDto::code)
                .contains("UNSUPPORTED_SCHEMA_VERSION", "LOCATOR_MISSING", "DUPLICATE", "REQUIRED", "INVALID_VALUE");
        assertThat(validate(doc).size()).isGreaterThanOrEqualTo(5);
    }

    // ---- helpers ----

    private static List<Batting> thirtyBatters() {
        return IntStream.range(0, 30).mapToObj(i -> notOut("Batter " + i, 1, 1)).toList();
    }

    private static List<Batting> thirtyOneBatters() {
        return IntStream.range(0, 31).mapToObj(i -> notOut("Batter " + i, 1, 1)).toList();
    }

    private static List<ImportedResultDto.Bowling> thirtyOneBowlers() {
        return IntStream.range(0, 31).mapToObj(i -> bowl("Bowler " + i, "1.0", 0, 1, 0)).toList();
    }

    private static PlayerEntry[] thirtyOnePlayers() {
        List<PlayerEntry> list = new ArrayList<>();
        IntStream.range(0, 31).forEach(i -> list.add(new PlayerEntry("A", "Player " + i, null)));
        return list.toArray(new PlayerEntry[0]);
    }
}
