package com.cricketlegend.support;

import static com.cricketlegend.support.ScorecardDtos.bat;
import static com.cricketlegend.support.ScorecardDtos.bowl;
import static com.cricketlegend.support.ScorecardDtos.by;
import static com.cricketlegend.support.ScorecardDtos.extrasAndDots;
import static com.cricketlegend.support.ScorecardDtos.opposition;
import static com.cricketlegend.support.ScorecardDtos.registered;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.BattingEntryDto;
import com.cricketlegend.dto.BowlingEntryDto;
import com.cricketlegend.dto.FieldingEntryDto;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.MatchAwardDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.service.support.ScorecardContext;
import java.util.ArrayList;
import java.util.List;
import java.util.function.UnaryOperator;

/**
 * A scorecard that raises no issue of any severity, to be bent one way per test (docs/specs/101). The batting side
 * (ours or, when {@code battingIsOpposition}, the opposition) bats first and wins by 50: 200/8 in 20 overs, extras 10
 * (4 wides, 1 no-ball, 3 byes, 2 leg byes) against 150/10. Its eleven batters b1 to b11: b1 to b8 are out bowled,
 * b9 and b10 are not out, b11 did not bat, and they made 190 runs between them. The other side's eleven w1 to w11
 * are on the list; w1 to w5 bowled 24 balls each for 39 runs, 4 wides and 1 no-ball in all, and took the 8 wickets
 * (2, 2, 2, 1, 1) that the dismissals name. No fielding rows. The innings have no strategy beyond that.
 */
public final class ScorecardCard {

    public final ResultSide batSide;
    public final ResultSide bowlSide;
    public final List<ResultPlayerDto> players = new ArrayList<>();
    public final List<BattingEntryDto> batting = new ArrayList<>();
    public final List<BowlingEntryDto> bowling = new ArrayList<>();
    public final List<FieldingEntryDto> fielding = new ArrayList<>();
    public final List<MatchAwardDto> awards = new ArrayList<>();
    public InningsDto first;
    public InningsDto second;
    public ResultOutcomeType outcome = ResultOutcomeType.WON;
    public ScorecardContext context = ScorecardContext.none();

    private static final int[] RUNS = {50, 40, 30, 20, 20, 10, 10, 5, 3, 2};
    private static final String[] BOWLERS = {"w1", "w1", "w2", "w2", "w3", "w3", "w4", "w5"};

    private ScorecardCard(ResultSide batSide, boolean batOpposition, boolean bowlOpposition) {
        this.batSide = batSide;
        this.bowlSide = batSide == ResultSide.HOME ? ResultSide.AWAY : ResultSide.HOME;
        for (int n = 1; n <= 11; n++) {
            players.add(batOpposition ? opposition(batSide, "b" + n, "Batter " + n) : registered(batSide, "b" + n));
        }
        for (int n = 1; n <= 11; n++) {
            players.add(bowlOpposition ? opposition(bowlSide, "w" + n, "Bowler " + n) : registered(bowlSide, "w" + n));
        }
        for (int n = 1; n <= 11; n++) {
            DismissalType how = n <= 8 ? DismissalType.BOWLED : n <= 10 ? DismissalType.NOT_OUT : DismissalType.DID_NOT_BAT;
            BattingEntryDto row = bat(batSide, "b" + n, how, n <= 10 ? RUNS[n - 1] : null, null, n <= 10 ? n : null);
            batting.add(n <= 8 ? by(row, BOWLERS[n - 1], null) : row);
        }
        int[] wickets = {2, 2, 2, 1, 1};
        int[] wides = {1, 1, 1, 1, 0};
        for (int n = 1; n <= 5; n++) {
            bowling.add(extrasAndDots(bowl(batSide, "w" + n, 24, 0, 39, wickets[n - 1]), wides[n - 1], n == 1 ? 1 : 0, null));
        }
        first = new InningsDto(1, InningsKind.REGULAR, batSide, 200, 8, 120, null, null, null, 4, 1, 3, 2, 0, null);
        second = new InningsDto(2, InningsKind.REGULAR, bowlSide, 150, 10, 120, null, null, null);
    }

    /** Our side bats; the opposition bowls. */
    public static ScorecardCard oursBat() {
        return new ScorecardCard(ResultSide.HOME, false, true);
    }

    /** The opposition bats; our side bowls. */
    public static ScorecardCard oppositionBats() {
        return new ScorecardCard(ResultSide.HOME, true, false);
    }

    /** A derby: both sides are ours. */
    public static ScorecardCard derby() {
        return new ScorecardCard(ResultSide.HOME, false, false);
    }

    public ScorecardCard with(UnaryOperator<ScorecardCard> change) {
        return change.apply(this);
    }

    public ScorecardCard batting(String key, UnaryOperator<BattingEntryDto> change) {
        batting.replaceAll(e -> key.equals(e.playerClientKey()) ? change.apply(e) : e);
        return this;
    }

    public ScorecardCard bowling(String key, UnaryOperator<BowlingEntryDto> change) {
        bowling.replaceAll(e -> key.equals(e.playerClientKey()) ? change.apply(e) : e);
        return this;
    }

    public ScorecardCard player(String key, UnaryOperator<ResultPlayerDto> change) {
        players.replaceAll(p -> key.equals(p.clientKey()) ? change.apply(p) : p);
        return this;
    }

    /** The first innings' runs, wickets and balls; the extras breakdown and the rest are kept. */
    public ScorecardCard firstInnings(Integer runs, Integer wickets, Integer balls) {
        first = new InningsDto(1, InningsKind.REGULAR, batSide, runs, wickets, balls, null, first.allOut(), null,
                first.wides(), first.noBalls(), first.byes(), first.legByes(), first.penaltyRuns(),
                first.nonBowlerWickets());
        return this;
    }

    /** Replaces the first innings' extras breakdown (the total follows from it). */
    public ScorecardCard breakdown(Integer wides, Integer noBalls, Integer byes, Integer legByes, Integer penalty) {
        first = new InningsDto(1, InningsKind.REGULAR, batSide, first.runs(), first.wickets(), first.balls(), null,
                first.allOut(), null, wides, noBalls, byes, legByes, penalty, first.nonBowlerWickets());
        return this;
    }

    public ScorecardCard nonBowlerWickets(Integer count) {
        first = new InningsDto(1, InningsKind.REGULAR, batSide, first.runs(), first.wickets(), first.balls(), null,
                first.allOut(), null, first.wides(), first.noBalls(), first.byes(), first.legByes(),
                first.penaltyRuns(), count);
        return this;
    }

    public ScorecardCard allOut(Boolean allOut) {
        first = new InningsDto(1, InningsKind.REGULAR, batSide, first.runs(), first.wickets(), first.balls(), null,
                allOut, null, first.wides(), first.noBalls(), first.byes(), first.legByes(), first.penaltyRuns(),
                first.nonBowlerWickets());
        return this;
    }

    /** Takes a player off the list together with their batting row. */
    public ScorecardCard remove(String key) {
        players.removeIf(p -> key.equals(p.clientKey()));
        batting.removeIf(e -> key.equals(e.playerClientKey()));
        return this;
    }

    /** Our players' profile ids by client key, once {@link #realise} has swapped in real ones. */
    public final java.util.Map<String, java.util.UUID> profiles = new java.util.HashMap<>();

    /** Gives every registered (not opposition, not guest) player the real profile {@code profileFor(key)}. */
    public ScorecardCard realise(java.util.function.Function<String, java.util.UUID> profileFor) {
        players.replaceAll(p -> {
            if (p.opposition() || p.playerProfileId() == null) {
                return p;
            }
            java.util.UUID id = profileFor.apply(p.clientKey());
            profiles.put(p.clientKey(), id);
            return new ResultPlayerDto(p.id(), p.clientKey(), p.side(), id, p.displayName(), p.plannedBattingOrder(),
                    p.replacedPlayerProfileId(), p.substitute(), false, p.firstName(), p.lastName(), p.guest(),
                    p.linkedBy(), p.linkedAt());
        });
        return this;
    }

    public ScorecardCard outcome(ResultOutcomeType outcome) {
        this.outcome = outcome;
        return this;
    }

    public ScorecardCard context(ScorecardContext context) {
        this.context = context;
        return this;
    }

    public ScorecardDto scorecard() {
        return new ScorecardDto(players, batting, bowling, fielding, awards, null, null);
    }

    /** The draft: the batting side's innings first, a plain win by 50 runs (or the chosen outcome without winner). */
    public ResultDraft draft() {
        boolean win = outcome == ResultOutcomeType.WON;
        boolean forfeit = outcome == ResultOutcomeType.FORFEIT;
        return new ResultDraft(
                outcome, null, win || forfeit ? batSide : null, win ? ResultMarginType.RUNS : null, win ? 50 : null,
                null, null, null, null, null, null, null, null, List.of(first, second), scorecard());
    }
}
