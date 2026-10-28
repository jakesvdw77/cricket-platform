package com.cricketlegend.service.support;

import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.MatchResultDto;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * docs/specs/123: the short score text and the result line of a published result, as the client's
 * {@code resultLine.ts} and {@code sideScoreText} word them (keep the two in lockstep). Pure, no access information.
 */
public final class LeagueResultText {

    private LeagueResultText() {}

    /** "Irene Villagers 1 won by 24 runs", "Tied · X won in the super over", "Abandoned". */
    public static String resultLine(MatchResultDto result, String homeName, String awayName) {
        String winner = result.winningSide() == ResultSide.HOME ? homeName
                : result.winningSide() == ResultSide.AWAY ? awayName : null;
        if (result.outcomeType() == null) {
            return "Result not entered yet";
        }
        return switch (result.outcomeType()) {
            case WON -> {
                if (winner == null) {
                    yield "Won";
                }
                if (result.decidedBy() == ResultDecidedBy.SUPER_OVER) {
                    yield "Tied · " + winner + " won in the super over";
                }
                String margin = margin(result.marginType(), result.marginValue());
                String base = margin.isEmpty() ? winner + " won" : winner + " won " + margin;
                yield result.decidedBy() == ResultDecidedBy.DLS ? base + " (DLS)" : base;
            }
            case TIE -> "Match tied";
            case DRAW -> "Match drawn";
            case NO_RESULT -> "No result";
            case ABANDONED -> "Abandoned";
            case FORFEIT -> winner != null ? winner + " won by forfeit" : "Forfeit";
        };
    }

    /** One side's innings as "212/6 (40.0) & 100/2 (20.0)", super overs after " · super over "; empty when none. */
    public static String sideScore(MatchResultDto result, ResultSide side) {
        List<InningsDto> innings = result.innings().stream()
                .filter(i -> i.battingSide() == side)
                .sorted(Comparator.comparing(i -> i.sequence() == null ? 0 : i.sequence()))
                .toList();
        String regular = join(innings, false);
        String superOver = join(innings, true);
        return java.util.stream.Stream.of(regular, superOver.isEmpty() ? "" : "super over " + superOver)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.joining(" · "));
    }

    private static String join(List<InningsDto> innings, boolean superOver) {
        return innings.stream()
                .filter(i -> (i.kind() == InningsKind.SUPER_OVER) == superOver)
                .map(LeagueResultText::inningsScore)
                .filter(Objects::nonNull)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.joining(" & "));
    }

    private static String inningsScore(InningsDto innings) {
        if (innings.runs() == null) {
            return "";
        }
        String wickets = innings.wickets() == null ? "" : "/" + innings.wickets();
        String overs = innings.oversDisplay() == null || innings.oversDisplay().isEmpty()
                ? "" : " (" + innings.oversDisplay() + ")";
        return innings.runs() + wickets + overs;
    }

    private static String margin(ResultMarginType type, Integer value) {
        if (type == null || value == null) {
            return "";
        }
        String unit = type == ResultMarginType.RUNS ? "run" : "wicket";
        return "by " + value + " " + unit + (value == 1 ? "" : "s");
    }
}
