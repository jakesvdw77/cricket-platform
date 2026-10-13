package com.cricketlegend.service.support;

import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.TossDecision;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultValidationDto;
import java.util.ArrayList;
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
 */
@Component
public class ResultValidator {

    static final int MAX_WICKETS = 10;
    static final int MAX_SUPER_OVER_WICKETS = 2;
    static final int MAX_BALLS_PER_OVER = 12;

    /** Structural problems only; what a save refuses. */
    public List<String> structuralErrors(ResultDraft draft) {
        List<String> errors = new ArrayList<>();
        if (draft.ballsPerOver() < 1 || draft.ballsPerOver() > MAX_BALLS_PER_OVER) {
            errors.add("Balls per over must be between 1 and " + MAX_BALLS_PER_OVER + ".");
        }
        nonNegative(errors, draft.marginValue(), "The margin");
        nonNegative(errors, draft.dlsTarget(), "The DLS target");
        nonNegative(errors, draft.dlsRevisedBalls(), "The DLS revised length");
        if (draft.scheduledBalls() != null && draft.scheduledBalls() < 1) {
            errors.add("The scheduled length must be at least one ball.");
        }
        if (draft.marginType() == ResultMarginType.WICKETS && draft.marginValue() != null
                && draft.marginValue() > MAX_WICKETS) {
            errors.add("A win by wickets cannot be by more than " + MAX_WICKETS + " wickets.");
        }
        inningsStructure(draft, errors);
        return errors;
    }

    /** Structural errors plus the outcome-rule matrix; warnings never block. */
    public ResultValidationDto validate(ResultDraft draft, String homeName, String awayName) {
        List<String> errors = new ArrayList<>(structuralErrors(draft));
        List<String> warnings = new ArrayList<>();
        Names names = new Names(homeName, awayName);

        ResultOutcomeType outcome = draft.outcomeType();
        if (outcome == null) {
            errors.add("Choose how the match ended.");
            return new ResultValidationDto(errors, warnings);
        }
        if (draft.decidedBy() != ResultDecidedBy.REGULAR && outcome != ResultOutcomeType.WON) {
            errors.add("Only a win can be decided by DLS or a super over.");
        }
        switch (outcome) {
            case WON -> validateWon(draft, names, errors, warnings);
            case FORFEIT -> validateForfeit(draft, names, errors);
            case TIE -> validateNoWinner(draft, "A tie", errors);
            case DRAW -> validateNoWinner(draft, "A draw", errors);
            case NO_RESULT -> validateNoWinner(draft, "A no result", errors);
            case ABANDONED -> validateNoWinner(draft, "An abandoned match", errors);
            default -> throw new IllegalStateException("Unhandled outcome " + outcome);
        }
        if (outcome == ResultOutcomeType.TIE) {
            warnIfRegularInningsNotLevel(draft, warnings);
        }
        if (outcome == ResultOutcomeType.WON || outcome == ResultOutcomeType.TIE) {
            if (regular(draft).size() < 2 && draft.decidedBy() != ResultDecidedBy.SUPER_OVER) {
                warnings.add("Both innings scores have not been entered.");
            }
        }
        warnOnTossVersusOrder(draft, names, warnings);
        warnOnInningsLength(draft, warnings);
        return new ResultValidationDto(errors, warnings);
    }

    // ---- outcome matrix ----

    private void validateWon(ResultDraft draft, Names names, List<String> errors, List<String> warnings) {
        if (draft.winningSide() == null) {
            errors.add("Choose which side won.");
        }
        if (draft.decidedBy() == ResultDecidedBy.SUPER_OVER) {
            validateSuperOverWin(draft, errors);
            return;
        }
        if (draft.marginType() == null || draft.marginValue() == null) {
            errors.add("Enter the margin of victory (runs or wickets).");
        } else if (draft.marginValue() < 1) {
            errors.add("The margin of victory must be at least 1.");
        }
        if (draft.decidedBy() == ResultDecidedBy.DLS && (draft.dlsTarget() == null || draft.dlsRevisedBalls() == null)) {
            warnings.add("The DLS revised target and revised overs have not been entered.");
        }
        if (draft.decidedBy() == ResultDecidedBy.REGULAR && draft.winningSide() != null
                && draft.marginType() != null && draft.marginValue() != null) {
            warnOnMarginVersusScores(draft, names, warnings);
        }
    }

    private void validateSuperOverWin(ResultDraft draft, List<String> errors) {
        if (draft.marginType() != null || draft.marginValue() != null) {
            errors.add("A win in a super over has no margin of runs or wickets.");
        }
        List<InningsDto> regular = regular(draft);
        if (regular.size() < 2) {
            errors.add("Enter both regular innings: a super over only follows level scores.");
        } else if (!level(regular)) {
            errors.add("A win in a super over needs the regular innings to be level.");
        }
        if (superOvers(draft).size() < 2) {
            errors.add("Enter at least one super over (both sides' innings).");
        }
    }

    private void validateForfeit(ResultDraft draft, Names names, List<String> errors) {
        if (draft.winningSide() == null) {
            errors.add("Choose which side received the win.");
        }
        if (draft.marginType() != null || draft.marginValue() != null) {
            errors.add("A forfeit has no margin of victory.");
        }
    }

    private void validateNoWinner(ResultDraft draft, String what, List<String> errors) {
        if (draft.winningSide() != null) {
            errors.add(what + " has no winning side.");
        }
        if (draft.marginType() != null || draft.marginValue() != null) {
            errors.add(what + " has no margin of victory.");
        }
    }

    // ---- warnings ----

    private void warnOnMarginVersusScores(ResultDraft draft, Names names, List<String> warnings) {
        List<InningsDto> regular = regular(draft);
        if (regular.size() < 2 || !complete(regular.get(0)) || !complete(regular.get(1))) {
            return;
        }
        InningsDto first = regular.get(0);
        InningsDto second = regular.get(1);
        ResultSide winner = draft.winningSide();
        InningsDto winnerInnings = first.battingSide() == winner ? first : second;
        InningsDto loserInnings = winnerInnings == first ? second : first;
        if (draft.marginType() == ResultMarginType.RUNS) {
            if (first.battingSide() != winner) {
                warnings.add(names.of(winner) + " won by runs but batted second.");
            } else if (winnerInnings.runs() - loserInnings.runs() != draft.marginValue()) {
                warnings.add("The scores differ by " + (winnerInnings.runs() - loserInnings.runs())
                        + " runs, but the margin is " + draft.marginValue() + " runs.");
            }
        } else if (draft.marginType() == ResultMarginType.WICKETS) {
            if (first.battingSide() == winner) {
                warnings.add(names.of(winner) + " won by wickets but batted first.");
            } else if (MAX_WICKETS - winnerInnings.wickets() != draft.marginValue()) {
                warnings.add(names.of(winner) + " lost " + winnerInnings.wickets()
                        + " wickets, but the margin is " + draft.marginValue() + " wickets.");
            }
        }
    }

    private void warnIfRegularInningsNotLevel(ResultDraft draft, List<String> warnings) {
        List<InningsDto> regular = regular(draft);
        if (regular.size() == 2 && complete(regular.get(0)) && complete(regular.get(1)) && !level(regular)) {
            warnings.add("The match is recorded as a tie but the two innings are not level.");
        }
    }

    private void warnOnTossVersusOrder(ResultDraft draft, Names names, List<String> warnings) {
        List<InningsDto> regular = regular(draft);
        if (draft.tossWonBy() == null || draft.tossDecision() == null || regular.isEmpty()
                || regular.get(0).battingSide() == null) {
            return;
        }
        ResultSide expectedFirst = draft.tossDecision() == TossDecision.BAT ? draft.tossWonBy() : other(draft.tossWonBy());
        if (regular.get(0).battingSide() != expectedFirst) {
            warnings.add(names.of(draft.tossWonBy()) + " won the toss and chose to "
                    + (draft.tossDecision() == TossDecision.BAT ? "bat" : "bowl") + ", but "
                    + names.of(regular.get(0).battingSide()) + " batted first.");
        }
    }

    private void warnOnInningsLength(ResultDraft draft, List<String> warnings) {
        for (InningsDto innings : regular(draft)) {
            if (!complete(innings)) {
                continue;
            }
            if (draft.scheduledBalls() != null && innings.balls() > draft.scheduledBalls()) {
                warnings.add("Innings " + innings.sequence() + " is longer than the scheduled "
                        + OversFormat.display(draft.scheduledBalls(), draft.ballsPerOver()) + " overs.");
            }
            if (Boolean.TRUE.equals(innings.allOut()) && innings.wickets() < MAX_WICKETS) {
                // Fewer than eleven batters is legitimate; the all-out flag is the scorer's word, so only say so.
                warnings.add("Innings " + innings.sequence() + " is marked all out with " + innings.wickets() + " wickets.");
            }
        }
    }

    // ---- structure ----

    private void inningsStructure(ResultDraft draft, List<String> errors) {
        Set<Integer> sequences = new HashSet<>();
        int regularCount = 0;
        for (InningsDto i : draft.innings()) {
            String label = "Innings " + i.sequence();
            if (!sequences.add(i.sequence())) {
                errors.add("Two innings share the number " + i.sequence() + ".");
            }
            if (i.sequence() < 1) {
                errors.add("Innings numbers start at 1.");
            }
            if (i.kind() == InningsKind.REGULAR) {
                regularCount++;
                if (i.sequence() > 2) {
                    errors.add(label + " cannot be a regular innings: only innings 1 and 2 are.");
                }
            } else if (i.sequence() < 3) {
                errors.add(label + " cannot be a super over: super overs follow the two regular innings.");
            }
            if (i.battingSide() == null) {
                errors.add(label + " needs the batting side.");
            }
            if (i.runs() == null || i.wickets() == null || i.balls() == null) {
                errors.add(label + " needs runs, wickets and overs.");
                continue;
            }
            if (i.runs() < 0 || i.balls() < 0 || i.wickets() < 0 || (i.extras() != null && i.extras() < 0)) {
                errors.add(label + " cannot have negative figures.");
            }
            int maxWickets = i.kind() == InningsKind.SUPER_OVER ? MAX_SUPER_OVER_WICKETS : MAX_WICKETS;
            if (i.wickets() > maxWickets) {
                errors.add(label + " cannot have more than " + maxWickets + " wickets.");
            }
        }
        if (regularCount > 2) {
            errors.add("A match has at most two regular innings.");
        }
    }

    private void nonNegative(List<String> errors, Integer value, String what) {
        if (value != null && value < 0) {
            errors.add(what + " cannot be negative.");
        }
    }

    private List<InningsDto> regular(ResultDraft draft) {
        return draft.innings().stream().filter(i -> i.kind() == InningsKind.REGULAR).toList();
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
