package com.cricketlegend.service.support;

import static com.cricketlegend.service.support.PlayerStatsTestData.candidate;
import static com.cricketlegend.service.support.PlayerStatsTestData.counters;
import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.dto.AwardsViewDto.LeaderboardRow;
import com.cricketlegend.dto.AwardsViewDto.LeaderboardRunsNotOut;
import com.cricketlegend.dto.AwardsViewDto.LeaderboardWicketsRuns;
import com.cricketlegend.service.support.LeaderboardQualification.Defaults;
import com.cricketlegend.service.support.LeaderboardRanker.Candidate;
import com.cricketlegend.service.support.LeaderboardRanker.Ranking;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/103-player-stats.md, "Boards" and "Minimum qualification on the Awards view": for every board its inclusion
 * rule, ordering and each tie-break in turn, competition ranking, the unranked group, the optional minimum, the small
 * sample hint and the joint leaders the Awards view reads.
 */
class LeaderboardRankerTest {

    private static final Defaults DEFAULTS = new Defaults(3, 6);

    private static Ranking rank(LeaderboardBoard board, Candidate... players) {
        return LeaderboardRanker.rank(board, List.of(players), null, DEFAULTS, Map.of());
    }

    private static Ranking rank(LeaderboardBoard board, Integer minimum, Candidate... players) {
        return LeaderboardRanker.rank(board, List.of(players), minimum, DEFAULTS, Map.of());
    }

    /** "Name:rank" per row in listed order, rank "-" for the unranked group. */
    private static List<String> order(Ranking ranking) {
        return ranking.rows().stream()
                .map(row -> row.firstName() + ":" + (row.rank() == null ? "-" : row.rank()))
                .toList();
    }

    // ---- batting boards ----

    @Test
    void mostRunsOrdersByRunsThenFewerInningsThenHigherHighestScore() {
        Ranking r = rank(
                LeaderboardBoard.MOST_RUNS,
                candidate("A", counters().bat(5, 5, 100).highest(60, false)),
                candidate("B", counters().bat(4, 4, 100).highest(50, false)),
                candidate("C", counters().bat(4, 4, 100).highest(70, false)),
                candidate("D", counters().bat(6, 6, 200).highest(90, false)),
                candidate("E", counters()),
                candidate("F", counters().bat(4, 4, 100).highest(70, false)));

        assertThat(order(r)).containsExactly("D:1", "C:2", "F:2", "B:4", "A:5");
        assertThat(r.rows().get(0).figure()).isEqualTo(200L);
    }

    @Test
    void highestScoreOrdersByRunsThenNotOutBeforeOutThenFewerBallsWithUnrecordedLast() {
        Candidate a = candidate("A", counters().bat(2, 2, 50).highest(50, false));
        Candidate b = candidate("B", counters().bat(2, 1, 50).highest(50, true));
        Candidate c = candidate("C", counters().bat(2, 2, 60).highest(60, false));
        Candidate d = candidate("D", counters().bat(2, 2, 50).highest(50, false));
        Candidate e = candidate("E", counters().bat(2, 2, 50).highest(50, false));
        Candidate f = candidate("F", counters().bat(1, 1, 5));
        Instant day = Instant.parse("2026-10-01T10:00:00Z");

        Ranking r = LeaderboardRanker.rank(
                LeaderboardBoard.HIGHEST_SCORE,
                List.of(a, b, c, d, e, f),
                null,
                DEFAULTS,
                Map.of(
                        a.playerId(), new LeaderboardInningsFact(null, day, "X", 30),
                        d.playerId(), new LeaderboardInningsFact(null, day, "X", 20),
                        e.playerId(), new LeaderboardInningsFact(null, day, "X", null)));

        assertThat(order(r)).containsExactly("C:1", "B:2", "D:3", "A:4", "E:5");
        assertThat(r.rows().get(1).figure()).isEqualTo(new LeaderboardRunsNotOut(50, true));
    }

    @Test
    void highestScoreWithEqualScoreAndEqualBallsSharesARank() {
        Candidate a = candidate("A", counters().bat(1, 1, 50).highest(50, false));
        Candidate b = candidate("B", counters().bat(1, 1, 50).highest(50, false));
        Instant day = Instant.parse("2026-10-01T10:00:00Z");

        Ranking r = LeaderboardRanker.rank(
                LeaderboardBoard.HIGHEST_SCORE,
                List.of(a, b),
                null,
                DEFAULTS,
                Map.of(
                        a.playerId(), new LeaderboardInningsFact(null, day, "X", 30),
                        b.playerId(), new LeaderboardInningsFact(null, day, "Y", 30)));

        assertThat(order(r)).containsExactly("A:1", "B:1");
    }

    @Test
    void battingAverageOrdersByAverageThenRunsThenMoreInningsAndNeverDismissedBattersAreLastUnranked() {
        Ranking r = rank(
                LeaderboardBoard.BATTING_AVERAGE,
                candidate("A", counters().bat(2, 2, 100)),
                candidate("B", counters().bat(4, 4, 200)),
                candidate("C", counters().bat(3, 2, 100)),
                candidate("D", counters().bat(3, 3, 60)),
                candidate("E", counters().bat(3, 0, 150)),
                candidate("F", counters().bat(2, 0, 50)),
                candidate("G", counters()));

        // A, B and C average 50: more runs first (B), then more innings (C before A). E and F have no average.
        assertThat(order(r)).containsExactly("B:1", "C:2", "A:3", "D:4", "E:-", "F:-");
        assertThat(r.ranked()).isEqualTo(4);
        assertThat(r.listed()).isEqualTo(6);
        assertThat(r.rows().get(4).figure()).isNull();
        assertThat(r.rows().get(0).figure()).isEqualTo(new BigDecimal("50.00"));
    }

    @Test
    void whenNobodyHasAnAverageNobodyLeads() {
        Ranking r = rank(
                LeaderboardBoard.BATTING_AVERAGE,
                candidate("A", counters().bat(2, 0, 80)),
                candidate("B", counters().bat(1, 0, 20)));

        assertThat(order(r)).containsExactly("A:-", "B:-");
        assertThat(r.ranked()).isZero();
        assertThat(r.leaders()).isEmpty();
    }

    @Test
    void strikeRateIncludesOnlyPlayersWithBallsAndOrdersByRateThenRunsThenMoreInnings() {
        Ranking r = rank(
                LeaderboardBoard.STRIKE_RATE,
                candidate("A", counters().bat(2, 2, 60).ballsOn(2, 60, 60)),
                candidate("B", counters().bat(2, 2, 100).ballsOn(2, 100, 100)),
                candidate("C", counters().bat(3, 3, 60).ballsOn(3, 60, 60)),
                candidate("D", counters().bat(2, 2, 90).ballsOn(2, 90, 60)),
                candidate("E", counters().bat(2, 2, 50)));

        assertThat(order(r)).containsExactly("D:1", "B:2", "C:3", "A:4");
        assertThat(r.rows().get(0).figure()).isEqualTo(new BigDecimal("150.00"));
    }

    @Test
    void mostFoursAndSixesOrderByCountThenFewerInningsThenMoreRunsAndExcludeZero() {
        Ranking fours = rank(
                LeaderboardBoard.MOST_FOURS,
                candidate("A", counters().bat(3, 3, 100).fours(5)),
                candidate("B", counters().bat(2, 2, 50).fours(5)),
                candidate("C", counters().bat(2, 2, 80).fours(5)),
                candidate("D", counters().bat(4, 4, 90)),
                candidate("E", counters().bat(5, 5, 120).fours(8)));
        Ranking sixes = rank(
                LeaderboardBoard.MOST_SIXES,
                candidate("A", counters().bat(2, 2, 50).sixes(3)),
                candidate("B", counters().bat(2, 2, 90).sixes(3)),
                candidate("C", counters().bat(2, 2, 90).sixes(0)),
                candidate("D", counters().bat(1, 1, 10).sixes(4)));

        assertThat(order(fours)).containsExactly("E:1", "C:2", "B:3", "A:4");
        assertThat(order(sixes)).containsExactly("D:1", "B:2", "A:3");
    }

    @Test
    void milestoneBoardsOrderByCountThenMoreRunsThenFewerInnings() {
        Ranking fifties = rank(
                LeaderboardBoard.MOST_50S,
                candidate("A", counters().bat(3, 3, 150).milestones(2, 2, 0)),
                candidate("B", counters().bat(3, 3, 180).milestones(2, 2, 0)),
                candidate("C", counters().bat(2, 2, 150).milestones(2, 2, 0)),
                candidate("D", counters().bat(3, 3, 60).milestones(1, 1, 0)),
                candidate("E", counters().bat(3, 3, 60).milestones(1, 0, 0)));
        Ranking thirties = rank(
                LeaderboardBoard.MOST_30S,
                candidate("A", counters().bat(3, 3, 90).milestones(3, 0, 0)),
                candidate("B", counters().bat(3, 3, 100).milestones(1, 0, 0)),
                candidate("C", counters().bat(3, 3, 10).milestones(0, 0, 0)));
        Ranking hundreds = rank(
                LeaderboardBoard.MOST_100S,
                candidate("A", counters().bat(3, 3, 300).milestones(3, 3, 2)),
                candidate("B", counters().bat(3, 3, 120).milestones(1, 1, 1)),
                candidate("C", counters().bat(3, 3, 90).milestones(1, 1, 0)));

        assertThat(order(fifties)).containsExactly("B:1", "C:2", "A:3", "D:4");
        assertThat(order(thirties)).containsExactly("A:1", "B:2");
        assertThat(order(hundreds)).containsExactly("A:1", "B:2");
    }

    @Test
    void mostNotOutsOrdersByCountThenMoreRunsThenFewerInnings() {
        Ranking r = rank(
                LeaderboardBoard.MOST_NOT_OUTS,
                candidate("A", counters().bat(4, 2, 100)),
                candidate("B", counters().bat(3, 1, 100)),
                candidate("C", counters().bat(3, 3, 50)),
                candidate("D", counters().bat(4, 3, 200)),
                candidate("E", counters().bat(2, 0, 80)),
                candidate("F", counters().bat(3, 1, 100)));

        // not outs: A2, B2, C0, D1, E2, F2. Of the twos: more runs first (E has 80), then fewer innings; B and F are equal
        assertThat(order(r)).containsExactly("B:1", "F:1", "A:3", "E:4", "D:5");
    }

    // ---- bowling boards ----

    @Test
    void mostWicketsOrdersByWicketsThenFewerRunsThenFewerBalls() {
        Ranking r = rank(
                LeaderboardBoard.MOST_WICKETS,
                candidate("A", counters().bowl(2, 60, 50, 5)),
                candidate("B", counters().bowl(2, 60, 40, 5)),
                candidate("C", counters().bowl(2, 48, 40, 5)),
                candidate("D", counters().bowl(1, 24, 10, 0)),
                candidate("E", counters().bowl(3, 90, 80, 7)));

        assertThat(order(r)).containsExactly("E:1", "C:2", "B:3", "A:4");
    }

    @Test
    void bestBowlingOrdersByWicketsThenFewerRunsThenMoreBallsAndEqualInningsShareARank() {
        Ranking r = rank(
                LeaderboardBoard.BEST_BOWLING,
                candidate("A", counters().bowl(1, 24, 17, 4).best(4, 17, 24)),
                candidate("B", counters().bowl(1, 30, 17, 4).best(4, 17, 30)),
                candidate("C", counters().bowl(1, 30, 20, 4).best(4, 20, 30)),
                candidate("D", counters().bowl(1, 30, 60, 5).best(5, 60, 30)),
                candidate("E", counters().bowl(1, 24, 10, 0)),
                candidate("F", counters().bowl(1, 24, 17, 4).best(4, 17, 24)));

        assertThat(order(r)).containsExactly("D:1", "B:2", "A:3", "F:3", "C:5");
        assertThat(r.rows().get(0).figure()).isEqualTo(new LeaderboardWicketsRuns(5, 60));
    }

    @Test
    void bowlingAverageOrdersLowestFirstThenMoreWicketsThenMoreOversAndWicketlessBowlersAreLastUnranked() {
        Ranking r = rank(
                LeaderboardBoard.BOWLING_AVERAGE,
                candidate("A", counters().bowl(2, 60, 100, 5)),
                candidate("B", counters().bowl(2, 48, 80, 4)),
                candidate("C", counters().bowl(3, 90, 100, 5)),
                candidate("D", counters().bowl(1, 30, 30, 3)),
                candidate("E", counters().bowl(2, 60, 50, 0)),
                candidate("F", counters().bowl(1, 12, 10, 0)),
                candidate("G", counters()));

        // A, B, C average 20: more wickets first (A and C over B), then more overs (C over A)
        assertThat(order(r)).containsExactly("D:1", "C:2", "A:3", "B:4", "E:-", "F:-");
        assertThat(r.rows().get(4).figure()).isNull();
        assertThat(r.leaders()).extracting(LeaderboardRow::firstName).containsExactly("D");
    }

    @Test
    void economyOrdersLowestFirstThenMoreWicketsThenMoreOversAndExcludesNoBalls() {
        Ranking r = rank(
                LeaderboardBoard.ECONOMY_RATE,
                candidate("A", counters().bowl(1, 36, 36, 2)),
                candidate("B", counters().bowl(1, 36, 36, 3)),
                candidate("C", counters().bowl(2, 72, 72, 3)),
                candidate("D", counters().bowl(1, 24, 12, 1)),
                candidate("E", counters().bowl(1, 0, 5, 0)));

        assertThat(order(r)).containsExactly("D:1", "C:2", "B:3", "A:4");
        assertThat(r.rows().get(0).figure()).isEqualTo(new BigDecimal("3.00"));
    }

    @Test
    void bowlingStrikeRateOrdersLowestFirstThenMoreWicketsAndWicketlessBowlersAreLastUnranked() {
        Ranking r = rank(
                LeaderboardBoard.BOWLING_STRIKE_RATE,
                candidate("A", counters().bowl(1, 30, 40, 5)),
                candidate("B", counters().bowl(1, 60, 50, 10)),
                candidate("C", counters().bowl(2, 72, 60, 12)),
                candidate("D", counters().bowl(1, 24, 30, 0)),
                candidate("E", counters().bowl(1, 18, 5, 0)));

        // A, B, C all take a wicket every 6 balls: more wickets first
        assertThat(order(r)).containsExactly("C:1", "B:2", "A:3", "D:-", "E:-");
    }

    @Test
    void mostMaidensOrdersByCountThenMoreOversThenMoreWickets() {
        Ranking r = rank(
                LeaderboardBoard.MOST_MAIDENS,
                candidate("A", withMaidens(counters().bowl(1, 60, 30, 1), 3)),
                candidate("B", withMaidens(counters().bowl(2, 72, 30, 1), 3)),
                candidate("C", withMaidens(counters().bowl(2, 72, 30, 2), 3)),
                candidate("D", withMaidens(counters().bowl(1, 30, 10, 0), 5)),
                candidate("E", withMaidens(counters().bowl(1, 30, 10, 0), 0)));

        assertThat(order(r)).containsExactly("D:1", "C:2", "B:3", "A:4");
    }

    @Test
    void wicketHaulBoardsCountTheirOwnBandOnlyThenMoreWicketsThenFewerRuns() {
        Candidate p = candidate("P", counters().bowl(6, 120, 100, 12).hauls(1, 2, 3));
        Candidate q = candidate("Q", counters().bowl(3, 72, 80, 12).hauls(0, 3, 0));
        Candidate r = candidate("R", counters().bowl(7, 150, 120, 20).hauls(2, 0, 5));

        assertThat(order(rank(LeaderboardBoard.MOST_3W, p, q, r))).containsExactly("R:1", "P:2");
        assertThat(order(rank(LeaderboardBoard.MOST_4W, p, q, r))).containsExactly("Q:1", "P:2");
        assertThat(order(rank(LeaderboardBoard.MOST_5W, p, q, r))).containsExactly("R:1", "P:2");
    }

    @Test
    void wicketHaulTiesBreakOnWicketsThenFewerRunsConceded() {
        Ranking r = rank(
                LeaderboardBoard.MOST_3W,
                candidate("A", counters().bowl(3, 72, 60, 6).hauls(2, 0, 0)),
                candidate("B", counters().bowl(3, 72, 60, 8).hauls(2, 0, 0)),
                candidate("C", counters().bowl(3, 72, 40, 6).hauls(2, 0, 0)),
                candidate("D", counters().bowl(3, 72, 40, 3).hauls(1, 0, 0)));

        assertThat(order(r)).containsExactly("B:1", "C:2", "A:3", "D:4");
    }

    @Test
    void mostDotBallsOrdersByCountThenHigherDotPercentageThenMoreOvers() {
        Ranking r = rank(
                LeaderboardBoard.MOST_DOT_BALLS,
                candidate("A", counters().bowl(2, 60, 40, 3).dots(2, 30, 60)),
                candidate("B", counters().bowl(2, 60, 40, 3).dots(2, 30, 50)),
                candidate("C", counters().bowl(2, 72, 40, 3).dots(2, 30, 60)),
                candidate("D", counters().bowl(2, 60, 40, 3).dots(1, 40, 60)),
                candidate("E", counters().bowl(2, 60, 40, 3)),
                candidate("F", counters().bowl(2, 60, 40, 3).dots(1, 0, 30)));

        assertThat(order(r)).containsExactly("D:1", "B:2", "C:3", "A:4");
    }

    // ---- fielding and awards boards ----

    @Test
    void fieldingBoardsOrderByCountThenFewerMatchesAndNeedAMatch() {
        Ranking catches = rank(
                LeaderboardBoard.MOST_CATCHES,
                candidate("A", counters().matches(5).fielding(4, 0, 0)),
                candidate("B", counters().matches(3).fielding(4, 0, 0)),
                candidate("C", counters().matches(3).fielding(6, 0, 0)),
                candidate("D", counters().matches(4)),
                candidate("E", counters().matches(0).fielding(9, 0, 0)));
        Ranking stumpings = rank(
                LeaderboardBoard.MOST_STUMPINGS,
                candidate("A", counters().matches(5).fielding(0, 2, 0)),
                candidate("B", counters().matches(3).fielding(0, 2, 0)));
        Ranking runOuts = rank(
                LeaderboardBoard.MOST_RUN_OUTS,
                candidate("A", counters().matches(5).fielding(0, 0, 1)),
                candidate("B", counters().matches(3).fielding(0, 0, 3)));

        assertThat(order(catches)).containsExactly("C:1", "B:2", "A:3");
        assertThat(order(stumpings)).containsExactly("B:1", "A:2");
        assertThat(order(runOuts)).containsExactly("B:1", "A:2");
    }

    @Test
    void fieldingDismissalsOrderByTotalThenFewerMatchesThenMoreCatches() {
        Ranking r = rank(
                LeaderboardBoard.MOST_FIELDING_DISMISSALS,
                candidate("A", counters().matches(4).fielding(2, 1, 0)),
                candidate("B", counters().matches(4).fielding(3, 0, 0)),
                candidate("C", counters().matches(2).fielding(1, 1, 1)),
                candidate("D", counters().matches(5).fielding(4, 1, 1)));

        assertThat(order(r)).containsExactly("D:1", "C:2", "B:3", "A:4");
    }

    @Test
    void playerOfTheMatchBoardsBreakTiesOnTheOtherAwardThenFewerMatches() {
        Ranking official = rank(
                LeaderboardBoard.MOST_POTM,
                candidate("A", counters().matches(5).awards(2, 1)),
                candidate("B", counters().matches(5).awards(2, 3)),
                candidate("C", counters().matches(3).awards(2, 3)),
                candidate("D", counters().matches(5).awards(1, 9)),
                candidate("E", counters().matches(5).awards(0, 5)));
        Ranking team = rank(
                LeaderboardBoard.MOST_TEAM_POTM,
                candidate("A", counters().matches(5).awards(1, 2)),
                candidate("B", counters().matches(5).awards(3, 2)),
                candidate("C", counters().matches(5).awards(0, 3)),
                candidate("D", counters().matches(5).awards(5, 0)));

        assertThat(order(official)).containsExactly("C:1", "B:2", "A:3", "D:4");
        assertThat(order(team)).containsExactly("C:1", "B:2", "A:3");
    }

    // ---- ranking rules ----

    @Test
    void competitionRankingSkipsAfterATie() {
        Ranking r = rank(
                LeaderboardBoard.MOST_RUNS,
                candidate("A", counters().bat(3, 3, 50)),
                candidate("B", counters().bat(3, 3, 40)),
                candidate("C", counters().bat(3, 3, 40)),
                candidate("D", counters().bat(3, 3, 30)));

        assertThat(order(r)).containsExactly("A:1", "B:2", "C:2", "D:4");
    }

    @Test
    void whenAllAreEqualEveryoneSharesRankOneAndIsListedByNameThenTheyAreJointLeaders() {
        Ranking r = rank(
                LeaderboardBoard.MOST_RUNS,
                candidate("carol", counters().bat(2, 2, 40)),
                candidate("Bob", counters().bat(2, 2, 40)),
                candidate("alice", counters().bat(2, 2, 40)));

        assertThat(order(r)).containsExactly("alice:1", "Bob:1", "carol:1");
        assertThat(r.leaders()).hasSize(3);
    }

    @Test
    void leadersAreEveryPlayerAtRankOneAndNobodyElse() {
        Ranking r = rank(
                LeaderboardBoard.MOST_WICKETS,
                candidate("A", counters().bowl(2, 48, 40, 6)),
                candidate("B", counters().bowl(2, 48, 40, 6)),
                candidate("C", counters().bowl(2, 48, 40, 3)));

        assertThat(r.leaders()).extracting(LeaderboardRow::firstName).containsExactly("A", "B");
    }

    @Test
    void anEmptyBoardIsEmptyNotAnError() {
        Ranking r = rank(LeaderboardBoard.MOST_RUNS, (Integer) null);

        assertThat(r.rows()).isEmpty();
        assertThat(r.listed()).isZero();
        assertThat(r.ranked()).isZero();
        assertThat(r.belowMinimum()).isZero();
        assertThat(r.leaders()).isEmpty();
    }

    @Test
    void countingBoardsListNobodyWithAZeroCount() {
        Ranking r = rank(
                LeaderboardBoard.MOST_WICKETS,
                candidate("A", counters().bowl(2, 48, 40, 0)),
                candidate("B", counters().bowl(2, 48, 40, 0)));

        assertThat(r.rows()).isEmpty();
    }

    @Test
    void aOneInningsPlayerIsRankedWithNoMinimum() {
        Ranking r = rank(
                LeaderboardBoard.BATTING_AVERAGE,
                candidate("A", counters().bat(1, 1, 100)),
                candidate("B", counters().bat(10, 10, 400)));

        assertThat(order(r)).containsExactly("A:1", "B:2");
        assertThat(r.belowMinimum()).isZero();
    }

    // ---- optional minimum ----

    @Test
    void aBattingMinimumKeepsAPlayerExactlyAtItAndRemovesAndCountsOneBelow() {
        Candidate atMinimum = candidate("A", counters().bat(3, 3, 90));
        Candidate below = candidate("B", counters().bat(2, 2, 200));
        Candidate neverOut = candidate("C", counters().bat(2, 0, 90));
        Candidate neverOutEnough = candidate("D", counters().bat(4, 0, 90));

        Ranking r = rank(LeaderboardBoard.BATTING_AVERAGE, 3, atMinimum, below, neverOut, neverOutEnough);

        assertThat(order(r)).containsExactly("A:1", "D:-");
        assertThat(r.belowMinimum()).isEqualTo(2);
        assertThat(r.listed()).isEqualTo(2);
    }

    @Test
    void clearingTheMinimumRestoresEveryone() {
        Candidate a = candidate("A", counters().bat(3, 3, 90));
        Candidate b = candidate("B", counters().bat(2, 2, 200));

        Ranking r = rank(LeaderboardBoard.BATTING_AVERAGE, (Integer) null, a, b);

        assertThat(order(r)).containsExactly("B:1", "A:2");
        assertThat(r.belowMinimum()).isZero();
    }

    @Test
    void theStrikeRateMinimumCountsOnlyInningsThatRecordedBalls() {
        Candidate fiveInningsTwoWithBalls = candidate("A", counters().bat(5, 5, 100).ballsOn(2, 40, 40));
        Candidate threeWithBalls = candidate("B", counters().bat(3, 3, 60).ballsOn(3, 60, 60));

        Ranking r = rank(LeaderboardBoard.STRIKE_RATE, 3, fiveInningsTwoWithBalls, threeWithBalls);

        assertThat(order(r)).containsExactly("B:1");
        assertThat(r.belowMinimum()).isEqualTo(1);
    }

    @Test
    void anOversMinimumUsesOversBowledAndKeepsExactlyAtTheMinimum() {
        Candidate exactly = candidate("A", counters().bowl(1, 24, 20, 2)); // 4.0 overs
        Candidate justBelow = candidate("B", counters().bowl(1, 23, 10, 2)); // 3.5 overs
        Candidate unequalOvers = candidate("C", counters().bowl(2, 43, 41, 3).overs("8").ballsPerOver(5, 6));

        Ranking r = rank(LeaderboardBoard.ECONOMY_RATE, 4, exactly, justBelow, unequalOvers);

        // A: 20 / 4 = 5.00; C: 41 / 8 = 5.125 -> 5.13; B (3.5 overs) is below the minimum
        assertThat(order(r)).containsExactly("A:1", "C:2");
        assertThat(r.belowMinimum()).isEqualTo(1);
    }

    @Test
    void theMinimumIsIgnoredOnABoardWithoutOne() {
        Ranking r = rank(
                LeaderboardBoard.MOST_RUNS,
                99,
                candidate("A", counters().bat(1, 1, 5)),
                candidate("B", counters().bat(2, 2, 50)));

        assertThat(order(r)).containsExactly("B:1", "A:2");
        assertThat(r.belowMinimum()).isZero();
    }

    // ---- small sample and sample ----

    @Test
    void smallSampleFlagsRowsUnderTheDefaultsWithoutChangingTheFigure() {
        Ranking r = rank(
                LeaderboardBoard.BATTING_AVERAGE,
                candidate("A", counters().bat(2, 2, 100)),
                candidate("B", counters().bat(3, 3, 90)));

        LeaderboardRow small = r.rows().get(0);
        LeaderboardRow enough = r.rows().get(1);
        assertThat(small.firstName()).isEqualTo("A");
        assertThat(small.smallSample()).isTrue();
        assertThat(small.figure()).isEqualTo(new BigDecimal("50.00"));
        assertThat(small.sample().innings()).isEqualTo(2);
        assertThat(enough.smallSample()).isFalse();
    }

    @Test
    void strikeRateSampleIsTheInningsThatRecordedBalls() {
        Ranking r = rank(
                LeaderboardBoard.STRIKE_RATE,
                candidate("A", counters().bat(5, 5, 100).ballsOn(2, 40, 40)));

        assertThat(r.rows().get(0).smallSample()).isTrue();
        assertThat(r.rows().get(0).sample().innings()).isEqualTo(2);
        assertThat(r.rows().get(0).sample().ballsFaced()).isEqualTo(40);
    }

    @Test
    void bowlingSampleCarriesBallsOversWicketsAndTheOverLength() {
        Ranking r = rank(
                LeaderboardBoard.ECONOMY_RATE,
                candidate("A", counters().bowl(1, 33, 20, 2)),
                candidate("B", counters().bowl(1, 36, 20, 2)));

        LeaderboardRow five = r.rows().stream().filter(x -> x.firstName().equals("A")).findFirst().orElseThrow();
        LeaderboardRow six = r.rows().stream().filter(x -> x.firstName().equals("B")).findFirst().orElseThrow();
        assertThat(five.smallSample()).isTrue(); // 5.5 overs under 6
        assertThat(five.sample().balls()).isEqualTo(33);
        assertThat(five.sample().overs()).isEqualByComparingTo("5.50");
        assertThat(five.sample().ballsPerOver()).isEqualTo(6);
        assertThat(five.sample().wickets()).isEqualTo(2);
        assertThat(six.smallSample()).isFalse(); // exactly 6 overs
    }

    @Test
    void mixedOverLengthsHaveNoOversOrOverLengthInTheSample() {
        Ranking r = rank(
                LeaderboardBoard.ECONOMY_RATE,
                candidate("A", counters().bowl(2, 43, 41, 3).overs("8").ballsPerOver(5, 6)));

        assertThat(r.rows().get(0).sample().overs()).isNull();
        assertThat(r.rows().get(0).sample().ballsPerOver()).isNull();
        assertThat(r.rows().get(0).sample().balls()).isEqualTo(43);
    }

    @Test
    void countingBoardRowsCarryNoSampleAndAreNeverSmall() {
        Ranking r = rank(LeaderboardBoard.MOST_RUNS, candidate("A", counters().bat(1, 1, 5)));

        assertThat(r.rows().get(0).sample()).isNull();
        assertThat(r.rows().get(0).smallSample()).isFalse();
        assertThat(r.rows().get(0).innings()).isEqualTo(1);
    }

    // ---- coverage ----

    @Test
    void coverageIsReportedOnlyForBoardsBuiltOnOptionalColumns() {
        Candidate a = candidate("A", counters().bat(5, 5, 100).ballsOn(2, 40, 40));
        Candidate b = candidate("B", counters().bat(3, 3, 60).ballsOn(3, 60, 60));

        var coverage = LeaderboardRanker.coverage(LeaderboardBoard.STRIKE_RATE, List.of(a, b));

        assertThat(coverage.used()).isEqualTo(5);
        assertThat(coverage.counted()).isEqualTo(8);
        assertThat(LeaderboardRanker.coverage(LeaderboardBoard.MOST_RUNS, List.of(a, b))).isNull();
    }

    @Test
    void dotBallCoverageIsInningsWithDotsOutOfInningsBowled() {
        Candidate a = candidate("A", counters().bowl(4, 96, 50, 3).dots(1, 10, 24));

        var coverage = LeaderboardRanker.coverage(LeaderboardBoard.MOST_DOT_BALLS, List.of(a));

        assertThat(coverage.used()).isEqualTo(1);
        assertThat(coverage.counted()).isEqualTo(4);
    }

    // ---- why a category has no leader ----

    @Test
    void anOmittedCategoryGetsTheReasonThatMatchesWhyNobodyQualified() {
        Candidate neverOut = candidate("A", counters().bat(2, 0, 80));
        Candidate wicketless = candidate("B", counters().bowl(1, 24, 20, 0));

        Ranking battingNone = rank(LeaderboardBoard.BATTING_AVERAGE, neverOut);
        Ranking battingBelow = rank(LeaderboardBoard.BATTING_AVERAGE, 5, neverOut);
        Ranking bowlingNone = rank(LeaderboardBoard.BOWLING_AVERAGE, wicketless);
        Ranking bowlingBelow = rank(LeaderboardBoard.ECONOMY_RATE, 10, wicketless);
        Ranking nobody = rank(LeaderboardBoard.MOST_SIXES, (Integer) null);

        assertThat(LeaderboardRanker.omissionReason(LeaderboardBoard.BATTING_AVERAGE, battingNone, null))
                .contains("dismissed");
        assertThat(LeaderboardRanker.omissionReason(LeaderboardBoard.BATTING_AVERAGE, battingBelow, 5))
                .isEqualTo("No batter reached the minimum of 5 innings.");
        assertThat(LeaderboardRanker.omissionReason(LeaderboardBoard.BOWLING_AVERAGE, bowlingNone, null))
                .contains("wicket");
        assertThat(LeaderboardRanker.omissionReason(LeaderboardBoard.ECONOMY_RATE, bowlingBelow, 10))
                .isEqualTo("No bowler reached the minimum of 10 overs.");
        assertThat(LeaderboardRanker.omissionReason(LeaderboardBoard.MOST_SIXES, nobody, null))
                .isEqualTo("Nobody has a figure for this category in these results.");
    }

    @Test
    void aCategoryWithALeaderHasNoOmissionReason() {
        Ranking r = rank(LeaderboardBoard.MOST_RUNS, candidate("A", counters().bat(1, 1, 5)));

        assertThat(LeaderboardRanker.omissionReason(LeaderboardBoard.MOST_RUNS, r, null)).isNull();
    }

    // ---- catalogue ----

    @Test
    void theNineHeadlineCategoriesAreTheAwardDefaultsAndAreAllEligible() {
        assertThat(LeaderboardBoard.awardDefaults()).hasSize(9).allMatch(LeaderboardBoard::isAwardEligible);
        assertThat(LeaderboardBoard.awardEligibleBoards()).containsAll(LeaderboardBoard.awardDefaults());
        assertThat(LeaderboardBoard.byCode("MOST_RUNS")).contains(LeaderboardBoard.MOST_RUNS);
        assertThat(LeaderboardBoard.byCode("most_runs")).isEmpty();
    }

    private static PlayerStatsTestData.Counters withMaidens(PlayerStatsTestData.Counters c, long maidens) {
        c.maidens = maidens;
        return c;
    }
}
