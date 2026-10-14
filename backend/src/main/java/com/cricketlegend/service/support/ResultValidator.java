package com.cricketlegend.service.support;

import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultWizardStep;
import com.cricketlegend.domain.TossDecision;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultValidationDto;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * docs/specs/100-match-results-core.md: the one place the result rules live (shared by save, validate and publish,
 * never repeated in the wizard).
 *
 * <p>{@link #structuralErrors} is what every <em>save</em> enforces: the draft is malformed (a negative number, a
 * wicket count out of range, innings out of order). A draft that is merely incomplete is fine. {@link #validate} adds
 * the outcome-rule matrix and returns <em>errors</em> (block publishing) and <em>warnings</em> (acknowledged at
 * publish: the scores contradict the margin, the toss contradicts the batting order, and similar, where the official
 * scorer's word wins). All messages are plain English with the side's real name.
 *
 * <p>docs/specs/101: every issue is a typed {@link com.cricketlegend.dto.ResultIssueDto} (stable {@code code}, wizard
 * {@code step}, scorecard {@code side}, severity); the plain string lists of the response are the same messages. The
 * scorecard rules live in {@link ScorecardRules}, run from here so save, validate, publish and imports share them.
 */
@Component
public class ResultValidator {

    static final int MAX_WICKETS = 10;
    static final int MAX_SUPER_OVER_WICKETS = 2;
    static final int MAX_BALLS_PER_OVER = 12;

    /** Structural problems only; what a save refuses. */
    public List<String> structuralErrors(ResultDraft draft) {
        return structuralIssues(draft).errorMessages();
    }

    /** Structural issues with their codes, steps and sides (docs/specs/101): what a save refuses, as typed issues. */
    public List<com.cricketlegend.dto.ResultIssueDto> structuralIssueList(ResultDraft draft) {
        return structuralIssues(draft, "", "", ScorecardContext.none()).all();
    }

    /** As above, naming the sides and players in the scorecard messages. */
    public List<com.cricketlegend.dto.ResultIssueDto> structuralIssueList(
            ResultDraft draft, String homeName, String awayName, ScorecardContext context) {
        return structuralIssues(draft, homeName, awayName, context).all();
    }

    private ResultIssues structuralIssues(ResultDraft draft) {
        return structuralIssues(draft, "", "", ScorecardContext.none());
    }

    private ResultIssues structuralIssues(
            ResultDraft draft, String homeName, String awayName, ScorecardContext context) {
        ResultIssues issues = new ResultIssues();
        if (draft.ballsPerOver() < 1 || draft.ballsPerOver() > MAX_BALLS_PER_OVER) {
            issues.error(ErrorCode.BALLS_PER_OVER_INVALID, ResultWizardStep.SCORES, null,
                    "Balls per over must be between 1 and " + MAX_BALLS_PER_OVER + ".");
        }
        nonNegative(issues, draft.marginValue(), "The margin");
        nonNegative(issues, draft.dlsTarget(), "The DLS target");
        nonNegative(issues, draft.dlsRevisedBalls(), "The DLS revised length");
        if (draft.scheduledBalls() != null && draft.scheduledBalls() < 1) {
            issues.error(ErrorCode.SCHEDULED_LENGTH_INVALID, ResultWizardStep.SCORES, null,
                    "The scheduled length must be at least one ball.");
        }
        if (draft.marginType() == ResultMarginType.WICKETS && draft.marginValue() != null
                && draft.marginValue() > MAX_WICKETS) {
            issues.error(ErrorCode.WICKETS_MARGIN_TOO_HIGH, ResultWizardStep.RESULT, null,
                    "A win by wickets cannot be by more than " + MAX_WICKETS + " wickets.");
        }
        inningsStructure(draft, issues);
        ScorecardRules.structure(draft, homeName, awayName, context, issues);
        return issues;
    }

    /** Structural errors plus the outcome-rule matrix; warnings never block. */
    public ResultValidationDto validate(ResultDraft draft, String homeName, String awayName) {
        return validate(draft, homeName, awayName, ScorecardContext.none());
    }

    /** As {@link #validate(ResultDraft, String, String)}, with the context the scorecard rules need (docs/specs/101). */
    public ResultValidationDto validate(
            ResultDraft draft, String homeName, String awayName, ScorecardContext context) {
        ResultIssues issues = structuralIssues(draft, homeName, awayName, context);
        Names names = new Names(homeName, awayName);

        ResultOutcomeType outcome = draft.outcomeType();
        if (outcome == null) {
            issues.error(ErrorCode.OUTCOME_MISSING, ResultWizardStep.RESULT, null, "Choose how the match ended.");
            // a team list saved before the game has no outcome yet; its own checks still apply
            ScorecardRules.validate(draft, null, homeName, awayName, context, issues);
            return ResultValidationDto.of(issues.all());
        }
        if (draft.decidedBy() != ResultDecidedBy.REGULAR && outcome != ResultOutcomeType.WON) {
            issues.error(ErrorCode.DECIDED_BY_NOT_A_WIN, ResultWizardStep.RESULT, null,
                    "Only a win can be decided by DLS or a super over.");
        }
        switch (outcome) {
            case WON -> validateWon(draft, names, issues);
            case FORFEIT -> validateForfeit(draft, issues);
            case TIE -> validateNoWinner(draft, "A tie", issues);
            case DRAW -> validateNoWinner(draft, "A draw", issues);
            case NO_RESULT -> validateNoWinner(draft, "A no result", issues);
            case ABANDONED -> validateNoWinner(draft, "An abandoned match", issues);
            default -> throw new IllegalStateException("Unhandled outcome " + outcome);
        }
        if (outcome == ResultOutcomeType.TIE) {
            warnIfRegularInningsNotLevel(draft, issues);
        }
        if (outcome == ResultOutcomeType.WON || outcome == ResultOutcomeType.TIE) {
            if (regular(draft).size() < 2 && draft.decidedBy() != ResultDecidedBy.SUPER_OVER) {
                issues.warning(WarningCode.INNINGS_NOT_ENTERED, ResultWizardStep.SCORES, null,
                        "Both innings scores have not been entered.");
            }
        }
        warnOnTossVersusOrder(draft, names, issues);
        warnOnInningsLength(draft, issues);
        ScorecardRules.validate(draft, outcome, homeName, awayName, context, issues);
        return ResultValidationDto.of(issues.all());
    }

    // ---- outcome matrix ----

    private void validateWon(ResultDraft draft, Names names, ResultIssues issues) {
        if (draft.winningSide() == null) {
            issues.error(ErrorCode.WINNER_MISSING, ResultWizardStep.RESULT, null, "Choose which side won.");
        }
        if (draft.decidedBy() == ResultDecidedBy.SUPER_OVER) {
            validateSuperOverWin(draft, names, issues);
            return;
        }
        if (draft.marginType() == null || draft.marginValue() == null) {
            issues.error(ErrorCode.MARGIN_MISSING, ResultWizardStep.RESULT, null, "Enter the margin of victory (runs or wickets).");
        } else if (draft.marginValue() < 1) {
            issues.error(ErrorCode.MARGIN_TOO_SMALL, ResultWizardStep.RESULT, null, "The margin of victory must be at least 1.");
        }
        if (draft.decidedBy() == ResultDecidedBy.DLS && (draft.dlsTarget() == null || draft.dlsRevisedBalls() == null)) {
            issues.warning(WarningCode.DLS_DETAILS_MISSING, ResultWizardStep.RESULT, null, "The DLS revised target and revised overs have not been entered.");
        }
        if (draft.decidedBy() == ResultDecidedBy.DLS) {
            warnOnDlsVersusScores(draft, names, issues);
        } else if (draft.decidedBy() == ResultDecidedBy.REGULAR) {
            warnOnWinnerVersusScores(draft, names, issues);
        }
    }

    private void validateSuperOverWin(ResultDraft draft, Names names, ResultIssues issues) {
        if (draft.marginType() != null || draft.marginValue() != null) {
            issues.error(ErrorCode.SUPER_OVER_HAS_MARGIN, ResultWizardStep.RESULT, null, "A win in a super over has no margin of runs or wickets.");
        }
        List<InningsDto> regular = regular(draft);
        if (regular.size() < 2) {
            issues.error(ErrorCode.SUPER_OVER_REGULAR_INNINGS_MISSING, ResultWizardStep.SCORES, null, "Enter both regular innings: a super over only follows level scores.");
        } else if (!level(regular)) {
            issues.error(ErrorCode.SUPER_OVER_NOT_LEVEL, ResultWizardStep.SCORES, null, "A win in a super over needs the regular innings to be level.");
        }
        List<InningsDto> superOvers = superOvers(draft);
        boolean homeBatted = superOvers.stream().anyMatch(i -> i.battingSide() == ResultSide.HOME);
        boolean awayBatted = superOvers.stream().anyMatch(i -> i.battingSide() == ResultSide.AWAY);
        if (!homeBatted || !awayBatted) {
            issues.error(ErrorCode.SUPER_OVER_INNINGS_MISSING, ResultWizardStep.SCORES, null, "Enter at least one super over (both sides' innings).");
        }
        warnOnSuperOverWinner(draft, names, issues);
    }

    private void validateForfeit(ResultDraft draft, ResultIssues issues) {
        if (draft.winningSide() == null) {
            issues.error(ErrorCode.WINNER_MISSING, ResultWizardStep.RESULT, null, "Choose which side received the win.");
        }
        if (draft.marginType() != null || draft.marginValue() != null) {
            issues.error(ErrorCode.MARGIN_NOT_EXPECTED, ResultWizardStep.RESULT, null, "A forfeit has no margin of victory.");
        }
    }

    private void validateNoWinner(ResultDraft draft, String what, ResultIssues issues) {
        if (draft.winningSide() != null) {
            issues.error(ErrorCode.WINNER_NOT_EXPECTED, ResultWizardStep.RESULT, null, what + " has no winning side.");
        }
        if (draft.marginType() != null || draft.marginValue() != null) {
            issues.error(ErrorCode.MARGIN_NOT_EXPECTED, ResultWizardStep.RESULT, null, what + " has no margin of victory.");
        }
    }

    // ---- warnings ----

    /**
     * Stable identifiers for the warnings (and the one info line). Each issue in the response carries its code (docs/
     * specs/101), so the Review step never matches on message text; each rule's message texts are fixed and distinct.
     */
    public enum WarningCode {
        WINNER_NOT_HIGHER_SCORER,
        MARGIN_MISMATCH,
        TIE_NOT_LEVEL,
        SCORES_LEVEL_NOT_TIE,
        SUPER_OVER_WINNER_MISMATCH,
        SUPER_OVER_LEVEL,
        DLS_WINNER_MISMATCH,
        DLS_DETAILS_MISSING,
        INNINGS_NOT_ENTERED,
        TOSS_BATTING_ORDER_MISMATCH,
        INNINGS_LONGER_THAN_SCHEDULED,
        ALL_OUT_WICKETS_MISMATCH,
        // ---- docs/specs/101: our side's scorecard against the result ----
        BATTERS_OUT_NOT_WICKETS,
        NOT_OUT_COUNT,
        BATTING_TOTAL_MISMATCH,
        BOWLER_BALLS_MISMATCH,
        BOWLING_RUNS_MISMATCH,
        BOWLER_WICKETS_MISMATCH,
        FIELDING_EXCEEDS_WICKETS,
        WIDES_MISMATCH,
        NO_BALLS_MISMATCH,
        BOWLER_OVERS_EXCEED_LIMIT,
        LINEUP_TOO_LARGE,
        PLAYER_NOT_IN_SQUAD,
        GUEST_NAME_MATCHES_PLAYER,
        PLAYER_ON_BOTH_SIDES,
        DISMISSAL_BOWLER_NOT_IN_BOWLING_LIST,
        BOWLER_WICKETS_DIFFER_FROM_DISMISSALS,
        FIELDING_DIFFERS_FROM_DISMISSALS,
        /** Reported with severity INFO: never blocks, nothing to acknowledge. */
        GUEST_ON_BOTH_SIDES,
        /** Reported with severity INFO: our team has no (announced, full) selection; friendlies are normal. */
        OUR_TEAM_NOT_SELECTED
    }

    /** Stable identifiers for the errors (docs/specs/101): the rules that block a save or a publish. */
    public enum ErrorCode {
        // result and innings (docs/specs/100)
        BALLS_PER_OVER_INVALID,
        SCHEDULED_LENGTH_INVALID,
        WICKETS_MARGIN_TOO_HIGH,
        NEGATIVE_FIGURE,
        INNINGS_NUMBER_DUPLICATE,
        INNINGS_NUMBER_INVALID,
        INNINGS_KIND_INVALID,
        INNINGS_BATTING_SIDE_MISSING,
        INNINGS_FIGURES_MISSING,
        INNINGS_FIGURES_NEGATIVE,
        INNINGS_WICKETS_TOO_MANY,
        TOO_MANY_REGULAR_INNINGS,
        EXTRAS_TOTAL_MISMATCH,
        OUTCOME_MISSING,
        DECIDED_BY_NOT_A_WIN,
        WINNER_MISSING,
        WINNER_NOT_EXPECTED,
        MARGIN_MISSING,
        MARGIN_TOO_SMALL,
        MARGIN_NOT_EXPECTED,
        SUPER_OVER_HAS_MARGIN,
        SUPER_OVER_REGULAR_INNINGS_MISSING,
        SUPER_OVER_NOT_LEVEL,
        SUPER_OVER_INNINGS_MISSING,
        // our side's scorecard (docs/specs/101)
        SCORECARD_SUPER_OVER_NOT_SUPPORTED,
        SCORECARD_INNINGS_MISSING,
        SCORECARD_PLAYER_KEY_MISSING,
        SCORECARD_PLAYER_KEY_DUPLICATE,
        SCORECARD_PLAYER_SIDE_MISSING,
        SCORECARD_PLAYER_IDENTITY_MISSING,
        SCORECARD_PLAYER_DUPLICATE,
        SCORECARD_PLAYER_UNKNOWN,
        SCORECARD_PLAYER_SIDE_MISMATCH,
        SCORECARD_DUPLICATE_ENTRY,
        SCORECARD_NEGATIVE_FIGURE,
        SCORECARD_POSITION_INVALID,
        SCORECARD_POSITION_DUPLICATE,
        SCORECARD_HOW_OUT_MISSING,
        SCORECARD_PLAYER_NOT_OURS,
        SCORECARD_PLAYER_OTHER_CLUB,
        BATTER_RUNS_MISSING,
        BOUNDARIES_EXCEED_RUNS,
        DID_NOT_BAT_WITH_FIGURES,
        MAIDENS_EXCEED_OVERS,
        AWARD_PLAYER_MISSING,
        AWARD_DUPLICATE_OFFICIAL,
        AWARD_DUPLICATE_TEAM,
        AWARD_SIDE_NOT_OURS,
        DOTS_EXCEED_BALLS,
        // the opposition and the dismissals (docs/specs/101, formerly 102)
        OPPOSITION_NOT_ALLOWED,
        OPPOSITION_PLAYER_INVALID,
        OPPOSITION_NO_STANDOUTS,
        OPPOSITION_WITHOUT_OUR_SCORECARD,
        DISMISSAL_DETAIL_NOT_ALLOWED,
        DISMISSAL_PLAYER_WRONG_SIDE
    }

    /** Regular win (not DLS, not super over): level scores, the wrong winner, then the margin, each reported once. */
    private void warnOnWinnerVersusScores(ResultDraft draft, Names names, ResultIssues issues) {
        List<InningsDto> regular = regularInOrder(draft);
        if (regular.size() < 2 || !scored(regular.get(0)) || !scored(regular.get(1))) {
            return;
        }
        InningsDto first = regular.get(0);
        InningsDto second = regular.get(1);
        if (first.runs().equals(second.runs())) {
            // WARNING TIE_NOT_LEVEL (the other direction): level scores entered as a regular win.
            issues.warning(WarningCode.SCORES_LEVEL_NOT_TIE, ResultWizardStep.SCORES, null, "The scores are level. Was it a tie, or decided in a super over?");
            return;
        }
        if (draft.winningSide() == null) {
            return;
        }
        ResultSide better = first.runs() > second.runs() ? first.battingSide() : second.battingSide();
        if (draft.winningSide() != better) {
            // WARNING WINNER_NOT_HIGHER_SCORER; the margin is relative to the winner, so it is not checked as well.
            issues.warning(WarningCode.WINNER_NOT_HIGHER_SCORER, ResultWizardStep.RESULT, null, names.of(better) + " scored more, but " + names.of(draft.winningSide())
                    + " is marked as the winner.");
            return;
        }
        if (draft.marginType() != null && draft.marginValue() != null && complete(first) && complete(second)) {
            warnOnMarginVersusScores(draft, names, issues);
        }
    }

    /** Super over win: the side with more super-over runs must be the one marked as the winner. */
    private void warnOnSuperOverWinner(ResultDraft draft, Names names, ResultIssues issues) {
        int home = 0;
        int away = 0;
        int count = 0;
        for (InningsDto i : superOvers(draft)) {
            if (!scored(i)) {
                continue;
            }
            count++;
            if (i.battingSide() == ResultSide.HOME) {
                home += i.runs();
            } else {
                away += i.runs();
            }
        }
        if (count < 2 || draft.winningSide() == null) {
            return;
        }
        if (home == away) {
            issues.warning(WarningCode.SUPER_OVER_LEVEL, ResultWizardStep.SCORES, null, "The super over is level too; add another super over.");
            return;
        }
        ResultSide better = home > away ? ResultSide.HOME : ResultSide.AWAY;
        if (draft.winningSide() != better) {
            issues.warning(WarningCode.SUPER_OVER_WINNER_MISMATCH, ResultWizardStep.RESULT, null, names.of(better) + " scored more in the super over, but " + names.of(draft.winningSide())
                    + " is marked as the winner.");
        }
    }

    /** DLS win: no margin arithmetic, only whether the winner fits the revised target (as the wizard checks). */
    private void warnOnDlsVersusScores(ResultDraft draft, Names names, ResultIssues issues) {
        List<InningsDto> regular = regularInOrder(draft);
        if (draft.dlsTarget() == null || draft.winningSide() == null || regular.size() < 2
                || !scored(regular.get(0)) || !scored(regular.get(1))) {
            return;
        }
        InningsDto second = regular.get(1);
        ResultSide winner = draft.winningSide();
        boolean chaserWon = winner == second.battingSide();
        boolean reached = second.runs() >= draft.dlsTarget();
        if (chaserWon && !reached) {
            issues.warning(WarningCode.DLS_WINNER_MISMATCH, ResultWizardStep.RESULT, null, names.of(winner) + " won chasing a DLS target of " + draft.dlsTarget() + ", but scored "
                    + second.runs() + ".");
        } else if (!chaserWon && reached) {
            issues.warning(WarningCode.DLS_WINNER_MISMATCH, ResultWizardStep.RESULT, null, names.of(second.battingSide()) + " reached the DLS target of " + draft.dlsTarget() + ", but "
                    + names.of(winner) + " is marked as the winner.");
        }
    }

    /** WARNING MARGIN_MISMATCH: the entered margin type/value disagrees with the scores. */
    private void warnOnMarginVersusScores(ResultDraft draft, Names names, ResultIssues issues) {
        List<InningsDto> regular = regularInOrder(draft);
        InningsDto first = regular.get(0);
        InningsDto second = regular.get(1);
        ResultSide winner = draft.winningSide();
        InningsDto winnerInnings = first.battingSide() == winner ? first : second;
        InningsDto loserInnings = winnerInnings == first ? second : first;
        if (draft.marginType() == ResultMarginType.RUNS) {
            if (first.battingSide() != winner) {
                issues.warning(WarningCode.MARGIN_MISMATCH, ResultWizardStep.RESULT, null, names.of(winner) + " won by runs but batted second.");
            } else if (winnerInnings.runs() - loserInnings.runs() != draft.marginValue()) {
                issues.warning(WarningCode.MARGIN_MISMATCH, ResultWizardStep.RESULT, null, "The scores differ by " + (winnerInnings.runs() - loserInnings.runs())
                        + " runs, but the margin is " + draft.marginValue() + " runs.");
            }
        } else if (draft.marginType() == ResultMarginType.WICKETS) {
            if (first.battingSide() == winner) {
                issues.warning(WarningCode.MARGIN_MISMATCH, ResultWizardStep.RESULT, null, names.of(winner) + " won by wickets but batted first.");
            } else if (MAX_WICKETS - winnerInnings.wickets() != draft.marginValue()) {
                issues.warning(WarningCode.MARGIN_MISMATCH, ResultWizardStep.RESULT, null, names.of(winner) + " lost " + winnerInnings.wickets()
                        + " wickets, but the margin is " + draft.marginValue() + " wickets.");
            }
        }
    }

    /** WARNING TIE_NOT_LEVEL: recorded as a tie but the regular scores differ. */
    private void warnIfRegularInningsNotLevel(ResultDraft draft, ResultIssues issues) {
        List<InningsDto> regular = regularInOrder(draft);
        if (regular.size() == 2 && complete(regular.get(0)) && complete(regular.get(1)) && !level(regular)) {
            issues.warning(WarningCode.TIE_NOT_LEVEL, ResultWizardStep.RESULT, null, "The match is recorded as a tie but the two innings are not level.");
        }
    }

    private void warnOnTossVersusOrder(ResultDraft draft, Names names, ResultIssues issues) {
        List<InningsDto> regular = regular(draft);
        if (draft.tossWonBy() == null || draft.tossDecision() == null || regular.isEmpty()
                || regular.get(0).battingSide() == null) {
            return;
        }
        ResultSide expectedFirst = draft.tossDecision() == TossDecision.BAT ? draft.tossWonBy() : other(draft.tossWonBy());
        if (regular.get(0).battingSide() != expectedFirst) {
            issues.warning(WarningCode.TOSS_BATTING_ORDER_MISMATCH, ResultWizardStep.TOSS, null, names.of(draft.tossWonBy()) + " won the toss and chose to "
                    + (draft.tossDecision() == TossDecision.BAT ? "bat" : "bowl") + ", but "
                    + names.of(regular.get(0).battingSide()) + " batted first.");
        }
    }

    private void warnOnInningsLength(ResultDraft draft, ResultIssues issues) {
        for (InningsDto innings : regular(draft)) {
            if (!complete(innings)) {
                continue;
            }
            if (draft.scheduledBalls() != null && innings.balls() > draft.scheduledBalls()) {
                issues.warning(WarningCode.INNINGS_LONGER_THAN_SCHEDULED, ResultWizardStep.SCORES, null, "Innings " + innings.sequence() + " is longer than the scheduled "
                        + OversFormat.display(draft.scheduledBalls(), draft.ballsPerOver()) + " overs.");
            }
            if (Boolean.TRUE.equals(innings.allOut()) && innings.wickets() < MAX_WICKETS) {
                // Fewer than eleven batters is legitimate; the all-out flag is the scorer's word, so only say so.
                issues.warning(WarningCode.ALL_OUT_WICKETS_MISMATCH, ResultWizardStep.SCORES, null, "Innings " + innings.sequence() + " is marked all out with " + innings.wickets() + " wickets.");
            }
        }
    }

    // ---- structure ----

    private void inningsStructure(ResultDraft draft, ResultIssues issues) {
        Set<Integer> sequences = new HashSet<>();
        int regularCount = 0;
        for (InningsDto i : draft.innings()) {
            String label = "Innings " + i.sequence();
            if (!sequences.add(i.sequence())) {
                issues.error(ErrorCode.INNINGS_NUMBER_DUPLICATE, ResultWizardStep.SCORES, null, "Two innings share the number " + i.sequence() + ".");
            }
            if (i.sequence() < 1) {
                issues.error(ErrorCode.INNINGS_NUMBER_INVALID, ResultWizardStep.SCORES, null, "Innings numbers start at 1.");
            }
            if (i.kind() == InningsKind.REGULAR) {
                regularCount++;
                if (i.sequence() > 2) {
                    issues.error(ErrorCode.INNINGS_KIND_INVALID, ResultWizardStep.SCORES, null, label + " cannot be a regular innings: only innings 1 and 2 are.");
                }
            } else if (i.sequence() < 3) {
                issues.error(ErrorCode.INNINGS_KIND_INVALID, ResultWizardStep.SCORES, null, label + " cannot be a super over: super overs follow the two regular innings.");
            }
            if (i.battingSide() == null) {
                issues.error(ErrorCode.INNINGS_BATTING_SIDE_MISSING, ResultWizardStep.SCORES, null, label + " needs the batting side.");
            }
            if (i.runs() == null || i.wickets() == null || i.balls() == null) {
                issues.error(ErrorCode.INNINGS_FIGURES_MISSING, ResultWizardStep.SCORES, null, label + " needs runs, wickets and overs.");
                continue;
            }
            if (i.runs() < 0 || i.balls() < 0 || i.wickets() < 0 || negative(i.extras()) || negative(i.wides())
                    || negative(i.noBalls()) || negative(i.byes()) || negative(i.legByes()) || negative(i.penaltyRuns())
                    || negative(i.nonBowlerWickets())) {
                issues.error(ErrorCode.INNINGS_FIGURES_NEGATIVE, ResultWizardStep.SCORES, null, label + " cannot have negative figures.");
            }
            if (i.hasExtrasBreakdown() && i.extras() != null && i.extras() != i.extrasBreakdownTotal()) {
                issues.error(ErrorCode.EXTRAS_TOTAL_MISMATCH, ResultWizardStep.SCORES, null,
                        label + " extras of " + i.extras() + " do not equal wides, no-balls, byes, leg byes and penalty"
                                + " runs, which make " + i.extrasBreakdownTotal() + ".");
            }
            int maxWickets = i.kind() == InningsKind.SUPER_OVER ? MAX_SUPER_OVER_WICKETS : MAX_WICKETS;
            if (i.wickets() > maxWickets) {
                issues.error(ErrorCode.INNINGS_WICKETS_TOO_MANY, ResultWizardStep.SCORES, null, label + " cannot have more than " + maxWickets + " wickets.");
            }
        }
        if (regularCount > 2) {
            issues.error(ErrorCode.TOO_MANY_REGULAR_INNINGS, ResultWizardStep.SCORES, null, "A match has at most two regular innings.");
        }
    }

    private void nonNegative(ResultIssues issues, Integer value, String what) {
        if (value != null && value < 0) {
            issues.error(ErrorCode.NEGATIVE_FIGURE, ResultWizardStep.RESULT, null, what + " cannot be negative.");
        }
    }

    private static boolean negative(Integer value) {
        return value != null && value < 0;
    }

    private List<InningsDto> regular(ResultDraft draft) {
        return draft.innings().stream().filter(i -> i.kind() == InningsKind.REGULAR).toList();
    }

    private List<InningsDto> regularInOrder(ResultDraft draft) {
        return regular(draft).stream().sorted(Comparator.comparingInt(InningsDto::sequence)).toList();
    }

    private boolean scored(InningsDto i) {
        return i.runs() != null && i.battingSide() != null;
    }

    private List<InningsDto> superOvers(ResultDraft draft) {
        return draft.innings().stream().filter(i -> i.kind() == InningsKind.SUPER_OVER).toList();
    }

    private boolean complete(InningsDto i) {
        return i.runs() != null && i.wickets() != null && i.balls() != null && i.battingSide() != null;
    }

    private boolean level(List<InningsDto> two) {
        return two.stream().allMatch(this::complete) && two.get(0).runs().equals(two.get(1).runs());
    }

    private static ResultSide other(ResultSide side) {
        return side == ResultSide.HOME ? ResultSide.AWAY : ResultSide.HOME;
    }

    private record Names(String home, String away) {
        String of(ResultSide side) {
            String name = side == ResultSide.HOME ? home : away;
            return name == null || name.isBlank() ? (side == ResultSide.HOME ? "The home side" : "The away side") : name;
        }
    }
}
