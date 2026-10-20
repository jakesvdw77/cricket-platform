package com.cricketlegend.service.support;

import com.cricketlegend.dto.AwardsViewDto.LeaderboardRow;
import com.cricketlegend.dto.AwardsViewDto.LeaderboardRunsNotOut;
import com.cricketlegend.dto.AwardsViewDto.LeaderboardSample;
import com.cricketlegend.dto.AwardsViewDto.LeaderboardWicketsRuns;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardCoverage;
import com.cricketlegend.dto.PlayerStatsDto.PlayerBatting;
import com.cricketlegend.dto.PlayerStatsDto.PlayerBowling;
import com.cricketlegend.service.support.LeaderboardBoard.MinimumKind;
import com.cricketlegend.service.support.LeaderboardQualification.Defaults;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.ToLongFunction;

/**
 * docs/specs/103-player-stats.md, "Leaderboards": for one board, which players are listed, in what order, with what rank.
 * Serves the Awards view; {@link LeaderboardTableRanker} reuses its orderings for the standings tables.
 * Pure (no Spring, no repository, no entity, no caller or access information), so a later player-facing route can reuse it.
 *
 * <p>Every figure is the {@link PlayerStatsCalculator} figure of the same player, so a board figure always equals the
 * Player page figure. Ranking is competition ranking (1, 2, 2, 4): players equal on the figure and on every tie-break
 * share a rank, and are listed by display name, then id, so paging is stable. A rate board lists players with no defined
 * figure (never dismissed, no wickets) after every ranked player with a null rank, ordered by volume then name. The optional
 * minimum removes players below it and counts them; a counting board lists only players with at least one of the thing.
 */
public final class LeaderboardRanker {

    /** Overs are compared and shown to this scale so summing thirds of an over never splits a tie. */
    private static final int OVERS_COMPARE_SCALE = 6;

    private static final int OVERS_SHOWN_SCALE = 2;

    static final Comparator<Candidate> BY_NAME = Comparator.comparing(Candidate::displayName, String.CASE_INSENSITIVE_ORDER)
            .thenComparing(Candidate::playerId);

    /** One player in scope: identity, additive counters and the calculator's figures. */
    public record Candidate(
            UUID playerId,
            String firstName,
            String lastName,
            boolean active,
            PlayerStatsCounters counters,
            PlayerStatsCalculator.Figures figures) {

        String displayName() {
            return (firstName == null ? "" : firstName) + " " + (lastName == null ? "" : lastName);
        }
    }

    /**
     * The whole ordered list for one board: the ranked players, then the unranked group. {@code listed} counts both,
     * {@code ranked} the first group, {@code belowMinimum} the players a minimum removed.
     */
    public record Ranking(List<LeaderboardRow> rows, long listed, long ranked, long belowMinimum) {

        /** Every player at rank 1, so a tie gives joint leaders. The unranked group never leads. */
        public List<LeaderboardRow> leaders() {
            return rows.stream().filter(row -> row.rank() != null && row.rank() == 1).toList();
        }
    }

    private LeaderboardRanker() {}

    /**
     * @param minimum the optional minimum (innings or overs by the board's kind), null for none; ignored on a board whose
     *     minimum kind is NONE
     * @param defaults the filter-aware defaults, which decide the Small sample hint
     * @param innings the best-innings facts (balls faced) of the players, used only to break ties on HIGHEST_SCORE
     */
    public static Ranking rank(
            LeaderboardBoard board,
            List<Candidate> candidates,
            Integer minimum,
            Defaults defaults,
            Map<UUID, LeaderboardInningsFact> innings) {
        List<Candidate> included = candidates.stream().filter(c -> includes(board, c)).toList();
        List<Candidate> kept = included;
        long below = 0;
        if (minimum != null && board.getMinimumKind() != MinimumKind.NONE) {
            kept = included.stream().filter(c -> meetsMinimum(board, c, minimum)).toList();
            below = included.size() - kept.size();
        }

        List<Candidate> rankedGroup = new ArrayList<>();
        List<Candidate> unrankedGroup = new ArrayList<>();
        for (Candidate c : kept) {
            (isRanked(board, c) ? rankedGroup : unrankedGroup).add(c);
        }
        Comparator<Candidate> criteria = criteria(board, innings);
        rankedGroup.sort(criteria.thenComparing(BY_NAME));
        unrankedGroup.sort(volumeDescending(board).thenComparing(BY_NAME));

        List<LeaderboardRow> rows = new ArrayList<>(kept.size());
        int rank = 0;
        Candidate previous = null;
        for (int i = 0; i < rankedGroup.size(); i++) {
            Candidate current = rankedGroup.get(i);
            if (previous == null || criteria.compare(previous, current) != 0) {
                rank = i + 1;
            }
            rows.add(toRow(board, current, rank, defaults));
            previous = current;
        }
        for (Candidate current : unrankedGroup) {
            rows.add(toRow(board, current, null, defaults));
        }
        return new Ranking(List.copyOf(rows), rows.size(), rankedGroup.size(), below);
    }

    /**
     * Why an awards category has no leader, or null when it has one. Only a board with no ranked player gets a reason.
     *
     * @param minimum the minimum that was applied (null when the board has none)
     */
    public static String omissionReason(LeaderboardBoard board, Ranking ranking, Integer minimum) {
        if (ranking.ranked() > 0) {
            return null;
        }
        boolean batting = board.getGroup() == LeaderboardBoard.Group.BATTING;
        if (ranking.belowMinimum() > 0 && minimum != null) {
            return board.getMinimumKind() == MinimumKind.OVERS
                    ? "No bowler reached the minimum of " + minimum + " overs."
                    : "No batter reached the minimum of " + minimum + " innings.";
        }
        if (ranking.listed() > 0) {
            return batting
                    ? "No batter has been dismissed yet, so nobody has an average."
                    : "No bowler has taken a wicket yet.";
        }
        return "Nobody has a figure for this category in these results.";
    }

    // ---- inclusion ----

    private static boolean includes(LeaderboardBoard board, Candidate c) {
        PlayerBatting b = c.figures().batting();
        PlayerBowling w = c.figures().bowling();
        return switch (board) {
            case HIGHEST_SCORE -> b.highestScore() != null;
            case BATTING_AVERAGE -> b.innings() >= 1;
            case STRIKE_RATE -> b.coverage().inningsWithBalls() >= 1 && b.strikeRate() != null;
            case BEST_BOWLING -> w.best() != null;
            case BOWLING_AVERAGE, BOWLING_STRIKE_RATE -> w.inningsBowled() >= 1;
            case ECONOMY_RATE -> w.economy() != null;
            case MOST_DOT_BALLS -> w.coverage().inningsWithDots() >= 1 && w.dots() >= 1;
            default -> count(board, c) >= 1 && hasAppearanceOfKind(board, c);
        };
    }

    private static boolean hasAppearanceOfKind(LeaderboardBoard board, Candidate c) {
        return switch (board.getGroup()) {
            case BATTING -> c.figures().batting().innings() >= 1;
            case BOWLING -> c.figures().bowling().inningsBowled() >= 1;
            case FIELDING, AWARDS -> c.counters().matches() >= 1;
        };
    }

    /** The figure of a counting board. */
    private static long count(LeaderboardBoard board, Candidate c) {
        PlayerStatsCalculator.Figures f = c.figures();
        return switch (board) {
            case MOST_RUNS -> f.batting().runs();
            case MOST_FOURS -> f.batting().fours();
            case MOST_SIXES -> f.batting().sixes();
            case MOST_30S -> f.batting().thirtyPlus();
            case MOST_50S -> f.batting().fiftyPlus();
            case MOST_100S -> f.batting().hundredPlus();
            case MOST_NOT_OUTS -> f.batting().notOuts();
            case MOST_WICKETS -> f.bowling().wickets();
            case MOST_MAIDENS -> f.bowling().maidens();
            case MOST_3W -> f.bowling().threeWicketHauls();
            case MOST_4W -> f.bowling().fourWicketHauls();
            case MOST_5W -> f.bowling().fiveWicketHauls();
            case MOST_DOT_BALLS -> f.bowling().dots();
            case MOST_CATCHES -> f.fielding().catches();
            case MOST_STUMPINGS -> f.fielding().stumpings();
            case MOST_RUN_OUTS -> f.fielding().runOuts();
            case MOST_FIELDING_DISMISSALS -> f.fielding().dismissals();
            case MOST_POTM -> f.awards().playerOfTheMatch();
            case MOST_TEAM_POTM -> f.awards().teamPlayerOfTheMatch();
            default -> 0L;
        };
    }

    static boolean isRanked(LeaderboardBoard board, Candidate c) {
        return switch (board) {
            case BATTING_AVERAGE -> c.figures().batting().average() != null;
            case BOWLING_AVERAGE -> c.figures().bowling().average() != null;
            case BOWLING_STRIKE_RATE -> c.figures().bowling().strikeRate() != null;
            default -> true;
        };
    }

    // ---- minimum and sample ----

    /** Innings behind a batting rate figure: innings that recorded balls for strike rate, otherwise all innings. */
    static long sampleInnings(LeaderboardBoard board, Candidate c) {
        PlayerBatting b = c.figures().batting();
        return board == LeaderboardBoard.STRIKE_RATE ? b.coverage().inningsWithBalls() : b.innings();
    }

    static BigDecimal overs(Candidate c) {
        BigDecimal overs = c.counters().bowling().overs();
        return (overs == null ? BigDecimal.ZERO : overs).setScale(OVERS_COMPARE_SCALE, RoundingMode.HALF_UP);
    }

    static boolean meetsMinimum(LeaderboardBoard board, Candidate c, int minimum) {
        return switch (board.getMinimumKind()) {
            case INNINGS -> sampleInnings(board, c) >= minimum;
            case OVERS -> overs(c).compareTo(BigDecimal.valueOf(minimum)) >= 0;
            case NONE -> true;
        };
    }

    static boolean isSmallSample(LeaderboardBoard board, Candidate c, Defaults defaults) {
        return switch (board.getMinimumKind()) {
            case INNINGS -> sampleInnings(board, c) < defaults.innings();
            case OVERS -> overs(c).compareTo(BigDecimal.valueOf(defaults.overs())) < 0;
            case NONE -> false;
        };
    }

    private static LeaderboardSample sample(LeaderboardBoard board, Candidate c) {
        PlayerBatting b = c.figures().batting();
        PlayerBowling w = c.figures().bowling();
        return switch (board.getMinimumKind()) {
            case NONE -> null;
            case INNINGS -> new LeaderboardSample(sampleInnings(board, c), b.ballsFaced(), null, null, null, null);
            case OVERS -> {
                Integer ballsPerOver = !w.mixedOverLengths() && w.ballsPerOver().size() == 1
                        ? w.ballsPerOver().get(0)
                        : null;
                BigDecimal shown = w.mixedOverLengths()
                        ? null
                        : overs(c).setScale(OVERS_SHOWN_SCALE, RoundingMode.HALF_UP);
                yield new LeaderboardSample(null, null, w.ballsBowled(), shown, ballsPerOver, w.wickets());
            }
        };
    }

    // ---- ordering ----

    static Comparator<Candidate> criteria(LeaderboardBoard board, Map<UUID, LeaderboardInningsFact> innings) {
        return switch (board) {
            case MOST_RUNS -> descL(c -> count(board, c)).thenComparing(ascL(LeaderboardRanker::battingInnings))
                    .thenComparing(descL(LeaderboardRanker::highestKey));
            case HIGHEST_SCORE -> descL(LeaderboardRanker::highestKey)
                    .thenComparing(ascL(c -> ballsFaced(c, innings)));
            case BATTING_AVERAGE -> descD(c -> c.figures().batting().average())
                    .thenComparing(descL(LeaderboardRanker::runs))
                    .thenComparing(descL(LeaderboardRanker::battingInnings));
            case STRIKE_RATE -> descD(c -> c.figures().batting().strikeRate())
                    .thenComparing(descL(LeaderboardRanker::runs))
                    .thenComparing(descL(LeaderboardRanker::battingInnings));
            case MOST_FOURS, MOST_SIXES -> descL(c -> count(board, c))
                    .thenComparing(ascL(LeaderboardRanker::battingInnings))
                    .thenComparing(descL(LeaderboardRanker::runs));
            case MOST_30S, MOST_50S, MOST_100S, MOST_NOT_OUTS -> descL(c -> count(board, c))
                    .thenComparing(descL(LeaderboardRanker::runs))
                    .thenComparing(ascL(LeaderboardRanker::battingInnings));
            case MOST_WICKETS -> descL(c -> count(board, c))
                    .thenComparing(ascL(c -> c.figures().bowling().runsConceded()))
                    .thenComparing(ascL(c -> c.figures().bowling().ballsBowled()));
            case BEST_BOWLING -> descL(c -> {
                Long key = c.counters().bowling().bestBowlingKey();
                return key == null ? -1L : key;
            });
            case BOWLING_AVERAGE -> ascD(c -> c.figures().bowling().average())
                    .thenComparing(descL(c -> c.figures().bowling().wickets()))
                    .thenComparing(descD(LeaderboardRanker::overs));
            case ECONOMY_RATE -> ascD(c -> c.figures().bowling().economy())
                    .thenComparing(descL(c -> c.figures().bowling().wickets()))
                    .thenComparing(descD(LeaderboardRanker::overs));
            case BOWLING_STRIKE_RATE -> ascD(c -> c.figures().bowling().strikeRate())
                    .thenComparing(descL(c -> c.figures().bowling().wickets()))
                    .thenComparing(descD(LeaderboardRanker::overs));
            case MOST_MAIDENS -> descL(c -> count(board, c))
                    .thenComparing(descD(LeaderboardRanker::overs))
                    .thenComparing(descL(c -> c.figures().bowling().wickets()));
            case MOST_3W, MOST_4W, MOST_5W -> descL(c -> count(board, c))
                    .thenComparing(descL(c -> c.figures().bowling().wickets()))
                    .thenComparing(ascL(c -> c.figures().bowling().runsConceded()));
            case MOST_DOT_BALLS -> descL(c -> count(board, c))
                    .thenComparing(descD(c -> c.figures().bowling().dotBallPercentage()))
                    .thenComparing(descD(LeaderboardRanker::overs));
            case MOST_CATCHES, MOST_STUMPINGS, MOST_RUN_OUTS -> descL(c -> count(board, c))
                    .thenComparing(ascL(c -> c.counters().matches()));
            case MOST_FIELDING_DISMISSALS -> descL(c -> count(board, c))
                    .thenComparing(ascL(c -> c.counters().matches()))
                    .thenComparing(descL(c -> c.figures().fielding().catches()));
            case MOST_POTM -> descL(c -> count(board, c))
                    .thenComparing(descL(c -> c.figures().awards().teamPlayerOfTheMatch()))
                    .thenComparing(ascL(c -> c.counters().matches()));
            case MOST_TEAM_POTM -> descL(c -> count(board, c))
                    .thenComparing(descL(c -> c.figures().awards().playerOfTheMatch()))
                    .thenComparing(ascL(c -> c.counters().matches()));
        };
    }

    /** The unranked group: by volume (runs on the batting board, overs on the bowling boards), highest first. */
    private static Comparator<Candidate> volumeDescending(LeaderboardBoard board) {
        return board == LeaderboardBoard.BATTING_AVERAGE ? descL(LeaderboardRanker::runs) : descD(LeaderboardRanker::overs);
    }

    static long runs(Candidate c) {
        return c.figures().batting().runs();
    }

    static long battingInnings(Candidate c) {
        return c.figures().batting().innings();
    }

    /** Highest score as a sortable key: more runs first, and a not-out innings before the same score out. */
    private static long highestKey(Candidate c) {
        var highest = c.figures().batting().highestScore();
        return highest == null ? -1L : PlayerStatsCalculator.highestScoreKey(highest.runs(), highest.notOut());
    }

    /** Balls faced in the highest innings; not recorded sorts after any recorded value. */
    private static long ballsFaced(Candidate c, Map<UUID, LeaderboardInningsFact> innings) {
        LeaderboardInningsFact fact = innings.get(c.playerId());
        return fact == null || fact.balls() == null ? Long.MAX_VALUE : fact.balls();
    }

    static Comparator<Candidate> descL(ToLongFunction<Candidate> key) {
        return Comparator.<Candidate>comparingLong(key).reversed();
    }

    static Comparator<Candidate> ascL(ToLongFunction<Candidate> key) {
        return Comparator.comparingLong(key);
    }

    /** Descending by a decimal, a missing value last. */
    static Comparator<Candidate> descD(Function<Candidate, BigDecimal> key) {
        return Comparator.comparing(key, Comparator.nullsLast(Comparator.<BigDecimal>reverseOrder()));
    }

    /** Ascending by a decimal, a missing value last. */
    static Comparator<Candidate> ascD(Function<Candidate, BigDecimal> key) {
        return Comparator.comparing(key, Comparator.nullsLast(Comparator.<BigDecimal>naturalOrder()));
    }

    // ---- rows and coverage ----

    private static LeaderboardRow toRow(LeaderboardBoard board, Candidate c, Integer rank, Defaults defaults) {
        PlayerStatsCalculator.Figures f = c.figures();
        Long innings = switch (board.getGroup()) {
            case BATTING -> f.batting().innings();
            case BOWLING -> f.bowling().inningsBowled();
            default -> null;
        };
        return new LeaderboardRow(
                rank,
                c.playerId(),
                c.firstName(),
                c.lastName(),
                c.active(),
                figure(board, c),
                c.counters().matches(),
                innings,
                sample(board, c),
                isSmallSample(board, c, defaults),
                null);
    }

    private static Object figure(LeaderboardBoard board, Candidate c) {
        PlayerStatsCalculator.Figures f = c.figures();
        return switch (board) {
            case HIGHEST_SCORE -> f.batting().highestScore() == null
                    ? null
                    : new LeaderboardRunsNotOut(
                            f.batting().highestScore().runs(), f.batting().highestScore().notOut());
            case BATTING_AVERAGE -> f.batting().average();
            case STRIKE_RATE -> f.batting().strikeRate();
            case BEST_BOWLING -> f.bowling().best() == null
                    ? null
                    : new LeaderboardWicketsRuns(f.bowling().best().wickets(), f.bowling().best().runs());
            case BOWLING_AVERAGE -> f.bowling().average();
            case ECONOMY_RATE -> f.bowling().economy();
            case BOWLING_STRIKE_RATE -> f.bowling().strikeRate();
            default -> count(board, c);
        };
    }

    /** Innings that recorded the figure out of innings counted, for boards built on optional columns. */
    static LeaderboardCoverage coverage(LeaderboardBoard board, List<Candidate> candidates) {
        if (board != LeaderboardBoard.STRIKE_RATE
                && board != LeaderboardBoard.MOST_FOURS
                && board != LeaderboardBoard.MOST_SIXES
                && board != LeaderboardBoard.MOST_DOT_BALLS) {
            return null;
        }
        long used = 0;
        long counted = 0;
        for (Candidate c : candidates) {
            PlayerBatting b = c.figures().batting();
            PlayerBowling w = c.figures().bowling();
            switch (board) {
                case STRIKE_RATE -> {
                    used += b.coverage().inningsWithBalls();
                    counted += b.innings();
                }
                case MOST_FOURS, MOST_SIXES -> {
                    used += b.coverage().inningsWithBoundaries();
                    counted += b.innings();
                }
                case MOST_DOT_BALLS -> {
                    used += w.coverage().inningsWithDots();
                    counted += w.inningsBowled();
                }
                default -> throw new IllegalStateException("No coverage for " + board);
            }
        }
        return new LeaderboardCoverage(used, counted);
    }
}
