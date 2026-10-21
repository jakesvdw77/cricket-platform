package com.cricketlegend.service.support;

import static com.cricketlegend.service.support.TeamStatsTestData.candidate;
import static com.cricketlegend.service.support.TeamStatsTestData.counters;
import static com.cricketlegend.service.support.TeamStatsTestData.highKey;
import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.dto.TeamStatsTableDto.TeamStatsTableRow;
import com.cricketlegend.service.support.LeaderboardBoard.Direction;
import com.cricketlegend.service.support.TeamStatsTestData.Counters;
import com.cricketlegend.service.support.TeamTableRanker.Candidate;
import com.cricketlegend.service.support.TeamTableRanker.Table;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/116-team-stats.md, "The table (TeamStatsTableDto)": for one sort column, who is listed, in what order and with
 * what rank, in both directions, with the unranked group last, the optional minimum on rate sorts and paging. The
 * spec's column table is pinned column by column.
 */
class TeamTableRankerTest {

    private static final long E1 = 1_760_000_000L;
    private static final long E2 = 1_760_086_400L;

    private static Table rank(TeamStatsColumn sort, Candidate... teams) {
        return TeamTableRanker.rank(sort, sort.getDirection(), List.of(teams), null);
    }

    private static Table rank(TeamStatsColumn sort, Direction direction, Candidate... teams) {
        return TeamTableRanker.rank(sort, direction, List.of(teams), null);
    }

    private static Table rank(TeamStatsColumn sort, Integer minimum, Candidate... teams) {
        return TeamTableRanker.rank(sort, sort.getDirection(), List.of(teams), minimum);
    }

    /** "Name:rank" per row, rank "-" for the unranked group. */
    private static List<String> order(Table table) {
        return table.rows().stream()
                .map(row -> row.teamName() + ":" + (row.rank() == null ? "-" : row.rank()))
                .toList();
    }

    private static List<String> names(Table table) {
        return table.rows().stream().map(TeamStatsTableRow::teamName).toList();
    }

    private static Candidate team(String name, long won, long lost, long tied, long drawn, long noResult) {
        return candidate(name, counters().record(won, lost, tied, drawn, noResult));
    }

    private static Candidate team(String name, Counters c) {
        return candidate(name, c);
    }

    // ---- the column catalogue ----

    @Test
    void theFifteenColumnsAreInDisplayOrderWithTheSpecsCodes() {
        assertThat(Arrays.stream(TeamStatsColumn.values()).map(TeamStatsColumn::getCode))
                .containsExactly(
                        "played", "won", "lost", "tied", "drawn", "noResult", "winPercent", "runs", "battingAverage",
                        "runRate", "highTotal", "wicketsTaken", "bowlingAverage", "economy", "netRunRate");
        assertThat(TeamStatsColumn.defaultSort()).isEqualTo(TeamStatsColumn.WON);
    }

    @Test
    void naturalDirectionIsLowestOnlyForLossesBowlingAverageAndEconomy() {
        for (TeamStatsColumn column : TeamStatsColumn.values()) {
            boolean lower = column == TeamStatsColumn.LOST
                    || column == TeamStatsColumn.BOWLING_AVERAGE
                    || column == TeamStatsColumn.ECONOMY;
            assertThat(column.getDirection())
                    .as(column.getCode())
                    .isEqualTo(lower ? Direction.LOWEST : Direction.HIGHEST);
        }
    }

    @Test
    void theRateColumnsAreExactlyTheOnesWithAMinimum() {
        List<TeamStatsColumn> rates = Arrays.stream(TeamStatsColumn.values())
                .filter(column -> column.getMinimumKind() == TeamStatsColumn.MinimumKind.MATCHES)
                .toList();

        assertThat(rates)
                .containsExactly(
                        TeamStatsColumn.WIN_PERCENT,
                        TeamStatsColumn.BATTING_AVERAGE,
                        TeamStatsColumn.RUN_RATE,
                        TeamStatsColumn.BOWLING_AVERAGE,
                        TeamStatsColumn.ECONOMY,
                        TeamStatsColumn.NET_RUN_RATE);
    }

    @Test
    void byCodeFindsAColumnExactlyAndRefusesAnythingElse() {
        assertThat(TeamStatsColumn.byCode("winPercent")).contains(TeamStatsColumn.WIN_PERCENT);
        assertThat(TeamStatsColumn.byCode("WINPERCENT")).isEmpty();
        assertThat(TeamStatsColumn.byCode("nope")).isEmpty();
    }

    // ---- each column in turn: direction, inclusion, tie-breaks ----

    @Test
    void playedRanksMostFirstThenMostWinsThenName() {
        Table table = rank(
                TeamStatsColumn.PLAYED,
                team("A", 1, 4, 0, 0, 0), // 5 played, 1 win
                team("B", 3, 2, 0, 0, 0), // 5 played, 3 wins
                team("C", 0, 7, 0, 0, 0), // 7 played
                team("D", 1, 0, 0, 0, 0));

        assertThat(order(table)).containsExactly("C:1", "B:2", "A:3", "D:4");
    }

    @Test
    void wonRanksMostWinsThenHigherWinPercentThenFewerPlayedThenName() {
        Table table = rank(
                TeamStatsColumn.WON,
                team("A", 3, 1, 0, 0, 0), // 75.0%, played 4
                team("B", 3, 3, 0, 0, 0), // 50.0%
                team("C", 3, 1, 0, 0, 0), // identical to A
                team("D", 3, 1, 2, 0, 0)); // 75.0%, played 6

        assertThat(order(table)).containsExactly("A:1", "C:1", "D:3", "B:4");
    }

    @Test
    void lostRanksFewestLossesFirstThenFewerPlayed() {
        Table table = rank(
                TeamStatsColumn.LOST,
                team("A", 5, 0, 0, 0, 0), // 0 lost, played 5
                team("B", 2, 0, 0, 0, 0), // 0 lost, played 2
                team("C", 1, 4, 0, 0, 0),
                team("D", 0, 2, 0, 0, 0));

        assertThat(order(table)).containsExactly("B:1", "A:2", "D:3", "C:4");
    }

    @Test
    void tiedDrawnAndNoResultRankMostFirstThenMostWinsAndZeroIsStillRanked() {
        Table tied = rank(
                TeamStatsColumn.TIED,
                team("A", 1, 0, 3, 0, 0),
                team("B", 4, 0, 3, 0, 0),
                team("C", 0, 0, 1, 0, 0),
                team("D", 5, 0, 0, 0, 0));
        Table drawn = rank(
                TeamStatsColumn.DRAWN,
                team("A", 1, 0, 0, 3, 0),
                team("B", 4, 0, 0, 3, 0),
                team("C", 0, 0, 0, 1, 0));
        Table noResult = rank(
                TeamStatsColumn.NO_RESULT,
                team("A", 1, 0, 0, 0, 3),
                team("B", 4, 0, 0, 0, 3),
                team("C", 0, 0, 0, 0, 1));

        assertThat(order(tied)).containsExactly("B:1", "A:2", "C:3", "D:4"); // zero tied is ranked, never unranked
        assertThat(order(drawn)).containsExactly("B:1", "A:2", "C:3");
        assertThat(order(noResult)).containsExactly("B:1", "A:2", "C:3");
    }

    @Test
    void winPercentRanksHighestThenMostWinsThenMorePlayedAndNoDecisiveResultIsUnranked() {
        Table table = rank(
                TeamStatsColumn.WIN_PERCENT,
                team("A", 3, 1, 0, 0, 0), // 75.0
                team("B", 1, 0, 0, 0, 0), // 100.0, wins 1
                team("C", 0, 0, 4, 0, 0), // no decisive result
                team("D", 2, 0, 2, 0, 0), // 100.0, wins 2, played 4
                team("E", 2, 0, 0, 0, 0)); // 100.0, wins 2, played 2

        assertThat(order(table)).containsExactly("D:1", "E:2", "B:3", "A:4", "C:-");
    }

    @Test
    void runsRankMostFirstThenHigherRunsPerInningsThenFewerPlayedAndNoUsableInningsIsUnranked() {
        Counters none = counters().record(2, 0, 0, 0, 0);
        none.ownInnings = 2;
        Table table = rank(
                TeamStatsColumn.RUNS,
                team("A", counters().record(3, 2, 0, 0, 0).bat(3, 450, 10, 540, "90")), // 150 per innings
                team("B", counters().record(3, 2, 0, 0, 0).bat(2, 450, 10, 360, "60")), // 225 per innings, played 5
                team("D", counters().record(2, 1, 0, 0, 0).bat(2, 450, 10, 360, "60")), // 225 per innings, played 3
                team("C", none),
                team("E", counters().record(1, 0, 0, 0, 0).bat(1, 100, 4, 120, "20")));

        assertThat(order(table)).containsExactly("D:1", "B:2", "A:3", "E:4", "C:-");
    }

    @Test
    void battingAverageRanksHighestThenMostRunsThenMorePlayedAndNoWicketsLostIsUnranked() {
        Table table = rank(
                TeamStatsColumn.BATTING_AVERAGE,
                team("A", counters().record(3, 0, 0, 0, 0).bat(3, 450, 10, 540, "90")), // 45.00
                team("B", counters().record(3, 0, 0, 0, 0).bat(3, 300, 10, 540, "90")), // 30.00
                team("C", counters().record(5, 0, 0, 0, 0).bat(3, 900, 0, 540, "90")), // no wickets lost: unranked
                team("D", counters().record(4, 0, 0, 0, 0).bat(4, 900, 20, 720, "120")), // 45.00, more runs
                team("E", counters().record(4, 0, 0, 0, 0).bat(3, 450, 10, 540, "90"))); // 45.00 as A, more played

        assertThat(order(table)).containsExactly("D:1", "E:2", "A:3", "B:4", "C:-");
    }

    @Test
    void runRateRanksHighestThenMostRunsThenMorePlayedAndNoBallsIsUnranked() {
        Table table = rank(
                TeamStatsColumn.RUN_RATE,
                team("A", counters().record(3, 0, 0, 0, 0).bat(3, 360, 10, 360, "60")), // 6.00
                team("B", counters().record(3, 0, 0, 0, 0).bat(3, 300, 10, 360, "60")), // 5.00
                team("C", counters().record(3, 0, 0, 0, 0).bat(3, 100, 10, 0, "0")), // no balls recorded
                team("D", counters().record(3, 0, 0, 0, 0).bat(5, 600, 10, 600, "100"))); // 6.00, more runs

        assertThat(order(table)).containsExactly("D:1", "A:2", "B:3", "C:-");
    }

    @Test
    void highTotalRanksTheHighestFirstThenTheMoreRecentMatchAndNoInningsIsUnranked() {
        Counters a = counters().record(1, 0, 0, 0, 0);
        a.highTotalKey = highKey(250, 5, false, E1);
        Counters b = counters().record(1, 0, 0, 0, 0);
        b.highTotalKey = highKey(250, 9, true, E2);
        Counters c = counters().record(1, 0, 0, 0, 0);
        c.highTotalKey = highKey(180, 6, false, E2);
        Table table = rank(TeamStatsColumn.HIGH_TOTAL, team("A", a), team("B", b), team("C", c), team("D", counters()));

        assertThat(order(table)).containsExactly("B:1", "A:2", "C:3", "D:-");
    }

    @Test
    void wicketsTakenRanksMostFirstThenFewerRunsConcededAndNoOppositionInningsIsUnranked() {
        Table table = rank(
                TeamStatsColumn.WICKETS_TAKEN,
                team("A", counters().record(2, 0, 0, 0, 0).bowl(2, 400, 20, 480, "80")),
                team("B", counters().record(2, 0, 0, 0, 0).bowl(2, 300, 20, 480, "80")), // fewer runs conceded
                team("C", counters().record(2, 0, 0, 0, 0).bowl(2, 500, 25, 480, "80")),
                team("D", counters().record(2, 0, 0, 0, 0)), // no usable opposition innings
                team("E", counters().record(2, 0, 0, 0, 0).bowl(2, 90, 0, 480, "80"))); // zero wickets is a value

        assertThat(order(table)).containsExactly("C:1", "B:2", "A:3", "E:4", "D:-");
    }

    @Test
    void bowlingAverageRanksLowestFirstThenMostWicketsThenMorePlayedAndNoWicketsTakenIsUnrankedNotFirst() {
        Table table = rank(
                TeamStatsColumn.BOWLING_AVERAGE,
                team("A", counters().record(2, 0, 0, 0, 0).bowl(2, 400, 20, 480, "80")), // 20.00
                team("B", counters().record(2, 0, 0, 0, 0).bowl(2, 300, 20, 480, "80")), // 15.00
                team("C", counters().record(2, 0, 0, 0, 0).bowl(2, 100, 0, 480, "80")), // no wickets: not 0, not first
                team("D", counters().record(2, 0, 0, 0, 0).bowl(2, 800, 40, 480, "80"))); // 20.00, more wickets

        assertThat(order(table)).containsExactly("B:1", "D:2", "A:3", "C:-");
        assertThat(table.rows().get(3).values().get("bowlingAverage").value()).isNull();
    }

    @Test
    void economyRanksLowestFirstThenMostWicketsThenMorePlayedAndNoBallsIsUnranked() {
        Table table = rank(
                TeamStatsColumn.ECONOMY,
                team("A", counters().record(2, 0, 0, 0, 0).bowl(2, 400, 20, 480, "80")), // 5.00
                team("B", counters().record(2, 0, 0, 0, 0).bowl(2, 360, 10, 480, "80")), // 4.50
                team("C", counters().record(2, 0, 0, 0, 0).bowl(2, 360, 0, 0, "0")), // no balls recorded
                team("D", counters().record(2, 0, 0, 0, 0).bowl(2, 360, 15, 480, "80"))); // 4.50, more wickets

        assertThat(order(table)).containsExactly("D:1", "B:2", "A:3", "C:-");
    }

    @Test
    void netRunRateRanksHighestFirstThenMostWinsThenMorePlayedAndAnythingButShownIsUnranked() {
        Table table = rank(
                TeamStatsColumn.NET_RUN_RATE,
                team("A", counters().record(2, 0, 0, 0, 0).nrr(2, 130, "20", 120, "20", 1, 1)), // +0.50
                team("B", counters().record(1, 0, 0, 0, 0).nrr(1, 144, "20", 120, "20", 1, 1)), // +1.20
                team("C", counters().record(0, 2, 0, 0, 0).nrr(2, 114, "20", 120, "20", 1, 1)), // -0.30
                team("D", counters().record(3, 0, 0, 0, 0).nrr(3, 400, "60", 300, "60", 2, 1)), // two leagues
                team("E", counters().record(3, 0, 0, 0, 0)), // no usable result
                team("F", counters().record(4, 0, 0, 0, 0).nrr(4, 130, "20", 120, "20", 1, 1))); // +0.50, more wins

        assertThat(order(table)).containsExactly("B:1", "F:2", "A:3", "C:4", "D:-", "E:-");
    }

    // ---- ranking and the unranked group ----

    @Test
    void equalTeamsShareARankAndTheNextRankSkips() {
        Table table = rank(
                TeamStatsColumn.PLAYED,
                team("Top", 6, 0, 0, 0, 0),
                team("Cee", 2, 2, 0, 0, 0),
                team("Bee", 2, 2, 0, 0, 0),
                team("Last", 1, 1, 0, 0, 0));

        assertThat(order(table)).containsExactly("Top:1", "Bee:2", "Cee:2", "Last:4"); // 1, 2, 2, 4
    }

    @Test
    void theUnrankedGroupIsLastOrderedByNameWithANullRankAndNoValue() {
        Table table = rank(
                TeamStatsColumn.WIN_PERCENT,
                team("Zed", 0, 0, 3, 0, 0),
                team("Mid", 1, 1, 0, 0, 0),
                team("Abe", 0, 0, 0, 2, 0),
                team("Top", 3, 0, 0, 0, 0));

        assertThat(order(table)).containsExactly("Top:1", "Mid:2", "Abe:-", "Zed:-");
        assertThat(table.ranked()).isEqualTo(2);
        assertThat(table.listed()).isEqualTo(4);
        assertThat(table.rows().get(2).values().get("winPercent").value()).isNull();
    }

    @Test
    void ifEveryTeamIsUnrankedNoneGetsARank() {
        Table table = rank(TeamStatsColumn.BOWLING_AVERAGE, team("B", 1, 0, 0, 0, 0), team("A", 1, 0, 0, 0, 0));

        assertThat(order(table)).containsExactly("A:-", "B:-");
        assertThat(table.ranked()).isZero();
    }

    @Test
    void nameOrderIsCaseInsensitive() {
        Table table = rank(TeamStatsColumn.PLAYED, team("beta", 1, 0, 0, 0, 0), team("Alpha", 1, 0, 0, 0, 0));

        assertThat(names(table)).containsExactly("Alpha", "beta");
    }

    @Test
    void anEmptyListGivesAnEmptyTable() {
        Table table = TeamTableRanker.rank(TeamStatsColumn.WON, Direction.HIGHEST, List.of(), null);

        assertThat(table.rows()).isEmpty();
        assertThat(table.listed()).isZero();
        assertThat(table.ranked()).isZero();
        assertThat(table.belowMinimum()).isZero();
    }

    // ---- reversing ----

    @Test
    void reversingFlipsThePrimaryKeyOnlyAndKeepsTheTieBreaksInTheirOrder() {
        Table table = rank(
                TeamStatsColumn.WON,
                Direction.LOWEST,
                team("A", 3, 1, 0, 0, 0), // 3 wins, 75.0%
                team("B", 3, 3, 0, 0, 0), // 3 wins, 50.0%
                team("C", 1, 0, 0, 0, 0)); // 1 win

        // fewest wins first; within the 3-win tie the win percentage is STILL highest first (A before B)
        assertThat(order(table)).containsExactly("C:1", "A:2", "B:3");
    }

    @Test
    void reversingTheNaturallyLowestColumnsPutsTheHighestFirst() {
        Table table = rank(
                TeamStatsColumn.LOST,
                Direction.HIGHEST,
                team("A", 0, 1, 0, 0, 0),
                team("B", 0, 5, 0, 0, 0),
                team("C", 0, 3, 0, 0, 0));

        assertThat(order(table)).containsExactly("B:1", "C:2", "A:3");
    }

    @Test
    void reversingKeepsTheUnrankedGroupLastEvenWhenAscending() {
        Table table = rank(
                TeamStatsColumn.WIN_PERCENT,
                Direction.LOWEST,
                team("Z", 0, 0, 3, 0, 0), // unranked
                team("A", 3, 1, 0, 0, 0), // 75.0
                team("B", 1, 1, 0, 0, 0)); // 50.0

        assertThat(order(table)).containsExactly("B:1", "A:2", "Z:-");
    }

    @Test
    void reversingABowlingAverageNeverRanksTheNoWicketsTeamFirst() {
        Table table = rank(
                TeamStatsColumn.BOWLING_AVERAGE,
                Direction.HIGHEST,
                team("A", counters().record(2, 0, 0, 0, 0).bowl(2, 400, 20, 480, "80")), // 20.00
                team("B", counters().record(2, 0, 0, 0, 0).bowl(2, 300, 20, 480, "80")), // 15.00
                team("C", counters().record(2, 0, 0, 0, 0).bowl(2, 100, 0, 480, "80"))); // no wickets

        assertThat(order(table)).containsExactly("A:1", "B:2", "C:-");
    }

    // ---- the optional minimum ----

    @Test
    void aTeamExactlyAtTheMinimumIsRankedAndOneBelowIsRemovedAndCounted() {
        Table table = rank(
                TeamStatsColumn.WIN_PERCENT,
                3,
                team("AtMinimum", 2, 1, 0, 0, 0), // played 3
                team("Above", 3, 1, 0, 0, 0), // played 4
                team("OneBelow", 2, 0, 0, 0, 0)); // played 2, even at 100%

        assertThat(names(table)).containsExactly("Above", "AtMinimum"); // 75.0, 66.7
        assertThat(table.belowMinimum()).isEqualTo(1);
        assertThat(table.listed()).isEqualTo(2);
    }

    @Test
    void aTeamBelowTheMinimumIsCountedEvenWhenItWouldHaveBeenUnranked() {
        Table table = rank(TeamStatsColumn.WIN_PERCENT, 3, team("A", 0, 0, 2, 0, 0), team("B", 2, 1, 0, 0, 0));

        assertThat(names(table)).containsExactly("B");
        assertThat(table.belowMinimum()).isEqualTo(1);
    }

    @Test
    void theMinimumAppliesToEveryRateSort() {
        for (TeamStatsColumn rate : TeamStatsColumn.values()) {
            if (rate.getMinimumKind() != TeamStatsColumn.MinimumKind.MATCHES) {
                continue;
            }
            Table table = rank(rate, 5, team("Small", 1, 0, 0, 0, 0), team("Big", 5, 0, 0, 0, 0));
            assertThat(table.belowMinimum()).as(rate.getCode()).isEqualTo(1);
            assertThat(names(table)).as(rate.getCode()).containsExactly("Big");
        }
    }

    @Test
    void theMinimumIsIgnoredOnACountSort() {
        for (TeamStatsColumn count : TeamStatsColumn.values()) {
            if (count.getMinimumKind() != TeamStatsColumn.MinimumKind.NONE) {
                continue;
            }
            Table table = rank(count, 50, team("Small", 1, 0, 0, 0, 0), team("Big", 5, 0, 0, 0, 0));
            assertThat(table.belowMinimum()).as(count.getCode()).isZero();
            assertThat(table.listed()).as(count.getCode()).isEqualTo(2);
        }
    }

    @Test
    void aMinimumOfZeroOrNullRemovesNobody() {
        assertThat(rank(TeamStatsColumn.WIN_PERCENT, 0, team("A", 1, 0, 0, 0, 0)).belowMinimum()).isZero();
        assertThat(rank(TeamStatsColumn.WIN_PERCENT, (Integer) null, team("A", 1, 0, 0, 0, 0)).listed()).isEqualTo(1);
    }

    // ---- paging ----

    private static Table sevenTeamsWithTies() {
        List<Candidate> teams = new ArrayList<>();
        // PLAYED ranking: G(9), then C, D, E all 4 played with equal wins (a three-way tie), F, A, B
        teams.add(team("A", 1, 0, 0, 0, 0));
        teams.add(team("B", 1, 0, 0, 0, 0));
        teams.add(team("C", 2, 2, 0, 0, 0));
        teams.add(team("D", 2, 2, 0, 0, 0));
        teams.add(team("E", 2, 2, 0, 0, 0));
        teams.add(team("F", 3, 0, 0, 0, 0));
        teams.add(team("G", 5, 4, 0, 0, 0));
        return TeamTableRanker.rank(TeamStatsColumn.PLAYED, Direction.HIGHEST, teams, null);
    }

    @Test
    void pagesSliceTheOrderedTableWithoutGapsOrRepeatsAcrossATieAtTheBoundary() {
        Table table = sevenTeamsWithTies();

        List<String> all = names(table);
        List<String> pages = new ArrayList<>();
        table.page(0, 3).forEach(row -> pages.add(row.teamName()));
        table.page(1, 3).forEach(row -> pages.add(row.teamName()));
        table.page(2, 3).forEach(row -> pages.add(row.teamName()));

        assertThat(all).containsExactly("G", "C", "D", "E", "F", "A", "B");
        assertThat(pages).isEqualTo(all);
        // the C/D/E tie straddles the page 0 / page 1 boundary and keeps its name order
        assertThat(table.page(0, 3)).extracting(TeamStatsTableRow::teamName).containsExactly("G", "C", "D");
        assertThat(table.page(1, 3)).extracting(TeamStatsTableRow::teamName).containsExactly("E", "F", "A");
        assertThat(table.page(0, 3).get(1).rank()).isEqualTo(table.page(1, 3).get(0).rank()); // equal ranks across pages
    }

    @Test
    void theLastPageIsShortAndAPagePastTheEndIsEmpty() {
        Table table = sevenTeamsWithTies();

        assertThat(table.page(2, 3)).hasSize(1);
        assertThat(table.page(3, 3)).isEmpty();
        assertThat(table.page(50, 3)).isEmpty();
        assertThat(table.page(0, 100)).hasSize(7);
        assertThat(table.listed()).isEqualTo(7);
    }

    // ---- cells ----

    @Test
    void everyRowCarriesACellForEveryColumnKeyedByCode() {
        Table table = rank(TeamStatsColumn.WON, team("A", 1, 0, 0, 0, 0));

        assertThat(table.rows().get(0).values().keySet())
                .containsExactlyElementsOf(
                        Arrays.stream(TeamStatsColumn.values()).map(TeamStatsColumn::getCode).toList());
    }

    @Test
    void theHighTotalCellCarriesRunsAndWicketsAndTheNetRunRateCellItsStatus() {
        Counters c = counters().record(1, 0, 0, 0, 0).nrr(2, 300, "40", 280, "40", 2, 1);
        c.highTotalKey = highKey(212, 6, false, E1);

        var values = rank(TeamStatsColumn.WON, team("A", c)).rows().get(0).values();

        assertThat(values.get("highTotal").value()).isEqualByComparingTo("212");
        assertThat(values.get("highTotal").runs()).isEqualTo(212);
        assertThat(values.get("highTotal").wickets()).isEqualTo(6);
        assertThat(values.get("netRunRate").value()).isNull();
        assertThat(values.get("netRunRate").status()).isEqualTo("NOT_ONE_COMPETITION");
        assertThat(values.get("netRunRate").rule()).isEqualTo("FULL_QUOTA");
        assertThat(values.get("netRunRate").matchesUsed()).isEqualTo(2);
    }
}
