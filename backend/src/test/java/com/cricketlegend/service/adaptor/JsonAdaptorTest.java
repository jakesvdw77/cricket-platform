package com.cricketlegend.service.adaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.TossDecision;
import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.exception.ImportInputValidationException;
import com.cricketlegend.exception.UnreadableImportInputException;
import com.cricketlegend.exception.UnsupportedImportFormatException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import java.util.stream.Stream;

/**
 * docs/specs/104-match-results-import-adaptors.md Test Plan, {@code JsonAdaptor}: valid documents (minimal, team list
 * only, full innings with dismissals, DLS, super over) and invalid ones, each asserting the path, code and message of
 * the errors; the strict parse; the surrounding markdown code fence; {@code transform} unchanged; AI false; and the
 * conversion prompt. Documents use invented names only.
 */
class JsonAdaptorTest {

    private final JsonAdaptor adaptor = new JsonAdaptor();

    private ImportedResultDto paste(String text) {
        return adaptor.importFrom(ImportInput.paste(ImportInputFormat.JSON, text));
    }

    private ImportInputValidationException invalid(String text) {
        Throwable thrown = catchThrowable(() -> paste(text));
        assertThat(thrown).isInstanceOf(ImportInputValidationException.class);
        return (ImportInputValidationException) thrown;
    }

    private static Throwable catchThrowable(Runnable run) {
        try {
            run.run();
            return null;
        } catch (Throwable t) {
            return t;
        }
    }

    private static String doc(String extra) {
        return """
                {
                  "schemaVersion": 1,
                  "source": { "provider": "EXAMPLE", "externalMatchId": "m-1" },
                  "match": { "date": "2026-10-10" },
                  "teams": [ { "key": "A", "name": "Home Club 1" }, { "key": "B", "name": "Visitors 1" } ]%s
                }""".formatted(extra.isEmpty() ? "" : ",\n  " + extra);
    }

    private static String batRow(String player, String howOut, String bowler, String fielder, String figures) {
        return "{ \"player\": \"" + player + "\", \"howOut\": \"" + howOut + "\""
                + (bowler == null ? "" : ", \"bowler\": \"" + bowler + "\"")
                + (fielder == null ? "" : ", \"fielder\": \"" + fielder + "\"") + ", " + figures + " }";
    }

    private static String innings(String battingRows) {
        return "\"innings\": [ { \"battingTeam\": \"A\", \"runs\": 100, \"wickets\": 3, \"overs\": \"20.0\", \"batting\": [ "
                + battingRows + " ] } ]";
    }

    // ---- descriptor ----

    @Test
    void theDescriptorDeclaresJsonUploadAndPasteWithNoAi() {
        assertThat(adaptor.getType()).isEqualTo(AdaptorType.JSON);
        assertThat(adaptor.getSupportedFormats()).containsExactly(ImportInputFormat.JSON);
        assertThat(adaptor.isAiAllowed()).isFalse();
        assertThat(adaptor.getExample()).isNotBlank();
    }

    @Test
    void otherFormatsAreRefused() {
        assertThatThrownBy(() -> adaptor.importFrom(ImportInput.file(ImportInputFormat.CSV, "a.csv", new byte[] {1})))
                .isInstanceOfSatisfying(UnsupportedImportFormatException.class,
                        ex -> assertThat(ex.getSupported()).containsExactly("JSON"));
    }

    // ---- valid documents ----

    @Test
    void aMinimalMatchOnlyDocumentIsAccepted() {
        ImportedResultDto result = paste(doc(""));

        assertThat(result.schemaVersion()).isEqualTo(1);
        assertThat(result.teams()).extracting(ImportedResultDto.Team::key).containsExactly("A", "B");
        assertThat(result.innings()).isNull();
        assertThat(result.source().adaptor()).isEqualTo(AdaptorType.JSON);
        assertThat(result.source().provider()).isEqualTo("EXAMPLE");
    }

    @Test
    void aTeamListOnlyDocumentIsAccepted() {
        ImportedResultDto result = paste(doc("""
                "players": [ { "team": "A", "name": "Abel Nazar" }, { "team": "A", "name": "Cees Meyer", "substitute": true },
                             { "team": "B", "name": "Jon Smith" } ]"""));

        assertThat(result.players()).hasSize(3);
        assertThat(result.players().get(1).substitute()).isTrue();
        assertThat(result.innings()).isNull();
    }

    @Test
    void aFullInningsWithDismissalsIsAccepted() {
        ImportedResultDto result = paste(doc("""
                "toss": { "wonBy": "B", "decision": "BAT" },
                "result": { "outcome": "WON", "winner": "A", "margin": { "type": "RUNS", "value": 24 }, "scheduledOvers": 40 },
                "innings": [
                  { "battingTeam": "B", "runs": 180, "wickets": 4, "overs": "40.0",
                    "extras": { "wides": 6, "noBalls": 1, "byes": 2, "legByes": 1, "penalty": 0 },
                    "batting": [
                      { "player": "Jon Smith", "howOut": "CAUGHT", "fielder": "Abel Nazar", "bowler": "Cees Meyer", "runs": 42, "balls": 51, "fours": 4, "sixes": 1 },
                      { "player": "Pat Jones", "howOut": "RUN_OUT", "fielder": "Abel Nazar", "runs": 10, "balls": 14 },
                      { "player": "Rob Brown", "howOut": "STUMPED", "bowler": "Cees Meyer", "fielder": "Tim Hill", "runs": 5, "balls": 9 },
                      { "player": "Ian Gray", "howOut": "NOT_OUT", "runs": 30, "balls": 28 } ],
                    "didNotBat": [ "Sam Wood" ],
                    "bowling": [ { "player": "Cees Meyer", "overs": "8.0", "maidens": 1, "runs": 31, "wickets": 3, "dots": 22 } ] }
                ],
                "awards": { "playerOfMatch": { "name": "Cees Meyer" } }"""));

        assertThat(result.toss().decision()).isEqualTo(TossDecision.BAT);
        assertThat(result.result().outcome()).isEqualTo(ResultOutcomeType.WON);
        assertThat(result.innings()).singleElement().satisfies(i -> {
            assertThat(i.batting()).extracting(ImportedResultDto.Batting::howOut)
                    .containsExactly(DismissalType.CAUGHT, DismissalType.RUN_OUT, DismissalType.STUMPED, DismissalType.NOT_OUT);
            assertThat(i.batting().get(0).fielder()).isEqualTo("Abel Nazar");
            assertThat(i.didNotBat()).containsExactly("Sam Wood");
            assertThat(i.bowling().get(0).overs()).isEqualTo("8.0");
        });
    }

    @Test
    void aDlsResultAndASuperOverInningsAreAccepted() {
        ImportedResultDto result = paste(doc("""
                "result": { "outcome": "WON", "winner": "B", "decidedBy": "DLS", "dls": { "target": 132, "revisedOvers": 18 },
                            "margin": { "type": "WICKETS", "value": 3 }, "ballsPerOver": 6 },
                "innings": [
                  { "battingTeam": "A", "runs": 140, "wickets": 8, "overs": "20.0" },
                  { "battingTeam": "B", "runs": 133, "wickets": 7, "overs": "17.2" },
                  { "battingTeam": "A", "kind": "SUPER_OVER", "runs": 9, "wickets": 1, "overs": "1.0" } ]"""));

        assertThat(result.result().dls().target()).isEqualTo(132);
        assertThat(result.result().dls().revisedOvers()).isEqualTo(18);
        assertThat(result.innings()).extracting(ImportedResultDto.Innings::kind)
                .containsExactly(null, null, InningsKind.SUPER_OVER);
    }

    @Test
    void theBuiltInExampleIsItselfAValidDocument() {
        ImportedResultDto result = paste(adaptor.getExample());

        assertThat(result.innings()).hasSize(1);
        assertThat(result.source().externalMatchId()).isEqualTo("match-1");
    }

    // ---- ignored and annotation properties ----

    @Test
    void fallOfWicketsAndOverByOverAreAcceptedAndKeptOnlyToBeIgnored() {
        ImportedResultDto result = paste(doc("""
                "innings": [ { "battingTeam": "A", "runs": 10, "wickets": 1, "overs": "2.0",
                               "fallOfWickets": [ { "wicket": 1, "score": 5 } ], "overByOver": { "1": 4, "2": 6 } } ]"""));

        assertThat(result.innings().get(0).fallOfWickets()).isNotNull();
        assertThat(result.innings().get(0).overByOver()).isNotNull();
    }

    @Test
    void anXPrefixedPropertyIsAcceptedAtAnyDepthAndRemoved() {
        ImportedResultDto result = paste("""
                { "x-note": "converted by hand", "schemaVersion": 1,
                  "source": { "provider": "EXAMPLE", "externalMatchId": "m-1", "x-origin": { "page": 3 } },
                  "teams": [ { "key": "A", "name": "Home Club 1", "x-colour": "red" }, { "key": "B", "name": "Visitors 1" } ],
                  "innings": [ { "battingTeam": "A", "runs": 1, "wickets": 0, "overs": "1.0",
                                 "batting": [ { "player": "Abel Nazar", "howOut": "NOT_OUT", "runs": 1, "x-strikeRate": 100 } ] } ] }""");

        assertThat(result.innings().get(0).batting()).hasSize(1);
        assertThat(result.teams().get(0).name()).isEqualTo("Home Club 1");
    }

    // ---- transform ----

    @Test
    void transformReturnsTheParsedInputFieldForField() {
        String text = doc("""
                "toss": { "wonBy": "B", "decision": "BOWL" },
                "innings": [ { "battingTeam": "A", "runs": 11, "wickets": 0, "overs": "2.1",
                               "batting": [ { "player": "Abel Nazar", "howOut": "NOT_OUT", "runs": 11, "balls": 13, "fours": 1, "sixes": 0 } ] } ]""");

        ImportedResultDto transformed = adaptor.transform(new TextContent(text), AdaptorContext.of(ImportInput.paste(ImportInputFormat.JSON, text)));

        ImportedResultDto expected = new ImportedResultDto(1,
                new ImportedResultDto.Source(null, "EXAMPLE", "m-1", null),
                new ImportedResultDto.Match(null, java.time.LocalDate.of(2026, 10, 10), null, null, null, null),
                List.of(new ImportedResultDto.Team("A", "Home Club 1", null, null), new ImportedResultDto.Team("B", "Visitors 1", null, null)),
                new ImportedResultDto.Toss("B", TossDecision.BOWL, null), null,
                List.of(new ImportedResultDto.Innings("A", null, 11, 0, "2.1", null,
                        List.of(new ImportedResultDto.Batting("Abel Nazar", null, DismissalType.NOT_OUT, null, null, 11, 13, 1, 0)),
                        null, null, null, null, null)),
                null, null);
        assertThat(transformed).usingRecursiveComparison().isEqualTo(expected);
    }

    // ---- unreadable input ----

    @Test
    void malformedJsonIsUnreadableWithTheLineAndColumn() {
        String text = "{\n  \"schemaVersion\": 1,\n  \"teams\": [ }\n}";

        assertThatThrownBy(() -> paste(text))
                .isInstanceOf(UnreadableImportInputException.class)
                .hasMessageMatching("The text is not valid JSON \\(line 3, column \\d+\\)\\.");
    }

    @Test
    void emptyAndBlankInputAreUnreadable() {
        assertThatThrownBy(() -> paste("")).isInstanceOf(UnreadableImportInputException.class).hasMessage("The input is empty.");
        assertThatThrownBy(() -> paste("  \n ")).isInstanceOf(UnreadableImportInputException.class).hasMessage("The input is empty.");
    }

    @Test
    void textAfterTheDocumentIsUnreadable() {
        assertThatThrownBy(() -> paste(doc("") + "\n{ \"again\": true }"))
                .isInstanceOf(UnreadableImportInputException.class);
    }

    @Test
    void aRepeatedPropertyIsUnreadableRatherThanSilentlyTakingTheLastOne() {
        assertThatThrownBy(() -> paste("{ \"schemaVersion\": 1, \"schemaVersion\": 2 }"))
                .isInstanceOf(UnreadableImportInputException.class)
                .hasMessageContaining("line 1");
    }

    @Test
    void aDocumentThatIsNotAnObjectIsRefusedWithNotAnObject() {
        assertThat(invalid("[ 1, 2 ]").getErrors()).containsExactly(
                new ImportErrorDto("", "NOT_AN_OBJECT", "The JSON must be one object, as in the example."));
    }

    @Test
    void bytesThatAreNotUtf8AreUnreadableWhenUploaded() {
        byte[] latin1 = "{ \"a\": \"Zoë\" }".getBytes(StandardCharsets.ISO_8859_1);

        assertThatThrownBy(() -> adaptor.importFrom(ImportInput.file(ImportInputFormat.JSON, "a.json", latin1)))
                .isInstanceOf(UnreadableImportInputException.class);
    }

    @Test
    void anUploadedFileWithAByteOrderMarkIsAccepted() {
        byte[] body = doc("").getBytes(StandardCharsets.UTF_8);
        byte[] withBom = new byte[body.length + 3];
        withBom[0] = (byte) 0xEF;
        withBom[1] = (byte) 0xBB;
        withBom[2] = (byte) 0xBF;
        System.arraycopy(body, 0, withBom, 3, body.length);

        ImportedResultDto result = adaptor.importFrom(ImportInput.file(ImportInputFormat.JSON, "m.json", withBom));

        assertThat(result.source().fileName()).isEqualTo("m.json");
    }

    // ---- invalid for the format: path, code and message ----

    static Stream<Arguments> invalidDocuments() {
        return Stream.of(
                Arguments.of("wrong schemaVersion",
                        doc("").replace("\"schemaVersion\": 1", "\"schemaVersion\": 2"),
                        "schemaVersion", "UNSUPPORTED_SCHEMA_VERSION", "Schema version 2 is not supported. The supported version is 1."),
                Arguments.of("schemaVersion missing",
                        doc("").replace("\"schemaVersion\": 1,", ""),
                        "schemaVersion", "REQUIRED", "schemaVersion is required. The supported version is 1."),
                Arguments.of("missing locator",
                        """
                        { "schemaVersion": 1, "teams": [ { "key": "A", "name": "Home Club 1" }, { "key": "B", "name": "Visitors 1" } ] }""",
                        "match", "LOCATOR_MISSING",
                        "The document must say which match it is: a match id, a date, or the provider's match id."),
                Arguments.of("one team",
                        doc("").replace(", { \"key\": \"B\", \"name\": \"Visitors 1\" }", ""),
                        "teams", "INVALID_VALUE", "Exactly two teams are required."),
                Arguments.of("two identical teams",
                        doc("").replace("\"key\": \"B\"", "\"key\": \"A\""),
                        "teams[1].key", "DUPLICATE", "The team key 'A' is used twice."),
                Arguments.of("a team key that does not exist",
                        doc("\"toss\": { \"wonBy\": \"Z\", \"decision\": \"BAT\" }"),
                        "toss.wonBy", "UNKNOWN_TEAM", "'Z' is not one of the team keys in 'teams'."),
                Arguments.of("a bad overs digit for the balls per over",
                        doc("\"innings\": [ { \"battingTeam\": \"A\", \"runs\": 1, \"wickets\": 0, \"overs\": \"20.6\" } ]"),
                        "innings[0].overs", "INVALID_OVERS", "The ball after the point must be 0 to 5 (6 balls to an over)."),
                Arguments.of("a bowler on a run-out",
                        doc(innings(batRow("Abel Nazar", "RUN_OUT", "Cees Meyer", "Jon Smith", "\"runs\": 1, \"balls\": 1"))),
                        "innings[0].batting[0].bowler", "NOT_ALLOWED", "A bowler cannot be named for RUN_OUT."),
                Arguments.of("a negative figure",
                        doc(innings(batRow("Abel Nazar", "NOT_OUT", null, null, "\"runs\": -4, \"balls\": 1"))),
                        "innings[0].batting[0].runs", "INVALID_VALUE", "The number cannot be negative."),
                Arguments.of("an over-long name",
                        doc(innings(batRow("N".repeat(101), "NOT_OUT", null, null, "\"runs\": 1, \"balls\": 1"))),
                        "innings[0].batting[0].player", "TOO_LONG", "A name can be at most 100 characters."),
                Arguments.of("caught with nobody named",
                        doc(innings(batRow("Abel Nazar", "CAUGHT", null, null, "\"runs\": 1, \"balls\": 1"))),
                        "innings[0].batting[0].howOut", "FIELDER_OR_BOWLER_REQUIRED",
                        "Dismissal 'caught' needs a fielder or a bowler to be named, or use CAUGHT_AND_BOWLED."));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidDocuments")
    void invalidDocumentsReportPathCodeAndMessage(String name, String text, String path, String code, String message) {
        ImportInputValidationException ex = invalid(text);

        assertThat(ex.getMessage()).isEqualTo("The JSON does not follow the common import format.");
        assertThat(ex.getErrors()).contains(new ImportErrorDto(path, code, message));
    }

    @Test
    void anUnknownPropertyIsAnErrorNamingThePropertyAndTheKnownOnes() {
        String text = doc(innings(batRow("Abel Nazar", "BOWLED", "Cees Meyer", null, "\"runs\": 1, \"balls\": 1"))
                .replace("\"bowler\"", "\"bowlr\""));

        ImportInputValidationException ex = invalid(text);

        assertThat(ex.getErrors()).singleElement().satisfies(e -> {
            assertThat(e.path()).isEqualTo("innings[0].batting[0].bowlr");
            assertThat(e.code()).isEqualTo("UNKNOWN_PROPERTY");
            assertThat(e.message()).startsWith("'bowlr' is not a known property. Known properties here: ")
                    .contains("bowler", "fielder", "howOut").endsWith("Use an x- prefix for your own notes.");
        });
    }

    @Test
    void howOutGivenAsFreeTextIsRefusedListingTheAllowedValues() {
        String text = doc(innings(batRow("Abel Nazar", "caught by Cees Meyer", null, null, "\"runs\": 1, \"balls\": 1")));

        ImportInputValidationException ex = invalid(text);

        assertThat(ex.getErrors()).singleElement().satisfies(e -> {
            assertThat(e.path()).isEqualTo("innings[0].batting[0].howOut");
            assertThat(e.code()).isEqualTo("INVALID_VALUE");
            assertThat(e.message()).startsWith("'caught by Cees Meyer' is not a valid value here. It must be one of: NOT_OUT, DID_NOT_BAT, BOWLED, CAUGHT");
        });
    }

    @Test
    void aWrongTypedValueIsInvalidValueAtItsPath() {
        String text = doc(innings(batRow("Abel Nazar", "NOT_OUT", null, null, "\"runs\": \"ten\", \"balls\": 1")));

        ImportInputValidationException ex = invalid(text);

        assertThat(ex.getErrors()).singleElement().satisfies(e -> {
            assertThat(e.path()).isEqualTo("innings[0].batting[0].runs");
            assertThat(e.code()).isEqualTo("INVALID_VALUE");
        });
    }

    @Test
    void aFractionalFigureIsNotAcceptedAsAWholeNumber() {
        String text = doc(innings(batRow("Abel Nazar", "NOT_OUT", null, null, "\"runs\": 12.5, \"balls\": 1")));

        assertThat(invalid(text).getErrors()).singleElement()
                .satisfies(e -> assertThat(e.path()).isEqualTo("innings[0].batting[0].runs"));
    }

    @Test
    void aDateInTheWrongFormatIsInvalidValue() {
        ImportInputValidationException ex = invalid(doc("").replace("2026-10-10", "10/10/2026"));

        assertThat(ex.getErrors()).singleElement().satisfies(e -> {
            assertThat(e.path()).isEqualTo("match.date");
            assertThat(e.code()).isEqualTo("INVALID_VALUE");
        });
    }

    // ---- size limits ----

    @Test
    void aDocumentOverThePasteCapIsRefusedWithAnInputTooLargeError() {
        String huge = doc("") + " ".repeat(ResultImportLimits.MAX_PASTE_CHARACTERS);

        ImportInputValidationException ex = invalid(huge);

        assertThat(ex.getErrors()).singleElement().satisfies(e -> {
            assertThat(e.code()).isEqualTo("INPUT_TOO_LARGE");
            assertThat(e.message()).isEqualTo("The pasted text is longer than 1000000 characters.");
        });
    }

    @Test
    void aFileOverTheTextLimitIsRefused() {
        byte[] huge = new byte[(int) ResultImportLimits.TEXT_FILE_MAX_BYTES + 1];
        Arrays.fill(huge, (byte) ' ');

        assertThatThrownBy(() -> adaptor.importFrom(ImportInput.file(ImportInputFormat.JSON, "big.json", huge)))
                .isInstanceOfSatisfying(ImportInputValidationException.class,
                        ex -> assertThat(ex.getErrors()).extracting(ImportErrorDto::code).containsExactly("INPUT_TOO_LARGE"));
    }

    @Test
    void moreThanFiftyErrorsAreTruncatedWithTheTotal() {
        String rows = IntStream.range(0, 60)
                .mapToObj(i -> batRow("Batter " + i, "NOT_OUT", null, null, "\"runs\": -1, \"balls\": 1"))
                .collect(Collectors.joining(", "));

        ImportInputValidationException ex = invalid(doc(innings(rows)));

        // 60 negative figures plus the one TOO_MANY for listing more than 30 batters
        assertThat(ex.getErrors()).hasSize(50);
        assertThat(ex.getTotalErrors()).isEqualTo(61);
    }

    // ---- surrounding code fence ----

    @Test
    void aJsonCodeFenceAroundTheDocumentIsIgnored() {
        assertThat(paste("```json\n" + doc("") + "\n```").teams()).hasSize(2);
    }

    @Test
    void aPlainCodeFenceAndTrailingWhitespaceAreIgnored() {
        assertThat(paste("  ```\n" + doc("") + "\n```  \n\n").teams()).hasSize(2);
    }

    @Test
    void anUnclosedCodeFenceIsIgnoredToo() {
        assertThat(paste("```json\n" + doc("")).teams()).hasSize(2);
    }

    @Test
    void aFenceDoesNotChangeTheLineNumbersOfAParseError() {
        String text = "```json\n{\n  \"schemaVersion\": 1,\n  oops\n}\n```";

        assertThatThrownBy(() -> paste(text))
                .isInstanceOf(UnreadableImportInputException.class)
                .hasMessageContaining("line 4,");
    }

    /**
     * KNOWN BUG (see the test report): the fence is found after the text is stripped, so blank lines before the opening
     * fence are dropped and the line number reported for a parse error is lower than the one the manager sees. The code
     * comment promises "line numbers still match what the manager sees". This asserts the promised behaviour.
     */
    @Test
    void blankLinesBeforeTheFenceDoNotChangeTheLineNumbersOfAParseError() {
        String text = "\n\n```json\n{\n  oops\n}\n```";

        assertThatThrownBy(() -> paste(text))
                .isInstanceOf(UnreadableImportInputException.class)
                .hasMessageContaining("line 5,");
    }

    @Test
    void aFencedValidationErrorStillReportsItsPath() {
        String text = "```json\n" + doc("").replace("\"schemaVersion\": 1", "\"schemaVersion\": 9") + "\n```";

        assertThat(invalid(text).getErrors()).extracting(ImportErrorDto::code).containsExactly("UNSUPPORTED_SCHEMA_VERSION");
    }

    // ---- conversion prompt ----

    @Test
    void theConversionPromptNamesEveryDismissalTypeExceptDidNotBat() {
        String prompt = adaptor.getConversionPrompt();

        for (DismissalType type : DismissalType.values()) {
            if (type == DismissalType.DID_NOT_BAT) {
                assertThat(prompt).doesNotContain("DID_NOT_BAT");
            } else {
                assertThat(prompt).as(type.name()).contains(type.name());
            }
        }
    }

    @Test
    void theConversionPromptListsTheBowlerAndFielderDismissalsFromTheEnum() {
        String prompt = adaptor.getConversionPrompt();

        String bowlers = Arrays.stream(DismissalType.values()).filter(DismissalType::allowsBowler).map(Enum::name)
                .collect(Collectors.joining(", "));
        String fielders = Arrays.stream(DismissalType.values()).filter(DismissalType::allowsFielder).map(Enum::name)
                .collect(Collectors.joining(", "));
        assertThat(prompt).contains("Only these dismissals may name a bowler: " + bowlers + ".");
        assertThat(prompt).contains("Only these dismissals may name a fielder: " + fielders + ".");
    }

    @Test
    void theConversionPromptContainsTheAdaptorExampleAndEveryOutcome() {
        String prompt = adaptor.getConversionPrompt();

        assertThat(prompt).contains(adaptor.getExample().strip());
        for (ResultOutcomeType outcome : ResultOutcomeType.values()) {
            assertThat(prompt).as(outcome.name()).contains(outcome.name());
        }
        assertThat(prompt).contains("schemaVersion", "single code block", "didNotBat");
    }
}
