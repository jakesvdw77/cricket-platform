package com.cricketlegend.service.support;

import static com.cricketlegend.support.ImportedResults.bat;
import static com.cricketlegend.support.ImportedResults.bowl;
import static com.cricketlegend.support.ImportedResults.builder;
import static com.cricketlegend.support.ImportedResults.innings;
import static com.cricketlegend.support.ImportedResults.notOut;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.AwardType;
import com.cricketlegend.domain.CreditSource;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.ImportMatchLevel;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.TossDecision;
import com.cricketlegend.dto.BattingEntryDto;
import com.cricketlegend.dto.BowlingEntryDto;
import com.cricketlegend.dto.ImportExactness;
import com.cricketlegend.dto.ImportNoteDto;
import com.cricketlegend.dto.ImportNoteSeverity;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.dto.ImportedResultDto.Awards;
import com.cricketlegend.dto.ImportedResultDto.Dls;
import com.cricketlegend.dto.ImportedResultDto.Extras;
import com.cricketlegend.dto.ImportedResultDto.Margin;
import com.cricketlegend.dto.ImportedResultDto.PlayerEntry;
import com.cricketlegend.dto.ImportedResultDto.PlayerOfMatch;
import com.cricketlegend.dto.ImportedResultDto.Result;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.service.support.ImportCandidateLoader.OurCandidate;
import com.cricketlegend.service.support.ImportCandidateLoader.SideCandidates;
import com.cricketlegend.service.support.ResultImportProcessor.ProcessedImport;
import com.cricketlegend.support.ImportedResults;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

/**
 * docs/specs/104, "The Result Processor", draft derivation. The processor sees only the common document, the chosen
 * match, the manager's team mapping and the candidates (here a mocked loader); it never touches a repository. Home is
 * ours (Abel Nazar and Cees Meyer registered), away is the opposition unless a test says it is a derby. Invented names.
 */
class ResultImportProcessorTest {

    private static final Map<String, ResultSide> A_HOME = Map.of("A", ResultSide.HOME, "B", ResultSide.AWAY);
    private static final Map<String, ResultSide> A_AWAY = Map.of("A", ResultSide.AWAY, "B", ResultSide.HOME);
    private static final Map<String, ImportExactness> ALL_EXACT = Map.of("A", ImportExactness.EXACT, "B", ImportExactness.EXACT);

    private final UUID club = UUID.randomUUID();
    private final UUID abelId = UUID.randomUUID();
    private final UUID ceesId = UUID.randomUUID();
    private final UUID awayAbelId = UUID.randomUUID();
    private final Match match = Match.builder().id(UUID.randomUUID()).clubId(club).build();
    private final ImportCandidateLoader loader = mock(ImportCandidateLoader.class);
    private final NameAliases aliases = mock(NameAliases.class);
    private final StaticListableBeanFactory beans = new StaticListableBeanFactory();
    private ResultImportProcessor processor;
    private final Map<ResultSide, SideCandidates> candidates = new EnumMap<>(ResultSide.class);

    @BeforeEach
    void setUp() {
        when(aliases.activeFor(any(), any(), anyCollection())).thenReturn(Map.of());
        candidates.put(ResultSide.HOME, new SideCandidates(ResultSide.HOME, UUID.randomUUID(), List.of(
                new OurCandidate(new NameCandidate(abelId, "Abel", "Nazar"), 1),
                new OurCandidate(new NameCandidate(ceesId, "Cees", "Meyer"), 2))));
        when(loader.load(any(), any())).thenReturn(candidates);
        rebuild();
    }

    private void rebuild() {
        processor = new ResultImportProcessor(loader,
                new ImportPlayerResolver(aliases, beans.getBeanProvider(UnresolvedNameSuggester.class)));
    }

    private ProcessedImport process(ImportedResultDto doc) {
        return processor.process(club, match, doc, A_HOME, ALL_EXACT);
    }

    private static ResultPlayerDto player(ProcessedImport out, String clientKey) {
        return out.draft().scorecard().players().stream().filter(p -> clientKey.equals(p.clientKey())).findFirst().orElseThrow();
    }

    private static ResultPlayerDto playerNamed(ProcessedImport out, String displayName) {
        return out.draft().scorecard().players().stream()
                .filter(p -> displayName.equals(p.displayName())).findFirst().orElseThrow();
    }

    private static ImportNoteDto note(ProcessedImport out, String code) {
        return out.notes().stream().filter(n -> n.code().equals(code)).findFirst().orElseThrow();
    }

    private static List<ImportNoteDto> notes(ProcessedImport out, String code) {
        return out.notes().stream().filter(n -> n.code().equals(code)).toList();
    }

    // ---- outcome, winner and toss through the team mapping ----

    @ParameterizedTest(name = "A is {0}: winner {1}, toss {2}")
    @CsvSource({"HOME,HOME,AWAY", "AWAY,AWAY,HOME"})
    void winnerAndTossFollowTheConfirmedMappingIncludingASwap(ResultSide aSide, ResultSide expectedWinner, ResultSide expectedToss) {
        ImportedResultDto doc = builder().toss("B", TossDecision.BAT)
                .result(new Result(ResultOutcomeType.WON, "A", null, new Margin(ResultMarginType.RUNS, 24), null, 40, null, "Close one", null))
                .build();
        Map<String, ResultSide> mapping = aSide == ResultSide.HOME ? A_HOME : A_AWAY;

        ResultDraft draft = processor.process(club, match, doc, mapping, ALL_EXACT).draft();

        assertThat(draft.outcomeType()).isEqualTo(ResultOutcomeType.WON);
        assertThat(draft.winningSide()).isEqualTo(expectedWinner);
        assertThat(draft.tossWonBy()).isEqualTo(expectedToss);
        assertThat(draft.tossDecision()).isEqualTo(TossDecision.BAT);
        assertThat(draft.marginType()).isEqualTo(ResultMarginType.RUNS);
        assertThat(draft.marginValue()).isEqualTo(24);
        assertThat(draft.note()).isEqualTo("Close one");
        assertThat(draft.decidedBy()).isEqualTo(ResultDecidedBy.REGULAR);
    }

    @Test
    void inningsBattingSidesFollowTheMappingToo() {
        ImportedResultDto doc = builder()
                .innings(innings("A", 100, 5, "20.0", null, null, null), innings("B", 90, 10, "19.1", null, null, null)).build();

        List<InningsDto> swapped = processor.process(club, match, doc, A_AWAY, ALL_EXACT).draft().innings();

        assertThat(swapped).extracting(InningsDto::battingSide).containsExactly(ResultSide.AWAY, ResultSide.HOME);
        assertThat(swapped).extracting(InningsDto::sequence).containsExactly(1, 2);
        assertThat(swapped).extracting(InningsDto::kind).containsOnly(InningsKind.REGULAR);
    }

    @ParameterizedTest
    @CsvSource({"TIE", "DRAW", "NO_RESULT", "ABANDONED"})
    void aResultWithNoWinnerHasNoWinnerOrMarginEvenIfTheFileGaveOne(ResultOutcomeType outcome) {
        ImportedResultDto doc = builder().result(new Result(outcome, "A", ResultDecidedBy.DLS,
                new Margin(ResultMarginType.RUNS, 5), null, null, null, null, null)).build();

        ResultDraft draft = process(doc).draft();

        assertThat(draft.outcomeType()).isEqualTo(outcome);
        assertThat(draft.winningSide()).isNull();
        assertThat(draft.marginType()).isNull();
        assertThat(draft.marginValue()).isNull();
        assertThat(draft.decidedBy()).isEqualTo(ResultDecidedBy.REGULAR);
    }

    @Test
    void aForfeitKeepsItsWinnerButNoMargin() {
        ImportedResultDto doc = builder().result(new Result(ResultOutcomeType.FORFEIT, "B", null,
                new Margin(ResultMarginType.RUNS, 5), null, null, null, null, null)).build();

        ResultDraft draft = process(doc).draft();

        assertThat(draft.winningSide()).isEqualTo(ResultSide.AWAY);
        assertThat(draft.marginValue()).isNull();
    }

    @Test
    void aSuperOverWinHasNoMargin() {
        ImportedResultDto doc = builder().result(new Result(ResultOutcomeType.WON, "A", ResultDecidedBy.SUPER_OVER,
                new Margin(ResultMarginType.RUNS, 5), null, null, null, null, null)).build();

        ResultDraft draft = process(doc).draft();

        assertThat(draft.decidedBy()).isEqualTo(ResultDecidedBy.SUPER_OVER);
        assertThat(draft.marginType()).isNull();
    }

    @Test
    void aDocumentWithNoResultOrTossGivesAnOpenDraft() {
        ResultDraft draft = process(builder().build()).draft();

        assertThat(draft.outcomeType()).isNull();
        assertThat(draft.winningSide()).isNull();
        assertThat(draft.tossWonBy()).isNull();
        assertThat(draft.innings()).isEmpty();
        assertThat(draft.scorecard()).isNull();
        assertThat(draft.ballsPerOver()).isEqualTo(6);
    }

    // ---- overs to balls ----

    @ParameterizedTest(name = "{0} balls to an over: 36.4 is {1}, 40 scheduled overs is {2}, 18 revised overs is {3}")
    @CsvSource({"6,220,240,108", "8,292,320,144", "5,184,200,90"})
    void oversBecomeBallsUsingTheMatchsBallsPerOver(int bpo, int balls, int scheduledBalls, int revisedBalls) {
        ImportedResultDto doc = builder()
                .result(new Result(ResultOutcomeType.WON, "A", ResultDecidedBy.DLS, null, new Dls(132, 18), 40, bpo, null, null))
                .innings(innings("A", 150, 8, "36.4", null, null, null)).build();

        ResultDraft draft = process(doc).draft();

        assertThat(draft.ballsPerOver()).isEqualTo(bpo);
        assertThat(draft.innings().get(0).balls()).isEqualTo(balls);
        assertThat(draft.scheduledBalls()).isEqualTo(scheduledBalls);
        assertThat(draft.dlsRevisedBalls()).isEqualTo(revisedBalls);
        assertThat(draft.dlsTarget()).isEqualTo(132);
    }

    @Test
    void bowlingOversBecomeBallsWithTheSameBallsPerOver() {
        ImportedResultDto doc = builder()
                .result(new Result(ResultOutcomeType.WON, "A", null, null, null, null, 8, null, null))
                .innings(innings("A", 150, 8, "20.0", List.of(notOut("Abel Nazar", 5, 5)), null,
                        List.of(bowl("Rob Brown", "4.7", 0, 30, 1)))).build();

        ProcessedImport out = process(doc);

        assertThat(out.draft().scorecard().bowling()).singleElement().extracting(BowlingEntryDto::balls).isEqualTo(39);
    }

    // ---- extras ----

    @Test
    void theExtrasBreakdownIsCarriedAndSummedIntoTheInningsTotal() {
        Extras extras = new Extras(6, 1, 2, 3, 0);
        ImportedResultDto doc = builder().innings(ImportedResults.withExtras(innings("A", 100, 5, "20.0", null, null, null), extras)).build();

        InningsDto innings = process(doc).draft().innings().get(0);

        assertThat(innings.wides()).isEqualTo(6);
        assertThat(innings.noBalls()).isEqualTo(1);
        assertThat(innings.byes()).isEqualTo(2);
        assertThat(innings.legByes()).isEqualTo(3);
        assertThat(innings.penaltyRuns()).isEqualTo(0);
        assertThat(innings.extras()).isEqualTo(12);
    }

    @Test
    void anInningsWithNoExtrasHasNoBreakdown() {
        InningsDto innings = process(builder().innings(innings("A", 100, 5, "20.0", null, null, null)).build()).draft().innings().get(0);

        assertThat(innings.hasExtrasBreakdown()).isFalse();
        assertThat(innings.extras()).isNull();
        assertThat(innings.runs()).isEqualTo(100);
        assertThat(innings.wickets()).isEqualTo(5);
    }

    // ---- batting order, did-not-bat, dismissals, bowling ----

    @Test
    void battingPositionsAreTheFileOrderWhenTheFileGivesNoneOrBadOnes() {
        ImportedResultDto doc = builder().innings(innings("A", 50, 2, "10.0", List.of(
                notOut("Abel Nazar", 10, 10), notOut("Cees Meyer", 5, 5), notOut("Pat Jones", 1, 1)), null, null)).build();

        assertThat(process(doc).draft().scorecard().batting()).extracting(BattingEntryDto::position).containsExactly(1, 2, 3);
    }

    @Test
    void positionsTheFileGaveArekeptWhenTheyAreCompleteAndDistinct() {
        ImportedResultDto.Batting first = new ImportedResultDto.Batting("Abel Nazar", 2, DismissalType.NOT_OUT, null, null, 10, 10, null, null);
        ImportedResultDto.Batting second = new ImportedResultDto.Batting("Cees Meyer", 1, DismissalType.NOT_OUT, null, null, 5, 5, null, null);
        ImportedResultDto doc = builder().innings(innings("A", 50, 2, "10.0", List.of(first, second), null, null)).build();

        assertThat(process(doc).draft().scorecard().batting()).extracting(BattingEntryDto::position).containsExactly(2, 1);
    }

    @Test
    void duplicatePositionsFallBackToTheFileOrder() {
        ImportedResultDto.Batting first = new ImportedResultDto.Batting("Abel Nazar", 1, DismissalType.NOT_OUT, null, null, 10, 10, null, null);
        ImportedResultDto.Batting second = new ImportedResultDto.Batting("Cees Meyer", 1, DismissalType.NOT_OUT, null, null, 5, 5, null, null);
        ImportedResultDto doc = builder().innings(innings("A", 50, 2, "10.0", List.of(first, second), null, null)).build();

        assertThat(process(doc).draft().scorecard().batting()).extracting(BattingEntryDto::position).containsExactly(1, 2);
    }

    @Test
    void didNotBatNamesBecomeDidNotBatRowsAfterTheBatters() {
        ImportedResultDto doc = builder().innings(innings("A", 50, 2, "10.0",
                List.of(notOut("Abel Nazar", 10, 10)), List.of("Cees Meyer", "Pat Jones"), null)).build();

        List<BattingEntryDto> rows = process(doc).draft().scorecard().batting();

        assertThat(rows).hasSize(3);
        assertThat(rows.get(0).howOut()).isEqualTo(DismissalType.NOT_OUT);
        assertThat(rows.subList(1, 3)).allSatisfy(row -> {
            assertThat(row.howOut()).isEqualTo(DismissalType.DID_NOT_BAT);
            assertThat(row.position()).isNull();
            assertThat(row.runs()).isNull();
            assertThat(row.balls()).isNull();
            assertThat(row.battingSide()).isEqualTo(ResultSide.HOME);
        });
    }

    @Test
    void aPlayerBothBattingAndListedAsDidNotBatIsRowedOnce() {
        ImportedResultDto doc = builder().innings(innings("A", 50, 2, "10.0",
                List.of(notOut("Abel Nazar", 10, 10)), List.of("Abel Nazar"), null)).build();

        assertThat(process(doc).draft().scorecard().batting()).hasSize(1);
    }

    @Test
    void aDuplicateBattingRowIsSkippedWithANote() {
        ImportedResultDto doc = builder().innings(innings("A", 50, 2, "10.0",
                List.of(notOut("Abel Nazar", 10, 10), notOut("Abel Nazar", 12, 12)), null, null)).build();

        ProcessedImport out = process(doc);

        assertThat(out.draft().scorecard().batting()).hasSize(1);
        assertThat(note(out, "DUPLICATE_ROW_SKIPPED").severity()).isEqualTo(ImportNoteSeverity.WARNING);
        assertThat(note(out, "DUPLICATE_ROW_SKIPPED").section()).isEqualTo("innings[0]");
    }

    @Test
    void dismissalBowlerAndFielderAreTheFieldingSidesRowsAndTheFiguresAreCarried() {
        ImportedResultDto doc = builder().innings(innings("A", 120, 3, "20.0", List.of(
                bat("Abel Nazar", DismissalType.CAUGHT, "Rob Brown", "Tim Hill", 42, 51),
                bat("Cees Meyer", DismissalType.BOWLED, "Rob Brown", null, 7, 9),
                bat("Pat Jones", DismissalType.RUN_OUT, null, "Tim Hill", 3, 4)), null,
                List.of(bowl("Rob Brown", "4.0", 1, 20, 2)))).build();

        ProcessedImport out = process(doc);

        List<BattingEntryDto> rows = out.draft().scorecard().batting();
        BattingEntryDto caught = rows.get(0);
        ResultPlayerDto brown = playerNamed(out, "Rob Brown");
        ResultPlayerDto hill = playerNamed(out, "Tim Hill");
        assertThat(brown.side()).isEqualTo(ResultSide.AWAY);
        assertThat(brown.opposition()).isTrue();
        assertThat(caught.bowlerPlayerId()).isEqualTo(brown.clientKey());
        assertThat(caught.fielderPlayerId()).isEqualTo(hill.clientKey());
        assertThat(rows.get(1).bowlerPlayerId()).isEqualTo(brown.clientKey());
        assertThat(rows.get(1).fielderPlayerId()).isNull();
        assertThat(rows.get(2).bowlerPlayerId()).isNull();
        assertThat(rows.get(2).fielderPlayerId()).isEqualTo(hill.clientKey());
        assertThat(caught.runs()).isEqualTo(42);
        assertThat(caught.balls()).isEqualTo(51);
        // the batter is on the batting side, never on the fielding side
        assertThat(player(out, caught.playerClientKey()).side()).isEqualTo(ResultSide.HOME);
        // the bowler's row names the same person as the dismissals
        assertThat(out.draft().scorecard().bowling()).singleElement().satisfies(b -> {
            assertThat(b.playerClientKey()).isEqualTo(brown.clientKey());
            assertThat(b.battingSide()).isEqualTo(ResultSide.HOME);
        });
    }

    @Test
    void aDismissalNamedInTheOppositionsInningsResolvesAgainstOurCandidates() {
        ImportedResultDto doc = builder().innings(innings("B", 90, 4, "20.0", List.of(
                bat("Rob Brown", DismissalType.CAUGHT, "Nazar A", "Meyer C", 10, 10)), null,
                List.of(bowl("Nazar A", "4.0", 0, 11, 1)))).build();

        ProcessedImport out = process(doc);

        BattingEntryDto row = out.draft().scorecard().batting().get(0);
        ResultPlayerDto bowler = player(out, row.bowlerPlayerId());
        ResultPlayerDto fielder = player(out, row.fielderPlayerId());
        assertThat(bowler.playerProfileId()).isEqualTo(abelId);
        assertThat(bowler.side()).isEqualTo(ResultSide.HOME);
        assertThat(fielder.playerProfileId()).isEqualTo(ceesId);
        assertThat(row.battingSide()).isEqualTo(ResultSide.AWAY);
    }

    @Test
    void noFieldingRowsAndNoStandoutFieldsAreProduced() {
        ProcessedImport out = process(ImportedResults.fullScorecard());

        assertThat(out.draft().scorecard().fielding()).isEmpty();
        assertThat(out.draft().scorecard().batting()).allSatisfy(row -> {
            assertThat(row.featuredOverride()).isNull();
            assertThat(row.suggested()).isNull();
            assertThat(row.featured()).isNull();
        });
        assertThat(out.draft().scorecard().bowling()).allSatisfy(row -> {
            assertThat(row.featuredOverride()).isNull();
            assertThat(row.featured()).isNull();
        });
    }

    @Test
    void bowlingRowsAreManualInFileOrderWithTheirFigures() {
        ImportedResultDto doc = builder().innings(innings("A", 120, 3, "20.0", List.of(notOut("Abel Nazar", 1, 1)), null,
                List.of(bowl("Rob Brown", "4.0", 1, 20, 2), bowl("Tim Hill", "3.2", 0, 25, 0)))).build();

        List<BowlingEntryDto> rows = process(doc).draft().scorecard().bowling();

        assertThat(rows).extracting(BowlingEntryDto::wicketsSource).containsOnly(CreditSource.MANUAL);
        assertThat(rows).extracting(BowlingEntryDto::bowlingOrder).containsExactly(1, 2);
        assertThat(rows).extracting(BowlingEntryDto::balls).containsExactly(24, 20);
        assertThat(rows.get(0).maidens()).isEqualTo(1);
        assertThat(rows.get(0).runs()).isEqualTo(20);
        assertThat(rows.get(0).wickets()).isEqualTo(2);
    }

    @Test
    void aDuplicateBowlingRowIsSkippedWithANote() {
        ImportedResultDto doc = builder().innings(innings("A", 120, 3, "20.0", null, null,
                List.of(bowl("Rob Brown", "4.0", 1, 20, 2), bowl("Rob Brown", "2.0", 0, 9, 0)))).build();

        ProcessedImport out = process(doc);

        assertThat(out.draft().scorecard().bowling()).hasSize(1);
        assertThat(note(out, "DUPLICATE_ROW_SKIPPED").message()).contains("bowling row");
    }

    // ---- one person across batting, bowling, dismissal and award ----

    @Test
    void thePlayerWhoBatsBowlsIsNamedInADismissalAndWinsTheAwardIsOneRow() {
        ImportedResultDto doc = builder()
                .innings(
                        innings("A", 120, 3, "20.0", List.of(bat("Abel Nazar", DismissalType.BOWLED, "Rob Brown", null, 30, 30)), null,
                                List.of(bowl("Rob Brown", "4.0", 0, 20, 1))),
                        innings("B", 90, 4, "20.0", List.of(bat("Rob Brown", DismissalType.CAUGHT, "Abel Nazar", "Abel Nazar", 5, 5)), null,
                                List.of(bowl("Abel Nazar", "4.0", 0, 10, 1))))
                .awards(new Awards(new PlayerOfMatch("Abel Nazar", "A"), null)).build();

        ProcessedImport out = process(doc);

        List<ResultPlayerDto> abels = out.draft().scorecard().players().stream().filter(p -> abelId.equals(p.playerProfileId())).toList();
        assertThat(abels).hasSize(1);
        String key = abels.get(0).clientKey();
        assertThat(out.draft().scorecard().batting().get(0).playerClientKey()).isEqualTo(key);
        assertThat(out.draft().scorecard().batting().get(1).fielderPlayerId()).isEqualTo(key);
        assertThat(out.draft().scorecard().bowling().stream().map(BowlingEntryDto::playerClientKey)).contains(key);
        assertThat(out.draft().scorecard().awards()).singleElement().satisfies(a -> {
            assertThat(a.awardType()).isEqualTo(AwardType.PLAYER_OF_MATCH);
            assertThat(a.playerClientKey()).isEqualTo(key);
            assertThat(a.side()).isEqualTo(ResultSide.HOME);
        });
        assertThat(out.draft().scorecard().players().stream().filter(p -> "Rob Brown".equals(p.displayName()))).hasSize(1);
    }

    @Test
    void aPlayerOfTheMatchWithNoTeamIsFoundOnTheOneSideThatNamesThem() {
        ImportedResultDto doc = builder()
                .innings(innings("B", 90, 4, "20.0", List.of(notOut("Rob Brown", 5, 5)), null, null))
                .awards(new Awards(new PlayerOfMatch("Rob Brown", null), null)).build();

        ProcessedImport out = process(doc);

        assertThat(out.draft().scorecard().awards()).singleElement().satisfies(a -> assertThat(a.side()).isEqualTo(ResultSide.AWAY));
    }

    @Test
    void aPlayerOfTheMatchWhoIsNamedNowhereElseIsNotPlacedAndSaysSo() {
        ImportedResultDto doc = builder().awards(new Awards(new PlayerOfMatch("Zane Quirk", null), null)).build();

        ProcessedImport out = process(doc);

        assertThat(out.draft().scorecard()).isNull();
        assertThat(note(out, "AWARD_NOT_PLACED").severity()).isEqualTo(ImportNoteSeverity.WARNING);
    }

    @Test
    void theTeamSheetAddsPlayersAndMarksASubstituteWhoDidNotBat() {
        ImportedResultDto doc = builder()
                .innings(innings("A", 50, 2, "10.0", List.of(notOut("Abel Nazar", 10, 10)), null, null))
                .players(new PlayerEntry("A", "Abel Nazar", null), new PlayerEntry("A", "Cees Meyer", true),
                        new PlayerEntry("A", "Pat Jones", null), new PlayerEntry("B", "Rob Brown", true)).build();

        ProcessedImport out = process(doc);

        assertThat(out.draft().scorecard().players()).extracting(ResultPlayerDto::displayName)
                .contains("Abel Nazar", "Cees Meyer", "Pat Jones", "Rob Brown");
        assertThat(playerNamed(out, "Cees Meyer").substitute()).isTrue();
        assertThat(playerNamed(out, "Pat Jones").substitute()).isFalse();
        assertThat(playerNamed(out, "Abel Nazar").substitute()).isFalse();
    }

    @Test
    void aListedSubstituteWhoBattedIsNotMarkedASubstitute() {
        ImportedResultDto doc = builder()
                .innings(innings("A", 50, 2, "10.0", List.of(notOut("Cees Meyer", 10, 10)), null, null))
                .players(new PlayerEntry("A", "Cees Meyer", true)).build();

        assertThat(playerNamed(process(doc), "Cees Meyer").substitute()).isFalse();
    }

    @Test
    void everyPlayerCarriesItsSideAndOppositionFlag() {
        ProcessedImport out = process(ImportedResults.fullScorecard());

        assertThat(out.draft().scorecard().players()).allSatisfy(p -> {
            assertThat(p.opposition()).isEqualTo(p.side() == ResultSide.AWAY);
            assertThat(p.id()).isNull();
            assertThat(p.clientKey()).isNotBlank();
        });
        assertThat(out.draft().scorecard().players().stream().map(ResultPlayerDto::clientKey)).doesNotHaveDuplicates();
    }

    // ---- name handling carried onto the rows ----

    @Test
    void aRuleBasedLinkIsFlaggedOnItsRowAndAnExactOneIsNot() {
        ImportedResultDto doc = builder().innings(innings("A", 50, 2, "10.0",
                List.of(notOut("Nazar A", 10, 10), notOut("Cees Meyer", 5, 5)), null, null)).build();

        ProcessedImport out = process(doc);

        assertThat(playerNamed(out, "Cees Meyer").importMatch()).isNull();
        ResultPlayerDto guess = out.draft().scorecard().players().stream().filter(p -> abelId.equals(p.playerProfileId())).findFirst().orElseThrow();
        assertThat(guess.importMatch()).isEqualTo(ImportMatchLevel.NORMALISED);
        assertThat(guess.displayName()).isEqualTo("Nazar A");
        assertThat(out.counts().exact()).isEqualTo(1);
        assertThat(out.counts().normalised()).isEqualTo(1);
        assertThat(out.counts().aiSuggested()).isZero();
        assertThat(out.counts().unresolved()).isZero();
    }

    @Test
    void anUnresolvedNameIsAGuestWithNoLinkAndIsCounted() {
        ImportedResultDto doc = builder().innings(innings("A", 50, 2, "10.0", List.of(notOut("Zane Quirk", 10, 10)), null, null)).build();

        ProcessedImport out = process(doc);

        ResultPlayerDto guest = playerNamed(out, "Zane Quirk");
        assertThat(guest.playerProfileId()).isNull();
        assertThat(guest.opposition()).isFalse();
        assertThat(guest.importMatch()).isNull();
        assertThat(out.counts().unresolved()).isEqualTo(1);
    }

    @Test
    void withNoCandidatesForOurSideTheProcessorSaysEveryNameIsAGuest() {
        candidates.put(ResultSide.HOME, new SideCandidates(ResultSide.HOME, UUID.randomUUID(), List.of()));
        ImportedResultDto doc = builder().innings(innings("A", 50, 2, "10.0", List.of(notOut("Abel Nazar", 10, 10)), null, null)).build();

        ProcessedImport out = process(doc);

        assertThat(note(out, "NO_CANDIDATES").severity()).isEqualTo(ImportNoteSeverity.INFO);
        assertThat(playerNamed(out, "Abel Nazar").playerProfileId()).isNull();
    }

    @Test
    void aDerbyResolvesEachSideAgainstItsOwnSelection() {
        candidates.put(ResultSide.AWAY, new SideCandidates(ResultSide.AWAY, UUID.randomUUID(), List.of(
                new OurCandidate(new NameCandidate(awayAbelId, "Abel", "Nazar"), 1))));
        ImportedResultDto doc = builder().innings(
                innings("A", 50, 2, "10.0", List.of(notOut("Abel Nazar", 10, 10)), null, List.of(bowl("Cees Meyer", "2.0", 0, 5, 0))),
                innings("B", 40, 2, "10.0", List.of(notOut("Abel Nazar", 8, 8)), null, List.of(bowl("Abel Nazar", "2.0", 0, 5, 0)))).build();

        ProcessedImport out = process(doc);

        List<ResultPlayerDto> abels = out.draft().scorecard().players().stream().filter(p -> "Abel Nazar".equals(p.displayName())).toList();
        assertThat(abels).extracting(ResultPlayerDto::side).containsExactlyInAnyOrder(ResultSide.HOME, ResultSide.AWAY);
        assertThat(abels).extracting(ResultPlayerDto::playerProfileId).containsExactlyInAnyOrder(abelId, awayAbelId);
        assertThat(out.draft().scorecard().players()).noneMatch(ResultPlayerDto::opposition);
        // Cees Meyer bowled for the away side and is not on its selection: a guest, not matched to the home player
        assertThat(playerNamed(out, "Cees Meyer").playerProfileId()).isNull();
        assertThat(playerNamed(out, "Cees Meyer").side()).isEqualTo(ResultSide.AWAY);
    }

    // ---- super overs and forfeits ----

    @Test
    void aSuperOverKeepsItsTotalsAndDropsItsRowsWithANote() {
        ImportedResultDto doc = builder().innings(
                innings("A", 100, 5, "20.0", List.of(notOut("Abel Nazar", 10, 10)), null, null),
                innings("B", 100, 7, "20.0", List.of(notOut("Rob Brown", 10, 10)), null, null),
                ImportedResults.withKind(innings("A", 9, 1, "1.0",
                        List.of(notOut("Cees Meyer", 9, 6)), null, List.of(bowl("Tim Hill", "1.0", 0, 9, 1))), InningsKind.SUPER_OVER)).build();

        ProcessedImport out = process(doc);

        assertThat(out.draft().innings()).hasSize(3);
        assertThat(out.draft().innings().get(2).kind()).isEqualTo(InningsKind.SUPER_OVER);
        assertThat(out.draft().innings().get(2).runs()).isEqualTo(9);
        assertThat(out.draft().innings().get(2).wickets()).isEqualTo(1);
        assertThat(out.draft().innings().get(2).battingSide()).isEqualTo(ResultSide.HOME);
        assertThat(out.draft().scorecard().batting()).hasSize(2);
        assertThat(out.draft().scorecard().bowling()).isEmpty();
        assertThat(out.draft().scorecard().players()).extracting(ResultPlayerDto::displayName)
                .doesNotContain("Cees Meyer", "Tim Hill");
        ImportNoteDto note = note(out, "SUPER_OVER_ROWS_DROPPED");
        assertThat(note.severity()).isEqualTo(ImportNoteSeverity.WARNING);
        assertThat(note.section()).isEqualTo("innings[2]");
    }

    @Test
    void aSuperOverWithNoRowsNeedsNoNote() {
        ImportedResultDto doc = builder().innings(
                innings("A", 100, 5, "20.0", null, null, null),
                ImportedResults.withKind(innings("B", 9, 1, "1.0", null, null, null), InningsKind.SUPER_OVER)).build();

        ProcessedImport out = process(doc);

        assertThat(out.draft().innings()).hasSize(2);
        assertThat(out.notes()).noneMatch(n -> n.code().equals("SUPER_OVER_ROWS_DROPPED"));
    }

    @Test
    void aForfeitWithEmptyInningsDropsThem() {
        ImportedResultDto doc = builder()
                .result(new Result(ResultOutcomeType.FORFEIT, "A", null, null, null, null, null, null, null))
                .innings(innings("A", 0, 0, "0.0", null, null, null), innings("B", 0, 0, "0.0", null, null, null)).build();

        ProcessedImport out = process(doc);

        assertThat(out.draft().innings()).isEmpty();
        assertThat(out.draft().scorecard()).isNull();
        assertThat(out.draft().winningSide()).isEqualTo(ResultSide.HOME);
    }

    @Test
    void aForfeitInningsWithRealRowsIsKept() {
        ImportedResultDto doc = builder()
                .result(new Result(ResultOutcomeType.FORFEIT, "A", null, null, null, null, null, null, null))
                .innings(innings("A", 0, 0, "0.0", List.of(notOut("Abel Nazar", 0, 0)), null, null)).build();

        assertThat(process(doc).draft().innings()).hasSize(1);
    }

    @Test
    void anEmptyInningsInANormalMatchIsKept() {
        ImportedResultDto doc = builder().innings(innings("A", 0, 0, "0.0", null, null, null)).build();

        assertThat(process(doc).draft().innings()).hasSize(1);
    }

    // ---- not-out with no balls ----

    @Test
    void oneNotOutWithNoBallsGivesOneSingularNotePerInnings() {
        ImportedResultDto doc = builder().innings(innings("A", 50, 2, "10.0",
                List.of(notOut("Abel Nazar", 0, 0), notOut("Cees Meyer", 12, 9)), null, null)).build();

        ProcessedImport out = process(doc);

        assertThat(notes(out, "NOT_OUT_NO_BALLS")).singleElement().satisfies(n -> {
            assertThat(n.message()).isEqualTo("1 batter is not out with 0 balls faced. If they did not bat, set them to Did not bat.");
            assertThat(n.severity()).isEqualTo(ImportNoteSeverity.WARNING);
            assertThat(n.section()).isEqualTo("innings[0]");
        });
    }

    @Test
    void severalNotOutsWithNoBallsGiveOnePluralNoteAndNeverNameAnyone() {
        ImportedResultDto doc = builder().innings(innings("A", 50, 2, "10.0",
                List.of(notOut("Abel Nazar", 0, 0), notOut("Cees Meyer", null, null), notOut("Pat Jones", 0, null)), null, null)).build();

        ImportNoteDto note = note(process(doc), "NOT_OUT_NO_BALLS");

        assertThat(note.message()).startsWith("3 batters are not out with 0 balls faced.");
        assertThat(note.message()).doesNotContain("Abel", "Cees", "Pat");
    }

    @Test
    void eachInningsGetsItsOwnNote() {
        ImportedResultDto doc = builder().innings(
                innings("A", 50, 2, "10.0", List.of(notOut("Abel Nazar", 0, 0)), null, null),
                innings("B", 50, 2, "10.0", List.of(notOut("Rob Brown", 0, 0)), null, null)).build();

        assertThat(notes(process(doc), "NOT_OUT_NO_BALLS")).extracting(ImportNoteDto::section)
                .containsExactly("innings[0]", "innings[1]");
    }

    @Test
    void noNoteWhenBallsWereFacedOrForARetiredNotOutOrADismissed() {
        ImportedResultDto doc = builder().innings(innings("A", 50, 2, "10.0", List.of(
                notOut("Abel Nazar", 0, 3),
                bat("Cees Meyer", DismissalType.RETIRED_NOT_OUT, null, null, 0, 0),
                bat("Pat Jones", DismissalType.BOWLED, "Rob Brown", null, 0, 0)), null, null)).build();

        assertThat(notes(process(doc), "NOT_OUT_NO_BALLS")).isEmpty();
    }

    @Test
    void theNotOutRowIsStillImportedAsTheFileSaysIt() {
        ImportedResultDto doc = builder().innings(innings("A", 50, 2, "10.0", List.of(notOut("Abel Nazar", 0, 0)), null, null)).build();

        assertThat(process(doc).draft().scorecard().batting()).singleElement().satisfies(row -> {
            assertThat(row.howOut()).isEqualTo(DismissalType.NOT_OUT);
            assertThat(row.runs()).isEqualTo(0);
        });
    }

    // ---- fall of wickets ----

    @Test
    void fallOfWicketsAndOverByOverAreIgnoredWithAnInfoNote() {
        ImportedResultDto.Innings given = innings("A", 10, 1, "2.0", null, null, null);
        ImportedResultDto.Innings withFall = new ImportedResultDto.Innings(given.battingTeam(), null, 10, 1, "2.0", null, null, null, null,
                new com.fasterxml.jackson.databind.ObjectMapper().createArrayNode().add(1), null, null);

        ProcessedImport out = process(builder().innings(withFall).build());

        assertThat(note(out, "IGNORED_FALL_OF_WICKETS").severity()).isEqualTo(ImportNoteSeverity.INFO);
    }

    // ---- exactness ----

    @Test
    void anInningsExactnessIsTheWorstOfItsTeamAndItsPeople() {
        ImportedResultDto doc = builder().innings(
                innings("A", 50, 2, "10.0", List.of(notOut("Abel Nazar", 10, 10)), null, null),
                innings("B", 50, 2, "10.0", List.of(notOut("Rob Brown", 10, 10)), null, null)).build();

        ProcessedImport exactEverywhere = process(doc);
        ProcessedImport teamGuessed = processor.process(club, match, doc, A_HOME,
                Map.of("A", ImportExactness.NORMALISED, "B", ImportExactness.EXACT));

        assertThat(exactEverywhere.exactness()).containsEntry("innings[0]", ImportExactness.EXACT)
                .containsEntry("innings[1]", ImportExactness.EXACT).containsEntry("players", ImportExactness.EXACT);
        assertThat(teamGuessed.exactness()).containsEntry("innings[0]", ImportExactness.NORMALISED)
                .containsEntry("innings[1]", ImportExactness.EXACT)
                .containsEntry("teams", ImportExactness.NORMALISED);
    }

    @Test
    void aGuessedPlayerLowersTheInningsAndPlayersSectionsAndAGuestLowersThemFurther() {
        ImportedResultDto guessed = builder().innings(innings("A", 50, 2, "10.0", List.of(notOut("Nazar A", 10, 10)), null, null)).build();
        ImportedResultDto guest = builder().innings(innings("A", 50, 2, "10.0",
                List.of(notOut("Nazar A", 10, 10), notOut("Zane Quirk", 1, 1)), null, null)).build();

        assertThat(process(guessed).exactness()).containsEntry("innings[0]", ImportExactness.NORMALISED)
                .containsEntry("players", ImportExactness.NORMALISED);
        assertThat(process(guest).exactness()).containsEntry("innings[0]", ImportExactness.UNRESOLVED)
                .containsEntry("players", ImportExactness.UNRESOLVED);
    }

    @Test
    void exactnessIsNeverRaisedByExactNamesWhenTheTeamWasUnresolved() {
        ImportedResultDto doc = builder().toss("A", TossDecision.BAT).result(ImportedResults.won("B", null))
                .innings(innings("A", 50, 2, "10.0", List.of(notOut("Abel Nazar", 10, 10)), null, null)).build();

        ProcessedImport out = processor.process(club, match, doc, A_HOME,
                Map.of("A", ImportExactness.UNRESOLVED, "B", ImportExactness.NORMALISED));

        assertThat(out.exactness()).containsEntry("innings[0]", ImportExactness.UNRESOLVED)
                .containsEntry("teams", ImportExactness.UNRESOLVED)
                .containsEntry("toss", ImportExactness.UNRESOLVED)
                .containsEntry("result", ImportExactness.NORMALISED);
    }

    @Test
    void worstOrdersExactThenNormalisedThenAiThenUnresolved() {
        assertThat(ResultImportProcessor.worst(ImportExactness.EXACT, ImportExactness.NORMALISED)).isEqualTo(ImportExactness.NORMALISED);
        assertThat(ResultImportProcessor.worst(ImportExactness.UNRESOLVED, ImportExactness.EXACT)).isEqualTo(ImportExactness.UNRESOLVED);
        assertThat(ResultImportProcessor.worst(ImportExactness.AI_SUGGESTED, ImportExactness.NORMALISED)).isEqualTo(ImportExactness.AI_SUGGESTED);
        assertThat(ResultImportProcessor.worst(null, ImportExactness.EXACT)).isEqualTo(ImportExactness.EXACT);
        assertThat(ResultImportProcessor.worst(ImportExactness.NORMALISED, null)).isEqualTo(ImportExactness.NORMALISED);
    }

    // ---- the extension seam ----

    @Test
    void withNoSuggesterBeanNothingIsAiSuggested() {
        ImportedResultDto doc = builder().innings(innings("A", 50, 2, "10.0",
                List.of(notOut("Zane Quirk", 1, 1), notOut("Nazar A", 2, 2)), null, null)).build();

        ProcessedImport out = process(doc);

        assertThat(out.counts().aiSuggested()).isZero();
        assertThat(out.exactness().values()).doesNotContain(ImportExactness.AI_SUGGESTED);
        assertThat(out.draft().scorecard().players()).noneMatch(p -> p.importMatch() == ImportMatchLevel.AI_SUGGESTED);
    }

    @Test
    void aTestOnlySuggestersAnswerIsProvisionalFlaggedAndNeverTreatedAsExact() {
        NameCandidate meyer = candidates.get(ResultSide.HOME).names().get(1);
        beans.addBean("fakeSuggester", (UnresolvedNameSuggester) (unresolved, pool) ->
                Map.of("Zane Quirk", new UnresolvedNameSuggester.Suggestion(meyer, 0.9)));
        rebuild();
        ImportedResultDto doc = builder().innings(innings("A", 50, 2, "10.0", List.of(notOut("Zane Quirk", 1, 1)), null, null)).build();

        ProcessedImport out = process(doc);

        ResultPlayerDto linked = out.draft().scorecard().players().stream().filter(p -> ceesId.equals(p.playerProfileId())).findFirst().orElseThrow();
        assertThat(linked.importMatch()).isEqualTo(ImportMatchLevel.AI_SUGGESTED);
        assertThat(linked.displayName()).isEqualTo("Zane Quirk");
        assertThat(out.counts().aiSuggested()).isEqualTo(1);
        assertThat(out.exactness()).containsEntry("innings[0]", ImportExactness.AI_SUGGESTED).containsEntry("players", ImportExactness.AI_SUGGESTED);
        assertThat(note(out, "NAME_SUGGESTED").severity()).isEqualTo(ImportNoteSeverity.WARNING);
    }
}
