package com.cricketlegend.service.support;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: the standout suggestions, relative to the innings and independent
 * of format or age group (no thresholds to configure). One class holds the constants (placeholders to be tried on real
 * scorecards) and the rules, over neutral figures keyed by anything (the scorecard row). A suggestion is only a
 * suggestion: the manager's per-entry override (FEATURE / HIDE) is applied by the caller and never touched here.
 */
public final class StandoutRules {

    public static final int TOP_N = 3;
    public static final double BATTING_SHARE = 0.25;
    public static final double ECONOMY_FACTOR = 0.75;
    public static final int MIN_BALLS_FOR_ECONOMY = 12;
    public static final int FIELDING_MIN = 2;

    private StandoutRules() {}

    /** A batter who batted; {@code balls} may be unknown. */
    public record Batter<K>(K key, int runs, Integer balls) {
    }

    /** A bowler's figures; {@code balls} is balls bowled. */
    public record Bowler<K>(K key, int balls, int runs, int wickets) {
    }

    /** A fielder's dismissals (catches + stumpings + run-outs). */
    public record Fielder<K>(K key, int dismissals) {
    }

    /**
     * Batters of one innings: in the top {@link #TOP_N} by runs (then fewer balls) <em>and</em> at least {@link
     * #BATTING_SHARE} of {@code inningsRuns}, or the top scorer when they scored at least one run.
     */
    public static <K> Set<K> battingSuggestions(List<Batter<K>> batters, Integer inningsRuns) {
        // a batter without a run is never featured, whatever the innings total
        List<Batter<K>> ranked = new ArrayList<>(batters.stream().filter(b -> b.runs() > 0).toList());
        ranked.sort(Comparator.<Batter<K>>comparingInt(b -> -b.runs())
                .thenComparingInt(b -> b.balls() == null ? Integer.MAX_VALUE : b.balls()));
        Set<K> suggested = new HashSet<>();
        for (int index = 0; index < ranked.size() && index < TOP_N; index++) {
            Batter<K> batter = ranked.get(index);
            // without the innings total (not entered yet) the share rule cannot apply; the top scorer rule below still does
            if (inningsRuns != null && batter.runs() >= BATTING_SHARE * inningsRuns && batter.runs() > 0) {
                suggested.add(batter.key());
            }
        }
        if (!ranked.isEmpty() && ranked.get(0).runs() >= 1) {
            Batter<K> top = ranked.get(0);
            ranked.stream()
                    .filter(b -> b.runs() == top.runs() && java.util.Objects.equals(b.balls(), top.balls()))
                    .forEach(b -> suggested.add(b.key()));
        }
        return suggested;
    }

    /**
     * Bowlers of one innings: in the top {@link #TOP_N} by wickets (then lower economy) <em>and</em> either at least
     * one wicket or at least {@link #MIN_BALLS_FOR_ECONOMY} balls at an economy of at most {@link #ECONOMY_FACTOR} of
     * the innings run rate. Economy and run rate compare runs per ball, so the over length cancels out.
     */
    public static <K> Set<K> bowlingSuggestions(List<Bowler<K>> bowlers, Integer inningsRuns, Integer inningsBalls) {
        // a bowler who bowled no ball is never featured
        List<Bowler<K>> ranked = new ArrayList<>(bowlers.stream().filter(b -> b.balls() > 0).toList());
        ranked.sort(Comparator.<Bowler<K>>comparingInt(b -> -b.wickets())
                .thenComparingDouble(StandoutRules::runsPerBall));
        Set<K> suggested = new HashSet<>();
        for (int index = 0; index < ranked.size() && index < TOP_N; index++) {
            Bowler<K> bowler = ranked.get(index);
            boolean economical = inningsRuns != null && inningsBalls != null && inningsBalls > 0 && bowler.balls() >= MIN_BALLS_FOR_ECONOMY
                    && runsPerBall(bowler) <= ECONOMY_FACTOR * ((double) inningsRuns / inningsBalls);
            if (bowler.wickets() >= 1 || economical) {
                suggested.add(bowler.key());
            }
        }
        return suggested;
    }

    /** Fielders of one innings: in the top {@link #TOP_N} by dismissals with at least {@link #FIELDING_MIN}. */
    public static <K> Set<K> fieldingSuggestions(List<Fielder<K>> fielders) {
        List<Fielder<K>> ranked = new ArrayList<>(fielders);
        ranked.sort(Comparator.<Fielder<K>>comparingInt(f -> -f.dismissals()));
        Set<K> suggested = new HashSet<>();
        for (int index = 0; index < ranked.size() && index < TOP_N; index++) {
            if (ranked.get(index).dismissals() >= FIELDING_MIN) {
                suggested.add(ranked.get(index).key());
            }
        }
        return suggested;
    }

    private static double runsPerBall(Bowler<?> bowler) {
        return bowler.balls() <= 0 ? Double.MAX_VALUE : (double) bowler.runs() / bowler.balls();
    }
}
