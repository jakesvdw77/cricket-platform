package com.cricketlegend.service.support;

import static com.cricketlegend.support.ScorecardDtos.bat;
import static com.cricketlegend.support.ScorecardDtos.by;
import static com.cricketlegend.support.ScorecardDtos.boundaries;
import static com.cricketlegend.support.ScorecardDtos.derived;
import static com.cricketlegend.support.ScorecardDtos.extrasAndDots;
import static com.cricketlegend.support.ScorecardDtos.field;
import static com.cricketlegend.support.ScorecardDtos.figures;
import static com.cricketlegend.support.ScorecardDtos.guest;
import static com.cricketlegend.support.ScorecardDtos.opposition;
import static com.cricketlegend.support.ScorecardDtos.registered;
import static com.cricketlegend.support.ScorecardDtos.substitute;
import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.AwardType;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.ResultIssueSeverity;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultWizardStep;
import com.cricketlegend.domain.ScorecardSelectionState;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.MatchAwardDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultIssueDto;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ResultValidationDto;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.service.support.ResultValidator.ErrorCode;
import com.cricketlegend.service.support.ResultValidator.WarningCode;
import com.cricketlegend.support.ScorecardCard;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * docs/specs/101-match-results-our-side-scorecard.md Test Plan, backend unit: the scorecard matrix of {@link
 * ResultValidator#validate}, one case per code (and its {@code code}, {@code step}, {@code side} and severity),
 * run for ours and for the opposition's entries, the "cannot check" skips, the rules that do not apply to the
 * opposition, the complete-attribution skip, extras, wicket classification and the one INFO line. Pure logic, no Spring.
 */
class ResultValidatorScorecardPublishRulesTest {

    private static final String HOME = "Riverside";
    private static final String AWAY = "Hillside";
    private static final ResultSide H = ResultSide.HOME;
    private static final ResultSide A = ResultSide.AWAY;

    private final ResultValidator validator = new ResultValidator();

    private ResultValidationDto validate(ScorecardCard card) {
        return validator.validate(card.draft(), HOME, AWAY, card.context);
    }

    private static List<ResultIssueDto> withCode(ResultValidationDto dto, Enum<?> code) {
        return dto.issues().stream().filter(i -> i.code().equals(code.name())).toList();
    }

    private static void assertIssue(
            ResultValidationDto dto, Enum<?> code, ResultWizardStep step, ResultSide side, ResultIssueSeverity severity) {
        assertThat(withCode(dto, code)).as(code.name()).isNotEmpty().allSatisfy(issue -> {
            assertThat(issue.step()).isEqualTo(step);
            assertThat(issue.side()).isEqualTo(side);
            assertThat(issue.severity()).isEqualTo(severity);
            assertThat(issue.message()).isNotBlank();
        });
    }

    private static void assertNoIssue(ResultValidationDto dto, Enum<?> code) {
        assertThat(withCode(dto, code)).as(code.name()).isEmpty();
    }

    // ---- a clean card ----

    @Test
    void aCleanCardRaisesNothingWhoeverBatsAndBowls() {
        for (Supplier<ScorecardCard> card : List.<Supplier<ScorecardCard>>of(
                ScorecardCard::oursBat, ScorecardCard::oppositionBats, ScorecardCard::derby)) {
            ResultValidationDto dto = validate(card.get());

            assertThat(dto.issues()).isEmpty();
            assertThat(dto.canPublish()).isTrue();
        }
    }

    // ---- the league limit names the league ----

    @Test
    void theBowlerLimitWarningNamesTheLeagueWhoseLimitApplies() {
        ScorecardCard card = ScorecardCard.oursBat();

        ResultValidationDto named = validate(card.context(new ScorecardContext(
                18, Map.of(), Map.of(), Map.of(), Map.of(), "Division Two T20")));
        assertThat(withCode(named, WarningCode.BOWLER_OVERS_EXCEED_LIMIT))
                .isNotEmpty().allSatisfy(issue -> assertThat(issue.message())
                        .contains("the league's maximum of 3.0 overs (Division Two T20).").contains("bowled more than"));

        ResultValidationDto unnamed = validate(ScorecardCard.oursBat().context(new ScorecardContext(
                18, Map.of(), Map.of(), Map.of(), Map.of())));
        assertThat(withCode(unnamed, WarningCode.BOWLER_OVERS_EXCEED_LIMIT))
                .isNotEmpty().allSatisfy(issue -> assertThat(issue.message()).endsWith("overs.").doesNotContain("("));
    }

    // ---- the reconciliation matrix, for our entries and for the opposition's ----

    private record Case(String name, UnaryOperator<ScorecardCard> bend, Enum<?> code, ResultWizardStep step,
                        ResultSide side) {
        @Override
        public String toString() {
            return name;
        }
    }

    private static Case c(String name, UnaryOperator<ScorecardCard> bend, Enum<?> code, ResultWizardStep step,
                          ResultSide side) {
        return new Case(name, bend, code, step, side);
    }

    /** Each case bends a clean card so that exactly one rule fires; the batting side is HOME, the bowling side AWAY. */
    private static Stream<Arguments> warningCases() {
        List<Case> cases = List.of(
                c("batters out differ from the wickets", x -> x.firstInnings(200, 7, 120),
                        WarningCode.BATTERS_OUT_NOT_WICKETS, ResultWizardStep.BATTING, H),
                c("three batters not out", x -> x.batting("b8", e -> bat(H, "b8", DismissalType.NOT_OUT, 5, null, 8))
                        .firstInnings(200, 7, 120), WarningCode.NOT_OUT_COUNT, ResultWizardStep.BATTING, H),
                c("two not out in an all-out innings", x -> x.allOut(true), WarningCode.NOT_OUT_COUNT,
                        ResultWizardStep.BATTING, H),
                c("batters plus extras differ from the total", x -> x.batting("b1",
                        e -> by(bat(H, "b1", DismissalType.BOWLED, 51, null, 1), "w1", null)),
                        WarningCode.BATTING_TOTAL_MISMATCH, ResultWizardStep.BATTING, H),
                c("bowlers' balls differ from the innings", x -> x.bowling("w1", e -> figures(e, 30, 0, 39, 2)),
                        WarningCode.BOWLER_BALLS_MISMATCH, ResultWizardStep.BOWLING, A),
                c("bowlers' runs plus byes differ from the total", x -> x.bowling("w1", e -> figures(e, 24, 0, 40, 2)),
                        WarningCode.BOWLING_RUNS_MISMATCH, ResultWizardStep.BOWLING, A),
                c("bowlers' wickets differ from the wickets", x -> x.bowling("w5", e -> figures(e, 24, 0, 39, 0)),
                        WarningCode.BOWLER_WICKETS_MISMATCH, ResultWizardStep.BOWLING, A),
                c("fielding credits exceed the wickets", x -> {
                    x.fielding.add(field(H, "w6", 9, 0, 0));
                    return x;
                }, WarningCode.FIELDING_EXCEEDS_WICKETS, ResultWizardStep.BOWLING, A),
                c("bowlers' wides differ from the innings", x -> x.bowling("w1", e -> extrasAndDots(e, 3, 1, null)),
                        WarningCode.WIDES_MISMATCH, ResultWizardStep.BOWLING, A),
                c("bowlers' no-balls differ from the innings", x -> x.bowling("w1", e -> extrasAndDots(e, 1, 3, null)),
                        WarningCode.NO_BALLS_MISMATCH, ResultWizardStep.BOWLING, A),
                c("a bowler beyond the league limit", x -> x.context(new ScorecardContext(
                        18, Map.of(), Map.of(), Map.of(), Map.of())), WarningCode.BOWLER_OVERS_EXCEED_LIMIT,
                        ResultWizardStep.BOWLING, A),
                c("a named bowler with no bowling figures", x -> x.batting("b1",
                        e -> by(bat(H, "b1", DismissalType.BOWLED, 50, null, 1), "w6", null)),
                        WarningCode.DISMISSAL_BOWLER_NOT_IN_BOWLING_LIST, ResultWizardStep.BOWLING, A),
                c("a manual wicket count the dismissals contradict", x -> x.bowling("w1",
                        e -> figures(e, 24, 0, 39, 3)), WarningCode.BOWLER_WICKETS_DIFFER_FROM_DISMISSALS,
                        ResultWizardStep.BOWLING, A),
                c("a manual catch count the dismissals contradict", x -> {
                    x.batting("b1", e -> by(bat(H, "b1", DismissalType.CAUGHT, 50, null, 1), "w1", "w6"));
                    x.fielding.add(field(H, "w6", 2, 0, 0));
                    return x;
                }, WarningCode.FIELDING_DIFFERS_FROM_DISMISSALS, ResultWizardStep.BOWLING, A));
        return cases.stream().flatMap(k -> Stream.of(
                Arguments.of(k, (Supplier<ScorecardCard>) ScorecardCard::oursBat),
                Arguments.of(k, (Supplier<ScorecardCard>) ScorecardCard::oppositionBats)));
    }

    @ParameterizedTest(name = "{0} / {1}")
    @MethodSource("warningCases")
    void everyReconciliationRuleFiresForEitherSideAsAnAcknowledgeableWarning(Case k, Supplier<ScorecardCard> card) {
        ResultValidationDto dto = validate(k.bend().apply(card.get()));

        assertIssue(dto, k.code(), k.step(), k.side(), ResultIssueSeverity.WARNING);
        assertThat(dto.canPublish()).as("a warning never blocks").isTrue();
        assertThat(dto.warnings()).isNotEmpty();
        assertThat(dto.errors()).isEmpty();
    }

    // ---- publish errors ----

    @ParameterizedTest
    @MethodSource("bothSides")
    void aBatterWithFiguresAndNoHowOutBlocksPublishing(Supplier<ScorecardCard> card) {
        ScorecardCard x = card.get().batting("b9", e -> bat(H, "b9", null, 3, null, 9));

        ResultValidationDto dto = validate(x);

        assertIssue(dto, ErrorCode.HOW_OUT_MISSING, ResultWizardStep.BATTING, H, ResultIssueSeverity.ERROR);
        assertThat(dto.canPublish()).isFalse();
        // the runs still count toward the total, so nothing else is said about it
        assertThat(dto.issues()).hasSize(1);
    }

    static Stream<Supplier<ScorecardCard>> bothSides() {
        return Stream.of(ScorecardCard::oursBat, ScorecardCard::oppositionBats);
    }

    @Test
    void aBatterWithNoHowOutAndNoFiguresIsTheSameAsDidNotBat() {
        ScorecardCard x = ScorecardCard.oursBat().batting("b11", e -> bat(H, "b11", null, null, null, null));

        assertThat(validate(x).issues()).isEmpty();
    }

    @ParameterizedTest
    @MethodSource("bothSides")
    void aBatterWhoBattedNeedsRunsAndBoundariesCannotExceedThem(Supplier<ScorecardCard> card) {
        ResultValidationDto noRuns = validate(card.get().batting("b1",
                e -> by(bat(H, "b1", DismissalType.BOWLED, null, null, 1), "w1", null)));
        assertIssue(noRuns, ErrorCode.BATTER_RUNS_MISSING, ResultWizardStep.BATTING, H, ResultIssueSeverity.ERROR);

        ResultValidationDto tooMany = validate(card.get().batting("b1",
                e -> boundaries(e, 10, 3)));
        assertIssue(tooMany, ErrorCode.BOUNDARIES_EXCEED_RUNS, ResultWizardStep.BATTING, H, ResultIssueSeverity.ERROR);

        ResultValidationDto exact = validate(card.get().batting("b1", e -> boundaries(e, 5, 5)));
        assertNoIssue(exact, ErrorCode.BOUNDARIES_EXCEED_RUNS);
    }

    @ParameterizedTest
    @MethodSource("bothSides")
    void aDidNotBatRowWithFiguresBlocksPublishing(Supplier<ScorecardCard> card) {
        ResultValidationDto dto = validate(card.get().batting("b11",
                e -> bat(H, "b11", DismissalType.DID_NOT_BAT, 1, null, null)));

        assertIssue(dto, ErrorCode.DID_NOT_BAT_WITH_FIGURES, ResultWizardStep.BATTING, H, ResultIssueSeverity.ERROR);
    }

    @ParameterizedTest
    @MethodSource("bothSides")
    void maidensCannotExceedTheCompleteOversBowled(Supplier<ScorecardCard> card) {
        ResultValidationDto dto = validate(card.get().bowling("w1", e -> figures(e, 24, 5, 39, 2)));

        assertIssue(dto, ErrorCode.MAIDENS_EXCEED_OVERS, ResultWizardStep.BOWLING, A, ResultIssueSeverity.ERROR);
        assertNoIssue(validate(card.get().bowling("w1", e -> figures(e, 24, 4, 39, 2))), ErrorCode.MAIDENS_EXCEED_OVERS);
    }

    @Test
    void anOfficialAwardNeedsAPlayerOrAName() {
        ScorecardCard x = ScorecardCard.oursBat();
        x.awards.add(new MatchAwardDto(null, AwardType.PLAYER_OF_MATCH, H, null, null, " ", null));

        assertIssue(validate(x), ErrorCode.AWARD_PLAYER_MISSING, ResultWizardStep.AWARDS, null, ResultIssueSeverity.ERROR);
    }

    @ParameterizedTest
    @EnumSource(value = ResultOutcomeType.class, names = {"WON", "TIE", "DRAW"})
    void anInningsWithMissingFiguresBlocksPublishingWhenTheOutcomeDependsOnThem(ResultOutcomeType outcome) {
        ScorecardCard x = ScorecardCard.oursBat().outcome(outcome).firstInnings(200, 8, null);

        assertIssue(validate(x), ErrorCode.INNINGS_FIGURES_MISSING, ResultWizardStep.SCORES, null,
                ResultIssueSeverity.ERROR);
    }

    @ParameterizedTest
    @EnumSource(value = ResultOutcomeType.class, names = {"FORFEIT", "ABANDONED", "NO_RESULT"})
    void missingInningsFiguresDoNotBlockAMatchThatWasNotPlayed(ResultOutcomeType outcome) {
        ScorecardCard x = ScorecardCard.oursBat().outcome(outcome).firstInnings(null, null, null);

        assertNoIssue(validate(x), ErrorCode.INNINGS_FIGURES_MISSING);
    }

    @Test
    void anOppositionOnlyScorecardCannotBePublishedButIsFineWithOurSideBesideIt() {
        ScorecardDto onlyOpposition = new ScorecardDto(List.of(opposition(A, "o1", "Smith")), null, null, null, null,
                null, null);
        ResultDraft draft = new ResultDraft(ResultOutcomeType.ABANDONED, null, null, null, null, null, null, null, null,
                null, null, null, null, null, onlyOpposition);

        ResultValidationDto dto = validator.validate(draft, HOME, AWAY);

        assertIssue(dto, ErrorCode.OPPOSITION_WITHOUT_OUR_SCORECARD, ResultWizardStep.TEAMS, A, ResultIssueSeverity.ERROR);
        assertThat(dto.canPublish()).isFalse();
        assertNoIssue(validate(ScorecardCard.oursBat()), ErrorCode.OPPOSITION_WITHOUT_OUR_SCORECARD);
    }

    @Test
    void aTeamListSavedBeforeTheGameIsCheckedWithNoOutcomeYet() {
        ScorecardDto list = new ScorecardDto(List.of(registered(H, "p1"), opposition(A, "o1", "Smith")), null, null,
                null, null, null, null);
        ResultDraft draft = new ResultDraft(null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, list);

        ResultValidationDto dto = validator.validate(draft, HOME, AWAY);

        assertIssue(dto, ErrorCode.OUTCOME_MISSING, ResultWizardStep.RESULT, null, ResultIssueSeverity.ERROR);
        assertNoIssue(dto, ErrorCode.OPPOSITION_WITHOUT_OUR_SCORECARD);
    }

    // ---- "cannot check" skips ----

    @Test
    void whatIsNotEnteredYetIsNotCheckedAgainstTheBatters() {
        // no wickets, runs or balls on the innings: the scorecard cannot be compared with figures that are not there
        ScorecardCard x = ScorecardCard.oursBat().firstInnings(null, null, null).breakdown(null, null, null, null, null)
                .bowling("w1", e -> figures(e, 30, 0, 99, 5));

        ResultValidationDto dto = validate(x);

        for (WarningCode code : List.of(WarningCode.BATTERS_OUT_NOT_WICKETS, WarningCode.BATTING_TOTAL_MISMATCH,
                WarningCode.BOWLER_BALLS_MISMATCH, WarningCode.BOWLING_RUNS_MISMATCH,
                WarningCode.BOWLER_WICKETS_MISMATCH)) {
            assertNoIssue(dto, code);
        }
    }

    @Test
    void anInningsWithNoRowsOfOneKindIsNotCheckedForThatKind() {
        ScorecardCard noBatting = ScorecardCard.oursBat();
        noBatting.batting.clear();
        assertNoIssue(validate(noBatting), WarningCode.BATTING_TOTAL_MISMATCH);
        assertNoIssue(validate(noBatting), WarningCode.BATTERS_OUT_NOT_WICKETS);

        ScorecardCard noBowling = ScorecardCard.oursBat();
        noBowling.bowling.clear();
        // the dismissals name bowlers who have no row: that is said, but not the totals
        ResultValidationDto dto = validate(noBowling);
        assertNoIssue(dto, WarningCode.BOWLER_BALLS_MISMATCH);
        assertNoIssue(dto, WarningCode.BOWLER_WICKETS_MISMATCH);
        assertThat(withCode(dto, WarningCode.DISMISSAL_BOWLER_NOT_IN_BOWLING_LIST)).hasSize(5);
    }

    @Test
    void widesAndNoBallsAreOnlyComparedWhenSomeBowlerEnteredThem() {
        ScorecardCard x = ScorecardCard.oursBat();
        x.bowling.replaceAll(b -> extrasAndDots(b, null, null, null));

        ResultValidationDto dto = validate(x);

        assertNoIssue(dto, WarningCode.WIDES_MISMATCH);
        assertNoIssue(dto, WarningCode.NO_BALLS_MISMATCH);
    }

    @Test
    void aMatchThatWasNotPlayedIsNotReconciledButItsTeamListIsStillChecked() {
        ScorecardCard x = ScorecardCard.derby().outcome(ResultOutcomeType.ABANDONED)
                .batting("b1", e -> by(bat(H, "b1", DismissalType.BOWLED, 99, null, 1), "w1", null))
                .context(new ScorecardContext(null, Map.of(), Map.of(), Map.of(),
                        Map.of(H, ScorecardSelectionState.NONE)));
        UUID shared = UUID.randomUUID();
        x.player("b11", p -> registered(H, "b11", shared));
        x.player("w11", p -> registered(A, "w11", shared));

        ResultValidationDto dto = validate(x);

        assertNoIssue(dto, WarningCode.BATTING_TOTAL_MISMATCH);
        assertNoIssue(dto, WarningCode.OUR_TEAM_NOT_SELECTED);
        assertIssue(dto, WarningCode.PLAYER_ON_BOTH_SIDES, ResultWizardStep.TEAMS, null, ResultIssueSeverity.WARNING);
    }

    // ---- extras and the charging rule ----

    @Test
    void theExtrasComponentsDeriveTheTotalAndAConflictingTotalIsRejectedOnSave() {
        InningsDto derivedTotal = new InningsDto(1, null, H, 200, 8, 120, null, null, null, 4, 1, 3, 2, 0, null);
        ResultDraft draft = new ResultDraft(null, null, null, null, null, null, null, null, null, null, null, null, null,
                List.of(derivedTotal));
        assertThat(draft.innings().get(0).extras()).isEqualTo(10);

        InningsDto conflicting = new InningsDto(1, null, H, 200, 8, 120, 11, null, null, 4, 1, 3, 2, 0, null);
        List<ResultIssueDto> issues = validator.structuralIssueList(new ResultDraft(null, null, null, null, null, null,
                null, null, null, null, null, null, null, List.of(conflicting)));
        assertThat(issues).singleElement().satisfies(i -> {
            assertThat(i.code()).isEqualTo(ErrorCode.EXTRAS_TOTAL_MISMATCH.name());
            assertThat(i.step()).isEqualTo(ResultWizardStep.SCORES);
            assertThat(i.severity()).isEqualTo(ResultIssueSeverity.ERROR);
        });
    }

    @Test
    void widesAndNoBallsAreInTheBowlersRunsButByesLegByesAndPenaltyAreNot() {
        // 195 runs charged to the bowlers + 3 byes + 2 leg byes + 0 penalty = 200: the clean card
        assertNoIssue(validate(ScorecardCard.oursBat()), WarningCode.BOWLING_RUNS_MISMATCH);

        // five penalty runs are added on top of what the bowlers conceded, so the total no longer matches
        ResultValidationDto penalty = validate(ScorecardCard.oursBat().breakdown(4, 1, 3, 2, 5)
                .firstInnings(205, 8, 120).batting("b1", e -> by(bat(H, "b1", DismissalType.BOWLED, 50, null, 1), "w1", null)));
        assertNoIssue(penalty, WarningCode.BOWLING_RUNS_MISMATCH);
        assertNoIssue(penalty, WarningCode.BATTING_TOTAL_MISMATCH);

        // ten more wides lift the extras (and so the batters' share of the total) but are not charged to the bowlers again
        ScorecardCard wides = ScorecardCard.oursBat().breakdown(14, 1, 3, 2, 0)
                .batting("b1", e -> by(bat(H, "b1", DismissalType.BOWLED, 40, null, 1), "w1", null))
                .bowling("w1", e -> extrasAndDots(e, 11, 1, null));
        ResultValidationDto dto = validate(wides);
        assertNoIssue(dto, WarningCode.BATTING_TOTAL_MISMATCH);
        assertNoIssue(dto, WarningCode.BOWLING_RUNS_MISMATCH);
    }

    @Test
    void withoutABreakdownTheBowlersRunsOnlyWarnWhenTheyExceedTheTotal() {
        ScorecardCard x = ScorecardCard.oursBat().breakdown(null, null, null, null, null);

        assertNoIssue(validate(x), WarningCode.BOWLING_RUNS_MISMATCH);
        assertIssue(validate(x.bowling("w1", e -> figures(e, 24, 0, 100, 2))), WarningCode.BOWLING_RUNS_MISMATCH,
                ResultWizardStep.BOWLING, A, ResultIssueSeverity.WARNING);
    }

    @Test
    void withoutABreakdownTheBattersOnlyWarnWhenTheyExceedTheTotal() {
        ScorecardCard under = ScorecardCard.oursBat().breakdown(null, null, null, null, null);
        assertNoIssue(validate(under), WarningCode.BATTING_TOTAL_MISMATCH);

        ScorecardCard over = ScorecardCard.oursBat().breakdown(null, null, null, null, null)
                .batting("b1", e -> by(bat(H, "b1", DismissalType.BOWLED, 80, null, 1), "w1", null));
        assertIssue(validate(over), WarningCode.BATTING_TOTAL_MISMATCH, ResultWizardStep.BATTING, H,
                ResultIssueSeverity.WARNING);
    }

    // ---- wicket classification and non-bowler wickets ----

    @Test
    void aRetiredOutBatterIsACountedNonBowlerWicketAndARetiredNotOutBatterIsNotAWicket() {
        // b8 retired out: still 8 wickets in the innings, none credited to a bowler, so w5 has none to his name
        ScorecardCard retiredOut = ScorecardCard.oursBat()
                .batting("b8", e -> bat(H, "b8", DismissalType.RETIRED_OUT, 5, null, 8))
                .bowling("w5", e -> figures(e, 24, 0, 39, 0));
        assertThat(validate(retiredOut).issues()).isEmpty();

        // b8 retired not out: only 7 wickets are out, so the result's 8 is contradicted
        ScorecardCard retiredNotOut = ScorecardCard.oursBat()
                .batting("b8", e -> bat(H, "b8", DismissalType.RETIRED_NOT_OUT, 5, null, 8))
                .bowling("w5", e -> figures(e, 24, 0, 39, 0));
        ResultValidationDto dto = validate(retiredNotOut);
        assertIssue(dto, WarningCode.BATTERS_OUT_NOT_WICKETS, ResultWizardStep.BATTING, H, ResultIssueSeverity.WARNING);
        // not a non-bowler wicket either: the bowlers' 7 are all there is, against the result's 8
        assertIssue(dto, WarningCode.BOWLER_WICKETS_MISMATCH, ResultWizardStep.BOWLING, A, ResultIssueSeverity.WARNING);
    }

    @Test
    void aRunOutIsAWicketNoBowlerIsCreditedWith() {
        ScorecardCard x = ScorecardCard.oursBat()
                .batting("b8", e -> by(bat(H, "b8", DismissalType.RUN_OUT, 5, null, 8), null, "w6"))
                .bowling("w5", e -> figures(e, 24, 0, 39, 0));

        assertThat(validate(x).issues()).isEmpty();
    }

    @Test
    void nonBowlerWicketsAreDerivedFromTheBattersWhenTheyExistAndEnteredWhenTheyDoNot() {
        // typed 5 is ignored while batting rows exist: the derived count (0) decides
        ScorecardCard derivedFromBatters = ScorecardCard.oursBat().nonBowlerWickets(5);
        assertNoIssue(validate(derivedFromBatters), WarningCode.BOWLER_WICKETS_MISMATCH);

        // with no batting rows the bowlers took 7, and the 8th wicket is the typed non-bowler one
        ScorecardCard manual = ScorecardCard.oursBat().nonBowlerWickets(1).bowling("w5", e -> figures(e, 24, 0, 39, 0));
        manual.batting.clear();
        assertNoIssue(validate(manual), WarningCode.BOWLER_WICKETS_MISMATCH);

        ScorecardCard none = ScorecardCard.oursBat().bowling("w5", e -> figures(e, 24, 0, 39, 0));
        none.batting.clear();
        assertIssue(validate(none), WarningCode.BOWLER_WICKETS_MISMATCH, ResultWizardStep.BOWLING, A,
                ResultIssueSeverity.WARNING);
    }

    @Test
    void fieldingRunOutsAreComparedWithTheNonBowlerWickets() {
        ScorecardCard x = ScorecardCard.oursBat();
        x.fielding.add(field(H, "w6", 0, 0, 1));

        assertIssue(validate(x), WarningCode.FIELDING_EXCEEDS_WICKETS, ResultWizardStep.BOWLING, A,
                ResultIssueSeverity.WARNING);
    }

    // ---- derived credits and the complete-attribution skip ----

    @Test
    void aDerivedRowIsTheDerivationByConstructionAndIsNeverFlagged() {
        ScorecardCard x = ScorecardCard.oursBat().bowling("w1", e -> derived(figures(e, 24, 0, 39, 99)));
        x.batting("b1", e -> by(bat(H, "b1", DismissalType.CAUGHT, 50, null, 1), "w1", "w6"));
        x.fielding.add(derived(field(H, "w6", 7, 7, 7)));

        ResultValidationDto dto = validate(x);

        assertNoIssue(dto, WarningCode.BOWLER_WICKETS_DIFFER_FROM_DISMISSALS);
        assertNoIssue(dto, WarningCode.FIELDING_DIFFERS_FROM_DISMISSALS);
        // the DERIVED wickets count what the dismissals credit, not the typed 99
        assertNoIssue(dto, WarningCode.BOWLER_WICKETS_MISMATCH);
        assertNoIssue(dto, WarningCode.FIELDING_EXCEEDS_WICKETS);
    }

    @Test
    void aManualWicketCountIsNotComparedWhileADismissalHasNoBowlerNamed() {
        ScorecardCard x = ScorecardCard.oursBat()
                .batting("b1", e -> by(bat(H, "b1", DismissalType.BOWLED, 50, null, 1), null, null))
                .bowling("w1", e -> figures(e, 24, 0, 39, 2));

        assertNoIssue(validate(x), WarningCode.BOWLER_WICKETS_DIFFER_FROM_DISMISSALS);
    }

    @Test
    void aManualFieldingCountIsNotComparedWhileACatchHasNoFielderNamed() {
        ScorecardCard x = ScorecardCard.oursBat()
                .batting("b1", e -> by(bat(H, "b1", DismissalType.CAUGHT, 50, null, 1), "w1", null));
        x.fielding.add(field(H, "w6", 5, 0, 0));

        assertNoIssue(validate(x), WarningCode.FIELDING_DIFFERS_FROM_DISMISSALS);
    }

    @Test
    void aManualFieldingRowMatchingTheDismissalsIsNotFlagged() {
        ScorecardCard x = ScorecardCard.oursBat()
                .batting("b1", e -> by(bat(H, "b1", DismissalType.CAUGHT, 50, null, 1), "w1", "w6"));
        x.fielding.add(field(H, "w6", 1, 0, 0));

        assertThat(validate(x).issues()).isEmpty();
    }

    // ---- the line-up, squad and guest rules (ours only) ----

    private static ScorecardCard twelveTookPart(ScorecardCard x, ResultSide side) {
        // the bowling side w1..w5 bowled; w6..w12 fielded without a credit
        boolean oppositionBowls = x.players.stream().filter(p -> "w1".equals(p.clientKey())).findFirst().orElseThrow()
                .opposition();
        x.players.add(oppositionBowls ? opposition(side, "w12", "Bowler 12") : registered(side, "w12"));
        for (int n = 6; n <= 12; n++) {
            x.fielding.add(field(H, "w" + n, 0, 0, 0));
        }
        return x;
    }

    @Test
    void theLineUpIsTooLargeOnlyForOurPlayersWhoTookPart() {
        ResultValidationDto twelve = validate(twelveTookPart(ScorecardCard.oppositionBats(), A));
        assertIssue(twelve, WarningCode.LINEUP_TOO_LARGE, ResultWizardStep.TEAMS, A, ResultIssueSeverity.WARNING);

        // a substitute who fielded is not one of the eleven
        ScorecardCard withSub = twelveTookPart(ScorecardCard.oppositionBats(), A).player("w12", p -> substitute(p));
        assertNoIssue(validate(withSub), WarningCode.LINEUP_TOO_LARGE);

        // listed, but did not bat or bowl or field: not counted (eleven listed, only five took part)
        assertNoIssue(validate(ScorecardCard.oppositionBats()), WarningCode.LINEUP_TOO_LARGE);

        // a twelfth who is only marked did-not-bat did not take part either
        ScorecardCard dnb = ScorecardCard.oursBat();
        dnb.players.add(registered(H, "b12"));
        dnb.batting.add(bat(H, "b12", DismissalType.DID_NOT_BAT, null, null, null));
        assertNoIssue(validate(dnb), WarningCode.LINEUP_TOO_LARGE);
    }

    @Test
    void theOppositionsLineUpIsNeverTooLarge() {
        ScorecardCard x = twelveTookPart(ScorecardCard.oursBat(), A);

        assertNoIssue(validate(x), WarningCode.LINEUP_TOO_LARGE);
    }

    @Test
    void aPlayerOutsideTheSquadIsWarnedAboutForOurSideOnlyAndOnlyWhereASquadIsKnown() {
        ScorecardCard x = ScorecardCard.oursBat();
        Set<UUID> squad = x.players.stream().filter(p -> p.side() == H && !"b1".equals(p.clientKey()))
                .map(ResultPlayerDto::playerProfileId).collect(Collectors.toSet());
        x.context(new ScorecardContext(null, Map.of(H, squad), Map.of(), Map.of(), Map.of()));

        ResultValidationDto dto = validate(x);

        assertThat(withCode(dto, WarningCode.PLAYER_NOT_IN_SQUAD)).hasSize(1);
        assertIssue(dto, WarningCode.PLAYER_NOT_IN_SQUAD, ResultWizardStep.TEAMS, H, ResultIssueSeverity.WARNING);

        // no squad known for the side: nothing to check; opposition rows are never checked
        ScorecardCard noSquad = ScorecardCard.oursBat()
                .context(new ScorecardContext(null, Map.of(A, Set.of()), Map.of(), Map.of(), Map.of()));
        assertNoIssue(validate(noSquad), WarningCode.PLAYER_NOT_IN_SQUAD);
    }

    @Test
    void aGuestWhoSharesARegisteredPlayersNameIsWarnedAboutButAnOppositionNameIsNot() {
        UUID registered = UUID.randomUUID();
        ScorecardContext context = new ScorecardContext(null, Map.of(), Map.of("sam smith", registered), Map.of(), Map.of());
        ScorecardCard x = ScorecardCard.oursBat().context(context).player("b11", p -> guest(H, "b11", "SAM  smith"));

        assertIssue(validate(x), WarningCode.GUEST_NAME_MATCHES_PLAYER, ResultWizardStep.TEAMS, H,
                ResultIssueSeverity.WARNING);

        ScorecardCard opposition = ScorecardCard.oursBat().context(context)
                .player("w11", p -> opposition(A, "w11", "Sam Smith"));
        assertNoIssue(validate(opposition), WarningCode.GUEST_NAME_MATCHES_PLAYER);
    }

    // ---- the derby ----

    @Test
    void aRegisteredPlayerOnBothSidesOfADerbyIsAnAcknowledgeableWarning() {
        UUID shared = UUID.randomUUID();
        ScorecardCard x = ScorecardCard.derby();
        x.player("b11", p -> registered(H, "b11", shared));
        x.player("w11", p -> registered(A, "w11", shared));

        ResultValidationDto dto = validate(x);

        assertIssue(dto, WarningCode.PLAYER_ON_BOTH_SIDES, ResultWizardStep.TEAMS, null, ResultIssueSeverity.WARNING);
        assertThat(withCode(dto, WarningCode.PLAYER_ON_BOTH_SIDES)).hasSize(1);
        assertThat(dto.canPublish()).isTrue();
        assertThat(dto.warnings()).hasSize(1);
    }

    @Test
    void theSameGuestOnBothSidesOfADerbyIsAnInfoLineThatNeedsNoAcknowledgement() {
        ScorecardCard x = ScorecardCard.derby();
        x.player("b11", p -> guest(H, "b11", "John Smith"));
        x.player("w11", p -> guest(A, "w11", "john smith"));

        ResultValidationDto dto = validate(x);

        assertIssue(dto, WarningCode.GUEST_ON_BOTH_SIDES, ResultWizardStep.TEAMS, A, ResultIssueSeverity.INFO);
        assertThat(dto.canPublish()).isTrue();
        assertThat(dto.warnings()).isEmpty();
        assertThat(dto.errors()).isEmpty();
    }

    @Test
    void anOppositionNameEqualToOurGuestIsNotAGuestOnBothSides() {
        ScorecardCard x = ScorecardCard.oursBat().player("b11", p -> guest(H, "b11", "John Smith"))
                .player("w11", p -> opposition(A, "w11", "John Smith"));

        assertNoIssue(validate(x), WarningCode.GUEST_ON_BOTH_SIDES);
    }

    // ---- OUR_TEAM_NOT_SELECTED ----

    private static ScorecardContext selection(ScorecardSelectionState home) {
        return new ScorecardContext(null, Map.of(), Map.of(), Map.of(), Map.of(H, home));
    }

    private void assertNotSelected(ResultValidationDto dto, ResultSide side) {
        assertIssue(dto, WarningCode.OUR_TEAM_NOT_SELECTED, ResultWizardStep.TEAMS, side, ResultIssueSeverity.INFO);
        assertThat(withCode(dto, WarningCode.OUR_TEAM_NOT_SELECTED)).hasSize(1);
        // never blocks and needs no acknowledgement
        assertThat(dto.canPublish()).isTrue();
        assertThat(dto.warnings()).isEmpty();
        assertThat(dto.errors()).isEmpty();
    }

    @Test
    void noSelectionIsNotedWithTheNotSelectedWordingOnlyWhenFewerThanElevenAreListed() {
        ScorecardCard x = ScorecardCard.oursBat().remove("b11").context(selection(ScorecardSelectionState.NONE));

        ResultValidationDto dto = validate(x);
        assertNotSelected(dto, H);
        assertThat(withCode(dto, WarningCode.OUR_TEAM_NOT_SELECTED)).singleElement()
                .extracting(ResultIssueDto::message).isEqualTo("Our team is not selected for this match.");
    }

    @Test
    void elevenListedNeverRaisesItEvenWithNoSelection() {
        ScorecardCard x = ScorecardCard.oursBat().context(selection(ScorecardSelectionState.NONE));

        assertNoIssue(validate(x), WarningCode.OUR_TEAM_NOT_SELECTED);
    }

    @Test
    void fewerThanElevenNonSubstitutesIsNotedWhetherOrNotTheSelectionWasAnnounced() {
        for (ScorecardSelectionState state : ScorecardSelectionState.values()) {
            if (state == ScorecardSelectionState.NONE) {
                continue;
            }
            ScorecardCard x = ScorecardCard.oursBat().remove("b11").context(selection(state));

            ResultValidationDto dto = validate(x);
            assertNotSelected(dto, H);
            assertThat(withCode(dto, WarningCode.OUR_TEAM_NOT_SELECTED)).singleElement()
                    .extracting(ResultIssueDto::message).asString().startsWith("Only 10 players are on ");
        }
        // the 12th man does not make up the eleven
        ScorecardCard sub = ScorecardCard.oursBat().remove("b11").context(selection(ScorecardSelectionState.ANNOUNCED));
        sub.players.add(substitute(registered(H, "s1")));
        assertNotSelected(validate(sub), H);
    }

    @Test
    void elevenOrMoreNeverWarnsAnnouncedOrNot() {
        for (ScorecardSelectionState state : List.of(ScorecardSelectionState.ANNOUNCED, ScorecardSelectionState.NOT_ANNOUNCED)) {
            assertNoIssue(validate(ScorecardCard.oursBat().context(selection(state))), WarningCode.OUR_TEAM_NOT_SELECTED);
        }
        ScorecardCard twelve = ScorecardCard.oursBat().context(selection(ScorecardSelectionState.NOT_ANNOUNCED));
        twelve.players.add(registered(H, "b12"));
        assertNoIssue(validate(twelve), WarningCode.OUR_TEAM_NOT_SELECTED);
    }

    @Test
    void theOppositionSideIsNeverNoted() {
        ScorecardCard x = ScorecardCard.oursBat().remove("b11")
                .context(new ScorecardContext(null, Map.of(), Map.of(), Map.of(),
                        Map.of(H, ScorecardSelectionState.ANNOUNCED, A, ScorecardSelectionState.NONE)));
        x.players.removeIf(p -> p.side() == A && !"w1".equals(p.clientKey()) && !"w2".equals(p.clientKey())
                && !"w3".equals(p.clientKey()) && !"w4".equals(p.clientKey()) && !"w5".equals(p.clientKey()));

        ResultValidationDto dto = validate(x);

        assertThat(withCode(dto, WarningCode.OUR_TEAM_NOT_SELECTED)).extracting(ResultIssueDto::side).containsOnly(H);
    }

    @Test
    void aSideWithNoPlayersOnTheScorecardIsNeverNoted() {
        ScorecardCard x = ScorecardCard.oursBat();
        x.players.removeIf(p -> p.side() == A);
        x.bowling.clear();
        x.batting.replaceAll(e -> by(e, null, null));
        x.context(new ScorecardContext(null, Map.of(), Map.of(), Map.of(),
                Map.of(H, ScorecardSelectionState.ANNOUNCED, A, ScorecardSelectionState.NONE)));

        assertNoIssue(validate(x), WarningCode.OUR_TEAM_NOT_SELECTED);
    }

    @Test
    void aDerbyNotesEachOursSideThatIsNotSelected() {
        ScorecardCard x = ScorecardCard.derby().remove("b11").remove("w11").context(new ScorecardContext(null, Map.of(), Map.of(),
                Map.of(), Map.of(H, ScorecardSelectionState.ANNOUNCED, A, ScorecardSelectionState.NONE)));

        assertThat(withCode(validate(x), WarningCode.OUR_TEAM_NOT_SELECTED)).extracting(ResultIssueDto::side)
                .containsExactlyInAnyOrder(H, A);
    }

    @ParameterizedTest
    @EnumSource(value = ResultOutcomeType.class, names = {"FORFEIT", "ABANDONED", "NO_RESULT"})
    void aMatchThatWasNotPlayedIsNeverNoted(ResultOutcomeType outcome) {
        ScorecardCard x = ScorecardCard.oursBat().outcome(outcome).remove("b11")
                .context(selection(ScorecardSelectionState.NONE));

        assertNoIssue(validate(x), WarningCode.OUR_TEAM_NOT_SELECTED);
    }

    @Test
    void aTeamListSavedBeforeAnyOutcomeIsNotedToo() {
        ScorecardDto list = new ScorecardDto(List.of(registered(H, "p1"), registered(H, "p2")), null, null, null, null,
                null, null);
        ResultDraft draft = new ResultDraft(null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, list);

        ResultValidationDto dto = validator.validate(draft, HOME, AWAY, selection(ScorecardSelectionState.NONE));

        assertIssue(dto, WarningCode.OUR_TEAM_NOT_SELECTED, ResultWizardStep.TEAMS, H, ResultIssueSeverity.INFO);
    }
}
