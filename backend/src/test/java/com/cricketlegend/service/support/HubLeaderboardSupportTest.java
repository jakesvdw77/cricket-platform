package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.dto.MyLeaderboardStandingDto;
import com.cricketlegend.dto.MyLeaderboardStandingDto.MyStandingLine;
import com.cricketlegend.dto.MyLeaderboardTableDto.MyLeaderboardScope;
import com.cricketlegend.dto.MyStatsDto;
import com.cricketlegend.service.support.LeaderboardBoard.Group;
import com.cricketlegend.service.support.LeaderboardRanker.Candidate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/147 Test Plan: the pure Player Hub leaderboard pieces. {@code HubRankingPolicy}, the "More Columns" flags,
 * the league reach and the eight standing lines of {@code MyLeaderboardBuilder}.
 */
class HubLeaderboardSupportTest {

    private static final MyLeaderboardScope SCOPE = new MyLeaderboardScope(null, null, null);

    // ---- HubRankingPolicy ----

    @Test
    void everyClubAllowsRankingsWhileTheOwnerTakesLegalAdvice() {
        HubRankingPolicy policy = new HubRankingPolicy();
        assertThat(policy.allowsRankings(UUID.randomUUID())).isTrue();
        assertThat(policy.allowsRankings(null)).isTrue();
    }

    // ---- HubLeaderboardColumns ----

    @Test
    void theFoldedColumnsAreExactlyTheSpecifiedBattingAndBowlingOnesAndFieldingHasNone() {
        List<LeaderboardColumn> folded = new ArrayList<>();
        for (LeaderboardColumn c : LeaderboardColumn.values()) {
            if (HubLeaderboardColumns.isMore(c)) {
                folded.add(c);
            }
        }
        assertThat(folded).containsExactlyInAnyOrder(
                LeaderboardColumn.BAT_BALLS, LeaderboardColumn.BAT_STRIKE_RATE, LeaderboardColumn.BAT_OUTS,
                LeaderboardColumn.BAT_HUNDRED_PLUS, LeaderboardColumn.BOWL_MAIDENS, LeaderboardColumn.BOWL_DOTS,
                LeaderboardColumn.BOWL_STRIKE_RATE, LeaderboardColumn.BOWL_FOUR_W, LeaderboardColumn.BOWL_FIVE_W);
        // the headline columns stay visible
        assertThat(HubLeaderboardColumns.isMore(LeaderboardColumn.BAT_RUNS)).isFalse();
        assertThat(HubLeaderboardColumns.isMore(LeaderboardColumn.BOWL_WICKETS)).isFalse();
        assertThat(HubLeaderboardColumns.isMore(LeaderboardColumn.FIELD_CATCHES)).isFalse();
        assertThat(HubLeaderboardColumns.hasMore(Group.BATTING)).isTrue();
        assertThat(HubLeaderboardColumns.hasMore(Group.BOWLING)).isTrue();
        assertThat(HubLeaderboardColumns.hasMore(Group.FIELDING)).isFalse();
    }

    // ---- HubLeaderboardReach ----

    @Test
    void reachKeepsOnlySeasonAndLeaguePairsAndAnswersPerSeason() {
        UUID s1 = UUID.randomUUID();
        UUID s2 = UUID.randomUUID();
        UUID l1 = UUID.randomUUID();
        UUID l2 = UUID.randomUUID();
        HubLeaderboardReach reach = HubLeaderboardReach.of(List.of(
                new HubLeaderboardReach.SeasonLeague(s1, l1),
                new HubLeaderboardReach.SeasonLeague(s1, l1),
                new HubLeaderboardReach.SeasonLeague(s2, l2),
                new HubLeaderboardReach.SeasonLeague(s1, null), // a friendly has no league
                new HubLeaderboardReach.SeasonLeague(null, l1)));

        assertThat(reach.pairs()).hasSize(2);
        assertThat(reach.leagueIds(s1)).containsExactly(l1);
        assertThat(reach.leagueIds(s2)).containsExactly(l2);
        assertThat(reach.leagueIds(null)).containsExactlyInAnyOrder(l1, l2);
        assertThat(reach.leagueIds(UUID.randomUUID())).isEmpty();
        assertThat(reach.contains(s1, l1)).isTrue();
        assertThat(reach.contains(s1, l2)).isFalse(); // a league the player's teams did not play in that season
        assertThat(reach.contains(null, l1)).isFalse();
    }

    @Test
    void anEmptyReachReachesNothing() {
        HubLeaderboardReach reach = HubLeaderboardReach.of(List.of());
        assertThat(reach.leagueIds(null)).isEmpty();
        assertThat(reach.contains(UUID.randomUUID(), UUID.randomUUID())).isFalse();
    }

    // ---- MyLeaderboardBuilder.standing ----

    /** Three players, M = 4 so the default minimums are 2 innings and 4 overs. */
    private record Cast(Candidate me, Candidate steady, Candidate oneBigInnings, LeaderboardPlayers loaded) {
    }

    private static Cast cast() {
        // me: 4 innings, 2 dismissals, 100 runs (avg 50.00) off 100 balls, 10 fours 2 sixes; 5 wickets in 10 overs (conceding 30);
        // 3 catches
        Candidate me = PlayerStatsTestData.candidate("Sam", PlayerStatsTestData.counters()
                .matches(4).bat(4, 2, 100).ballsOn(4, 100, 100).fours(10).sixes(2).bowl(2, 60, 30, 5).fielding(3, 0, 0));
        // steady: 4 innings all out, 60 runs (avg 15.00) off 100 balls, 12 fours; 5 catches; bowls 8 overs for 40 runs, 2 wickets
        Candidate steady = PlayerStatsTestData.candidate("Tom", PlayerStatsTestData.counters()
                .matches(4).bat(4, 4, 60).ballsOn(4, 60, 100).fours(12).bowl(2, 48, 40, 2).fielding(5, 0, 0));
        // one innings of 200: below the 2-innings minimum for the average, no bowling, no catches
        Candidate big = PlayerStatsTestData.candidate("Bo", PlayerStatsTestData.counters()
                .matches(1).bat(1, 1, 200).ballsOn(1, 200, 100).fours(30).sixes(5));
        return new Cast(me, steady, big, new LeaderboardPlayers(null, List.of(me, steady, big), 9));
    }

    @Test
    void standingHasTheEightLinesInOrderRunsAverageStrikeRateFoursSixesWicketsEconomyCatches() {
        Cast cast = cast();
        MyLeaderboardStandingDto s = MyLeaderboardBuilder.standing(cast.loaded(), cast.me().playerId(), "Sam", SCOPE);

        assertThat(s.lines()).extracting(MyStandingLine::key)
                .containsExactly("runs", "average", "strikeRate", "fours", "sixes", "wickets", "economy", "catches");
        assertThat(s.lines()).extracting(MyStandingLine::group)
                .containsExactly("batting", "batting", "batting", "batting", "batting", "bowling", "bowling", "fielding");
        assertThat(s.playerFirstName()).isEqualTo("Sam");
        assertThat(s.resultsCounted()).isEqualTo(9);
        assertThat(s.playersInReach()).isEqualTo(3);
    }

    @Test
    void standingRanksTheHeldPlayerAndAppliesTheMinimumToTheRateLinesOnly() {
        Cast cast = cast();
        List<MyStandingLine> lines =
                MyLeaderboardBuilder.standing(cast.loaded(), cast.me().playerId(), "Sam", SCOPE).lines();

        MyStandingLine runs = lines.get(0);
        assertThat(runs.rank()).isEqualTo(2); // 200, 100, 60
        assertThat(runs.minimum()).isNull(); // a count board has no minimum
        assertThat(runs.belowMinimum()).isFalse();
        assertThat(runs.sample().matches()).isEqualTo(4);
        assertThat(runs.sample().innings()).isEqualTo(4);

        MyStandingLine average = lines.get(1);
        assertThat(average.minimum().unit()).isEqualTo("INNINGS");
        assertThat(average.minimum().value()).isEqualTo(2);
        assertThat(average.rank()).isEqualTo(1); // the 200 has one innings: not ranked
        assertThat(average.playersRanked()).isEqualTo(2);

        MyStandingLine wickets = lines.get(5);
        assertThat(wickets.rank()).isEqualTo(1);
        MyStandingLine economy = lines.get(6);
        assertThat(economy.minimum().unit()).isEqualTo("OVERS");
        assertThat(economy.sample().balls()).isEqualTo(60);
        assertThat(economy.sample().overs()).isEqualByComparingTo("10.00");
        assertThat(economy.sample().ballsPerOver()).isEqualTo(6);
        MyStandingLine catches = lines.get(7);
        assertThat(catches.rank()).isEqualTo(2); // Tom has 5
        assertThat(catches.sample().innings()).isNull();
    }

    @Test
    void aPlayerBelowTheMinimumIsMarkedAndUnranked() {
        Cast cast = cast();
        MyStandingLine average = MyLeaderboardBuilder
                .standing(cast.loaded(), cast.oneBigInnings().playerId(), "Bo", SCOPE).lines().get(1);
        assertThat(average.rank()).isNull();
        assertThat(average.belowMinimum()).isTrue();
        assertThat(average.value()).isNotNull(); // the figure is still shown
    }

    @Test
    void aPlayerNotInTheReachHasNoRankValueOrSampleOnAnyLine() {
        Cast cast = cast();
        List<MyStandingLine> lines =
                MyLeaderboardBuilder.standing(cast.loaded(), UUID.randomUUID(), "Nobody", SCOPE).lines();
        assertThat(lines).hasSize(8);
        assertThat(lines).allSatisfy(l -> {
            assertThat(l.rank()).isNull();
            assertThat(l.value()).isNull();
            assertThat(l.sample()).isNull();
            assertThat(l.belowMinimum()).isFalse();
        });
    }

    @Test
    void standingOfAnEmptyReachHasEightEmptyLines() {
        MyLeaderboardStandingDto s = MyLeaderboardBuilder.standing(
                new LeaderboardPlayers(null, List.of(), 0), UUID.randomUUID(), "Sam", SCOPE);
        assertThat(s.lines()).hasSize(8);
        assertThat(s.playersInReach()).isZero();
        assertThat(s.lines()).allSatisfy(l -> assertThat(l.playersRanked()).isZero());
    }

    // ---- My stats blocks ----

    @Test
    void teamFieldingSumsTheStoredCreditsAndTheRankIsNullForAPlayerWithNoCatch() {
        Cast cast = cast();
        MyStatsDto.MyStatsTeamFielding f = MyLeaderboardBuilder.teamFielding(cast.loaded());
        assertThat(f.catches()).isEqualTo(8);
        assertThat(f.runOuts()).isZero();
        assertThat(f.stumpings()).isZero();
        assertThat(MyLeaderboardBuilder.teamFieldingRank(cast.loaded(), cast.me().playerId())).isEqualTo(2);
        assertThat(MyLeaderboardBuilder.teamFieldingRank(cast.loaded(), cast.oneBigInnings().playerId())).isNull();
        assertThat(MyLeaderboardBuilder.teamFielding(new LeaderboardPlayers(null, List.of(), 0)).catches()).isZero();
    }

    @Test
    void leagueBattingStandingIsNullWithoutAnInningsAndRankedUnderTheDefaultMinimum() {
        Cast cast = cast();
        MyStatsDto.MyStatsStanding mine = MyLeaderboardBuilder.leagueBattingStanding(cast.loaded(), cast.me().playerId());
        assertThat(mine.rank()).isEqualTo(1);
        assertThat(mine.playersRanked()).isEqualTo(2);
        assertThat(mine.average()).isEqualByComparingTo("50.00");
        assertThat(mine.innings()).isEqualTo(4);

        MyStatsDto.MyStatsStanding big = MyLeaderboardBuilder.leagueBattingStanding(cast.loaded(), cast.oneBigInnings().playerId());
        assertThat(big.rank()).isNull(); // below the minimum of two innings

        assertThat(MyLeaderboardBuilder.leagueBattingStanding(cast.loaded(), UUID.randomUUID())).isNull();
        Candidate noInnings = PlayerStatsTestData.candidate("Zed", PlayerStatsTestData.counters().matches(1).fielding(1, 0, 0));
        assertThat(MyLeaderboardBuilder.leagueBattingStanding(
                new LeaderboardPlayers(null, List.of(noInnings), 1), noInnings.playerId())).isNull();
        assertThat(Set.of(cast.me().playerId())).hasSize(1);
    }
}
