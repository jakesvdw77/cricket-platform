package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.TossDecision;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultValidationDto;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * docs/specs/100-match-results-core.md Test Plan: the outcome-rule matrix, the score-versus-result warnings (see
 * {@link ResultValidator.WarningCode}), super overs, DLS and partial drafts. Pure logic, no Spring.
 */
class ResultValidatorTest {

    private static final String HOME = "Riverside";
    private static final String AWAY = "Hillside";

    private final ResultValidator validator = new ResultValidator();

    // ---- builders ----

    private static InningsDto inn(ResultSide side, int runs, int wickets) {
        return new InningsDto(null, null, side, runs, wickets, 120, null, null, null);
    }

    private static InningsDto innBalls(ResultSide side, int runs, int wickets, int balls) {
        return new InningsDto(null, null, side, runs, wickets, balls, null, null, null);
    }

    /** Builds a draft; sequence, kind and all-out follow list position as the compact constructor defines. */
    private static ResultDraft draft(
            ResultOutcomeType outcome, ResultDecidedBy decidedBy, ResultSide winner, ResultMarginType marginType,
            Integer marginValue, InningsDto... innings) {
        return new ResultDraft(outcome, decidedBy, winner, marginType, marginValue, null, null, null, null, null, null,
                null, null, List.of(innings));
    }

    private static ResultDraft wonByRuns(ResultSide winner, Integer margin, InningsDto... innings) {
        return draft(ResultOutcomeType.WON, null, winner, ResultMarginType.RUNS, margin, innings);
    }

    private static ResultDraft wonByWickets(ResultSide winner, Integer margin, InningsDto... innings) {
        return draft(ResultOutcomeType.WON, null, winner, ResultMarginType.WICKETS, margin, innings);
    }

    private ResultValidationDto validate(ResultDraft draft) {
        return validator.validate(draft, HOME, AWAY);
    }

    /** A clean win by 50 runs: home 200/8 then away 150/10. */
    private static ResultDraft cleanWinByRuns() {
        return wonByRuns(ResultSide.HOME, 50, inn(ResultSide.HOME, 200, 8), inn(ResultSide.AWAY, 150, 10));
    }

    private static ResultDraft withToss(ResultDraft d, ResultSide wonBy, TossDecision decision) {
        return new ResultDraft(d.outcomeType(), d.decidedBy(), d.winningSide(), d.marginType(), d.marginValue(),
                d.dlsTarget(), d.dlsRevisedBalls(), d.scheduledBalls(), d.ballsPerOver(), wonBy, decision, null, null,
                d.innings());
    }

    private static ResultDraft withScheduled(ResultDraft d, Integer scheduledBalls) {
        return new ResultDraft(d.outcomeType(), d.decidedBy(), d.winningSide(), d.marginType(), d.marginValue(),
                d.dlsTarget(), d.dlsRevisedBalls(), scheduledBalls, d.ballsPerOver(), d.tossWonBy(), d.tossDecision(),
                null, null, d.innings());
    }

    private static ResultDraft dls(ResultSide winner, Integer target, Integer revisedBalls, InningsDto... innings) {
        return new ResultDraft(ResultOutcomeType.WON, ResultDecidedBy.DLS, winner, ResultMarginType.WICKETS, 2, target,
                revisedBalls, null, null, null, null, null, null, List.of(innings));
    }

    // ---- structural errors (what every save enforces) ----

    @Test
    void anEmptyDraftIsStructurallyValid() {
        assertThat(validator.structuralErrors(draft(null, null, null, null, null))).isEmpty();
    }

    @Test
    void ballsPerOverOutsideOneToTwelveIsRejected() {
        for (int bad : new int[] {0, 13}) {
            ResultDraft d = new ResultDraft(null, null, null, null, null, null, null, null, bad, null, null, null, null,
                    null);
            assertThat(validator.structuralErrors(d)).containsExactly("Balls per over must be between 1 and 12.");
        }
        for (int ok : new int[] {1, 5, 8, 12}) {
            ResultDraft d = new ResultDraft(null, null, null, null, null, null, null, null, ok, null, null, null, null,
                    null);
            assertThat(validator.structuralErrors(d)).isEmpty();
        }
    }

    @Test
    void negativeMarginDlsFiguresAndScheduledLengthAreRejected() {
        ResultDraft d = new ResultDraft(null, null, null, null, -1, -5, -6, 0, null, null, null, null, null, null);
        assertThat(validator.structuralErrors(d)).containsExactlyInAnyOrder(
                "The margin cannot be negative.",
                "The DLS target cannot be negative.",
                "The DLS revised length cannot be negative.",
                "The scheduled length must be at least one ball.");
    }

    @Test
    void aWinByMoreThanTenWicketsIsRejected() {
        assertThat(validator.structuralErrors(wonByWickets(ResultSide.HOME, 11)))
                .containsExactly("A win by wickets cannot be by more than 10 wickets.");
        assertThat(validator.structuralErrors(wonByWickets(ResultSide.HOME, 10))).isEmpty();
    }

    @Test
    void inningsStructureIsChecked() {
        // two regular innings with the same sequence number
        ResultDraft duplicate = draft(null, null, null, null, null,
                new InningsDto(1, InningsKind.REGULAR, ResultSide.HOME, 1, 1, 6, null, null, null),
                new InningsDto(1, InningsKind.REGULAR, ResultSide.AWAY, 1, 1, 6, null, null, null));
        assertThat(validator.structuralErrors(duplicate)).contains("Two innings share the number 1.");

        ResultDraft regularThree = draft(null, null, null, null, null,
                new InningsDto(3, InningsKind.REGULAR, ResultSide.HOME, 1, 1, 6, null, null, null));
        assertThat(validator.structuralErrors(regularThree))
                .contains("Innings 3 cannot be a regular innings: only innings 1 and 2 are.");

        ResultDraft earlySuperOver = draft(null, null, null, null, null,
                new InningsDto(2, InningsKind.SUPER_OVER, ResultSide.HOME, 1, 1, 6, null, null, null));
        assertThat(validator.structuralErrors(earlySuperOver))
                .contains("Innings 2 cannot be a super over: super overs follow the two regular innings.");
    }

    @Test
    void inningsMustHaveASideButMayHoldPartialFigures() {
        ResultDraft d = draft(null, null, null, null, null,
                new InningsDto(1, InningsKind.REGULAR, null, null, 3, 60, null, null, null));
        assertThat(validator.structuralErrors(d)).containsExactly("Innings 1 needs the batting side.");
        ResultDraft onlyRuns = draft(null, null, null, null, null,
                new InningsDto(1, InningsKind.REGULAR, ResultSide.HOME, 120, null, null, null, null, null));
        assertThat(validator.structuralErrors(onlyRuns)).isEmpty();
        ResultDraft noFigures = draft(null, null, null, null, null,
                new InningsDto(1, InningsKind.REGULAR, ResultSide.HOME, null, null, null, null, null, null));
        assertThat(validator.structuralErrors(noFigures)).isEmpty();
    }

    @Test
    void negativeFiguresAndTooManyWicketsAreRejected() {
        ResultDraft negative = draft(null, null, null, null, null,
                new InningsDto(1, InningsKind.REGULAR, ResultSide.HOME, -1, 1, 6, null, null, null));
        assertThat(validator.structuralErrors(negative)).contains("Innings 1 cannot have negative figures.");

        ResultDraft elevenWickets = draft(null, null, null, null, null,
                new InningsDto(1, InningsKind.REGULAR, ResultSide.HOME, 10, 11, 6, null, null, null));
        assertThat(validator.structuralErrors(elevenWickets)).contains("Innings 1 cannot have more than 10 wickets.");
    }

    @Test
    void aSuperOverAllowsAtMostTwoWickets() {
        ResultDraft three = draft(null, null, null, null, null,
                new InningsDto(3, InningsKind.SUPER_OVER, ResultSide.HOME, 5, 3, 6, null, null, null));
        assertThat(validator.structuralErrors(three)).contains("Innings 3 cannot have more than 2 wickets.");
        ResultDraft two = draft(null, null, null, null, null,
                new InningsDto(3, InningsKind.SUPER_OVER, ResultSide.HOME, 5, 2, 6, null, null, null));
        assertThat(validator.structuralErrors(two)).isEmpty();
    }

    @Test
    void moreThanTwoRegularInningsIsRejected() {
        ResultDraft d = draft(null, null, null, null, null,
                inn(ResultSide.HOME, 1, 1), inn(ResultSide.AWAY, 1, 1),
                new InningsDto(4, InningsKind.REGULAR, ResultSide.HOME, 1, 1, 6, null, null, null));
        assertThat(validator.structuralErrors(d)).contains("A match has at most two regular innings.");
    }

    // ---- outcome matrix: WON ----

    @Test
    void aCleanWinByRunsHasNoErrorsOrWarnings() {
        ResultValidationDto result = validate(cleanWinByRuns());
        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings()).isEmpty();
        assertThat(result.canPublish()).isTrue();
    }

    @Test
    void aCleanWinByWicketsHasNoErrorsOrWarnings() {
        ResultValidationDto result = validate(wonByWickets(ResultSide.AWAY, 3,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 151, 7)));
        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings()).isEmpty();
    }

    @Test
    void anOutcomeIsRequiredToPublish() {
        ResultValidationDto result = validate(draft(null, null, null, null, null));
        assertThat(result.errors()).containsExactly("Choose how the match ended.");
        assertThat(result.canPublish()).isFalse();
    }

    @Test
    void aWinNeedsAWinnerAndAMargin() {
        ResultValidationDto result = validate(draft(ResultOutcomeType.WON, null, null, null, null));
        assertThat(result.errors()).containsExactlyInAnyOrder(
                "Choose which side won.", "Enter the margin of victory (runs or wickets).");
        assertThat(result.canPublish()).isFalse();
    }

    @Test
    void aWinMarginOfZeroIsAnError() {
        ResultValidationDto result = validate(wonByRuns(ResultSide.HOME, 0));
        assertThat(result.errors()).contains("The margin of victory must be at least 1.");
    }

    @Test
    void aMarginTypeWithoutAValueIsAnError() {
        ResultValidationDto result = validate(wonByRuns(ResultSide.HOME, null));
        assertThat(result.errors()).contains("Enter the margin of victory (runs or wickets).");
    }

    // ---- outcome matrix: no-winner outcomes and forfeit ----

    @ParameterizedTest
    @EnumSource(value = ResultOutcomeType.class, names = {"TIE", "DRAW", "NO_RESULT", "ABANDONED"})
    void outcomesWithoutAWinnerRejectAWinnerAndAMargin(ResultOutcomeType outcome) {
        ResultValidationDto clean = validate(draft(outcome, null, null, null, null));
        assertThat(clean.errors()).isEmpty();

        ResultValidationDto withWinner = validate(draft(outcome, null, ResultSide.HOME, null, null));
        assertThat(withWinner.errors()).singleElement().asString().endsWith("has no winning side.");

        ResultValidationDto withMargin = validate(draft(outcome, null, null, ResultMarginType.RUNS, 5));
        assertThat(withMargin.errors()).singleElement().asString().endsWith("has no margin of victory.");
    }

    @Test
    void aForfeitNeedsAWinnerAndHasNoMargin() {
        assertThat(validate(draft(ResultOutcomeType.FORFEIT, null, ResultSide.AWAY, null, null)).errors()).isEmpty();
        assertThat(validate(draft(ResultOutcomeType.FORFEIT, null, null, null, null)).errors())
                .containsExactly("Choose which side received the win.");
        assertThat(validate(draft(ResultOutcomeType.FORFEIT, null, ResultSide.AWAY, ResultMarginType.RUNS, 5)).errors())
                .containsExactly("A forfeit has no margin of victory.");
    }

    @ParameterizedTest
    @EnumSource(value = ResultOutcomeType.class, names = {"TIE", "DRAW", "NO_RESULT", "ABANDONED", "FORFEIT"})
    void onlyAWinCanBeDecidedByDlsOrASuperOver(ResultOutcomeType outcome) {
        ResultSide winner = outcome == ResultOutcomeType.FORFEIT ? ResultSide.HOME : null;
        for (ResultDecidedBy by : new ResultDecidedBy[] {ResultDecidedBy.DLS, ResultDecidedBy.SUPER_OVER}) {
            assertThat(validate(draft(outcome, by, winner, null, null)).errors())
                    .contains("Only a win can be decided by DLS or a super over.");
        }
    }

    // ---- warning WINNER_NOT_HIGHER_SCORER ----

    @Test
    void winnerNotHigherScorerWarnsWithRealNamesAndSkipsTheMarginCheck() {
        // home 200, away 150, but away marked as the winner by 3 wickets
        ResultValidationDto result = validate(wonByWickets(ResultSide.AWAY, 3,
                inn(ResultSide.HOME, 200, 8), inn(ResultSide.AWAY, 150, 10)));
        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings()).containsExactly("Riverside scored more, but Hillside is marked as the winner.");
        assertThat(result.canPublish()).isTrue();
    }

    @Test
    void sideNamesFallBackWhenTheNameIsBlank() {
        ResultValidationDto result = validator.validate(
                wonByWickets(ResultSide.AWAY, 3, inn(ResultSide.HOME, 200, 8), inn(ResultSide.AWAY, 150, 10)), " ", null);
        assertThat(result.warnings()).containsExactly("The home side scored more, but The away side is marked as the winner.");
    }

    // ---- warning MARGIN_MISMATCH ----

    @Test
    void runsMarginContradictingTheScoresWarns() {
        ResultValidationDto result = validate(wonByRuns(ResultSide.HOME, 40,
                inn(ResultSide.HOME, 200, 8), inn(ResultSide.AWAY, 150, 10)));
        assertThat(result.warnings()).containsExactly("The scores differ by 50 runs, but the margin is 40 runs.");
    }

    @Test
    void wicketsMarginContradictingTheScoresWarns() {
        // away chased with 3 down, so won by 7 wickets, not 5
        ResultValidationDto result = validate(wonByWickets(ResultSide.AWAY, 5,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 151, 3)));
        assertThat(result.warnings()).containsExactly("Hillside lost 3 wickets, but the margin is 5 wickets.");
    }

    @Test
    void aMatchingWicketsMarginDoesNotWarn() {
        assertThat(validate(wonByWickets(ResultSide.AWAY, 7,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 151, 3))).warnings()).isEmpty();
    }

    @Test
    void aWinByRunsForTheSideThatBattedSecondWarns() {
        ResultValidationDto result = validate(wonByRuns(ResultSide.AWAY, 10,
                inn(ResultSide.HOME, 140, 10), inn(ResultSide.AWAY, 150, 5)));
        assertThat(result.warnings()).containsExactly("Hillside won by runs but batted second.");
    }

    @Test
    void aWinByWicketsForTheSideThatBattedFirstWarns() {
        ResultValidationDto result = validate(wonByWickets(ResultSide.HOME, 4,
                inn(ResultSide.HOME, 200, 8), inn(ResultSide.AWAY, 150, 10)));
        assertThat(result.warnings()).containsExactly("Riverside won by wickets but batted first.");
    }

    @Test
    void marginIsNotCheckedWhileTheInningsFiguresAreIncomplete() {
        // an innings without wickets or overs cannot be published, but no margin warning is layered on it
        ResultDraft d = wonByRuns(ResultSide.HOME, 40,
                new InningsDto(1, InningsKind.REGULAR, ResultSide.HOME, 200, null, null, null, null, null),
                inn(ResultSide.AWAY, 150, 10));
        ResultValidationDto result = validate(d);
        assertThat(result.warnings()).noneMatch(w -> w.contains("margin is"));
        assertThat(result.errors()).contains("Innings 1 needs runs, wickets and overs.");
    }

    // ---- level scores as a regular win ----

    @Test
    void levelScoresMarkedAsARegularWinWarn() {
        ResultValidationDto result = validate(wonByRuns(ResultSide.HOME, 1,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 150, 9)));
        assertThat(result.warnings()).containsExactly("The scores are level. Was it a tie, or decided in a super over?");
    }

    // ---- warning TIE_NOT_LEVEL ----

    @Test
    void aTieWithLevelScoresIsClean() {
        ResultValidationDto result = validate(draft(ResultOutcomeType.TIE, null, null, null, null,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 150, 8)));
        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings()).isEmpty();
    }

    @Test
    void aTieWithUnlevelScoresWarns() {
        ResultValidationDto result = validate(draft(ResultOutcomeType.TIE, null, null, null, null,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 140, 8)));
        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings())
                .containsExactly("The match is recorded as a tie but the two innings are not level.");
    }

    @Test
    void draw_noResult_andAbandoned_doNotNeedScores() {
        for (ResultOutcomeType o : new ResultOutcomeType[] {
            ResultOutcomeType.DRAW, ResultOutcomeType.NO_RESULT, ResultOutcomeType.ABANDONED}) {
            ResultValidationDto r = validate(draft(o, null, null, null, null));
            assertThat(r.errors()).isEmpty();
            assertThat(r.warnings()).isEmpty();
        }
    }

    // ---- missing innings ----

    @Test
    void aWinOrTieWithoutBothInningsWarns() {
        assertThat(validate(wonByRuns(ResultSide.HOME, 10, inn(ResultSide.HOME, 150, 10))).warnings())
                .contains("Both innings scores have not been entered.");
        assertThat(validate(draft(ResultOutcomeType.TIE, null, null, null, null)).warnings())
                .contains("Both innings scores have not been entered.");
    }

    // ---- super over ----

    private static ResultDraft superOverWin(ResultSide winner, InningsDto... innings) {
        return draft(ResultOutcomeType.WON, ResultDecidedBy.SUPER_OVER, winner, null, null, innings);
    }

    @Test
    void aValidSuperOverWinIsCleanAndNeedsNoMargin() {
        ResultValidationDto result = validate(superOverWin(ResultSide.AWAY,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 150, 9),
                innBalls(ResultSide.HOME, 8, 1, 6), innBalls(ResultSide.AWAY, 12, 0, 6)));
        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings()).isEmpty();
    }

    @Test
    void aSuperOverWinRejectsAMargin() {
        ResultDraft d = draft(ResultOutcomeType.WON, ResultDecidedBy.SUPER_OVER, ResultSide.AWAY,
                ResultMarginType.RUNS, 4,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 150, 9),
                innBalls(ResultSide.HOME, 8, 1, 6), innBalls(ResultSide.AWAY, 12, 0, 6));
        assertThat(validate(d).errors()).containsExactly("A win in a super over has no margin of runs or wickets.");
    }

    @Test
    void aSuperOverWinNeedsBothRegularInningsToBeLevel() {
        ResultValidationDto notLevel = validate(superOverWin(ResultSide.AWAY,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 140, 9),
                innBalls(ResultSide.HOME, 8, 1, 6), innBalls(ResultSide.AWAY, 12, 0, 6)));
        assertThat(notLevel.errors()).containsExactly("A win in a super over needs the regular innings to be level.");

        ResultValidationDto missing = validate(superOverWin(ResultSide.AWAY,
                inn(ResultSide.HOME, 150, 10),
                new InningsDto(3, InningsKind.SUPER_OVER, ResultSide.HOME, 8, 1, 6, null, null, null),
                new InningsDto(4, InningsKind.SUPER_OVER, ResultSide.AWAY, 12, 0, 6, null, null, null)));
        assertThat(missing.errors())
                .containsExactly("Enter both regular innings: a super over only follows level scores.");
    }

    @Test
    void aSuperOverWinNeedsAtLeastOneSuperOver() {
        ResultValidationDto result = validate(superOverWin(ResultSide.AWAY,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 150, 9)));
        assertThat(result.errors()).containsExactly("Enter at least one super over (both sides' innings).");
    }

    @Test
    void aSuperOverWinNeedsAnInningsFromEachSide() {
        ResultValidationDto result = validate(superOverWin(ResultSide.HOME,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 150, 9),
                innBalls(ResultSide.HOME, 8, 1, 6), innBalls(ResultSide.HOME, 12, 0, 6)));
        assertThat(result.errors()).containsExactly("Enter at least one super over (both sides' innings).");
    }

    @Test
    void aSuperOverWinNeedsAWinner() {
        ResultValidationDto result = validate(superOverWin(null,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 150, 9),
                innBalls(ResultSide.HOME, 8, 1, 6), innBalls(ResultSide.AWAY, 12, 0, 6)));
        assertThat(result.errors()).containsExactly("Choose which side won.");
    }

    @Test
    void aSuperOverWinnerWhoScoredLessWarns() {
        ResultValidationDto result = validate(superOverWin(ResultSide.HOME,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 150, 9),
                innBalls(ResultSide.HOME, 8, 1, 6), innBalls(ResultSide.AWAY, 12, 0, 6)));
        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings())
                .containsExactly("Hillside scored more in the super over, but Riverside is marked as the winner.");
    }

    @Test
    void aLevelSuperOverWarnsToAddAnother() {
        ResultValidationDto result = validate(superOverWin(ResultSide.HOME,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 150, 9),
                innBalls(ResultSide.HOME, 10, 1, 6), innBalls(ResultSide.AWAY, 10, 0, 6)));
        assertThat(result.warnings()).containsExactly("The super over is level too; add another super over.");
    }

    @Test
    void severalSuperOversAreSummedPerSide() {
        // first super over level at 10 each, second won 12 to 6: away leads 22 to 16
        ResultValidationDto result = validate(superOverWin(ResultSide.AWAY,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 150, 9),
                innBalls(ResultSide.HOME, 10, 1, 6), innBalls(ResultSide.AWAY, 10, 0, 6),
                innBalls(ResultSide.HOME, 6, 2, 6), innBalls(ResultSide.AWAY, 12, 0, 6)));
        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings()).isEmpty();
    }

    // ---- DLS ----

    @Test
    void aDlsWinMissingItsRevisedFiguresWarns() {
        ResultValidationDto result = validate(dls(ResultSide.AWAY, null, null,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 120, 8)));
        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings()).contains("The DLS revised target and revised overs have not been entered.");
    }

    @Test
    void aDlsWinStillNeedsAMargin() {
        ResultDraft d = new ResultDraft(ResultOutcomeType.WON, ResultDecidedBy.DLS, ResultSide.AWAY, null, null, 130, 90,
                null, null, null, null, null, null, List.of(inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 131, 8)));
        assertThat(validate(d).errors()).containsExactly("Enter the margin of victory (runs or wickets).");
    }

    @Test
    void aConsistentDlsWinIsClean() {
        ResultValidationDto result = validate(dls(ResultSide.AWAY, 130, 90,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 131, 8)));
        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings()).isEmpty();
    }

    @Test
    void aDlsChaserWhoMissedTheTargetButWonWarns() {
        ResultValidationDto result = validate(dls(ResultSide.AWAY, 130, 90,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 120, 8)));
        assertThat(result.warnings()).containsExactly("Hillside won chasing a DLS target of 130, but scored 120.");
    }

    @Test
    void aDlsChaserWhoReachedTheTargetButLostWarns() {
        ResultValidationDto result = validate(dls(ResultSide.HOME, 130, 90,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 131, 8)));
        assertThat(result.warnings())
                .containsExactly("Hillside reached the DLS target of 130, but Riverside is marked as the winner.");
    }

    @Test
    void aDlsWinIgnoresTheRegularMarginArithmetic() {
        // a margin that would contradict the raw scores in a regular match is not checked under DLS
        ResultValidationDto result = validate(dls(ResultSide.AWAY, 130, 90,
                inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 131, 1)));
        assertThat(result.warnings()).isEmpty();
    }

    // ---- toss, length, all-out ----

    @Test
    void tossContradictingTheBattingOrderWarns() {
        // home won the toss and chose to bat, but away batted first
        ResultDraft d = withToss(wonByRuns(ResultSide.AWAY, 50,
                inn(ResultSide.AWAY, 200, 8), inn(ResultSide.HOME, 150, 10)), ResultSide.HOME, TossDecision.BAT);
        assertThat(validate(d).warnings())
                .containsExactly("Riverside won the toss and chose to bat, but Hillside batted first.");
    }

    @Test
    void aConsistentTossDoesNotWarn() {
        ResultDraft chooseBowl = withToss(cleanWinByRuns(), ResultSide.AWAY, TossDecision.BOWL);
        assertThat(validate(chooseBowl).warnings()).isEmpty();
        ResultDraft chooseBat = withToss(cleanWinByRuns(), ResultSide.HOME, TossDecision.BAT);
        assertThat(validate(chooseBat).warnings()).isEmpty();
    }

    @Test
    void anIncompleteTossIsNotChecked() {
        ResultDraft d = withToss(cleanWinByRuns(), ResultSide.AWAY, null);
        assertThat(validate(d).warnings()).isEmpty();
    }

    @Test
    void anInningsLongerThanScheduledWarnsWithOversDisplay() {
        // scheduled 20 overs (120 balls); the home innings is 20.1
        ResultDraft d = withScheduled(wonByRuns(ResultSide.HOME, 50,
                innBalls(ResultSide.HOME, 200, 8, 121), inn(ResultSide.AWAY, 150, 10)), 120);
        assertThat(validate(d).warnings()).containsExactly("Innings 1 is longer than the scheduled 20.0 overs.");
    }

    @Test
    void anInningsWithinTheScheduledLengthDoesNotWarn() {
        assertThat(validate(withScheduled(cleanWinByRuns(), 120)).warnings()).isEmpty();
    }

    @Test
    void allOutWithFewerThanTenWicketsWarns() {
        ResultDraft d = wonByRuns(ResultSide.HOME, 50,
                new InningsDto(1, InningsKind.REGULAR, ResultSide.HOME, 200, 8, 120, null, null, null),
                new InningsDto(2, InningsKind.REGULAR, ResultSide.AWAY, 150, 7, 120, null, true, null));
        assertThat(validate(d).warnings()).containsExactly("Innings 2 is marked all out with 7 wickets.");
    }

    // ---- partial drafts ----

    @Test
    void aPartialWinDraftValidatesWithoutErrorsButWarnsAboutMissingScores() {
        ResultValidationDto result = validate(wonByRuns(ResultSide.HOME, 20));
        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings()).containsExactly("Both innings scores have not been entered.");
        assertThat(result.canPublish()).isTrue();
    }

    @Test
    void aPartialDraftWithOnlyOneInningsDoesNotThrow() {
        ResultValidationDto result = validate(draft(ResultOutcomeType.WON, null, ResultSide.HOME,
                ResultMarginType.RUNS, 20, inn(ResultSide.HOME, 200, 8)));
        assertThat(result.errors()).isEmpty();
    }

    @Test
    void structuralErrorsAreIncludedInValidate() {
        ResultValidationDto result = validate(wonByWickets(ResultSide.HOME, 11));
        assertThat(result.errors()).contains("A win by wickets cannot be by more than 10 wickets.");
        assertThat(result.canPublish()).isFalse();
    }
}
