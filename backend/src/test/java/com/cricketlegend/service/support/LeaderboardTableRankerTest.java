package com.cricketlegend.service.support;

import static com.cricketlegend.service.support.PlayerStatsTestData.candidate;
import static com.cricketlegend.service.support.PlayerStatsTestData.counters;
import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardCell;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardTableRow;
import com.cricketlegend.service.support.LeaderboardBoard.Direction;
import com.cricketlegend.service.support.LeaderboardBoard.Group;
import com.cricketlegend.service.support.LeaderboardBoard.MinimumKind;
import com.cricketlegend.service.support.LeaderboardQualification.Defaults;
import com.cricketlegend.service.support.LeaderboardRanker.Candidate;
import com.cricketlegend.service.support.LeaderboardTableRanker.Table;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/103-player-stats.md, "Standings tables (decision 26)": for one group and one sort column, who is listed, in
 * what order and with what rank, in both directions, with the unranked group last, the optional minimum on rate sorts
 * and paging.
 */
class LeaderboardTableRankerTest {

    private static final Defaults DEFAULTS = new Defaults(3, 6);

    private static Table table(Group group, LeaderboardColumn sort, Candidate... players) {
        return LeaderboardTableRanker.rank(
                group, sort, sort.getDirection(), List.of(players), null, DEFAULTS, Map.of(), Map.of());
    }

    private static Table table(Group group, LeaderboardColumn sort, Direction direction, Candidate... players) {
        return LeaderboardTableRanker.rank(group, sort, direction, List.of(players), null, DEFAULTS, Map.of(), Map.of());
    }

    private static Table table(Group group, LeaderboardColumn sort, Integer minimum, Candidate... players) {
        return LeaderboardTableRanker.rank(
                group, sort, sort.getDirection(), List.of(players), minimum, DEFAULTS, Map.of(), Map.of());
    }

    private static Direction opposite(Direction direction) {
        return direction == Direction.HIGHEST ? Direction.LOWEST : Direction.HIGHEST;
    }

    /** "Name:rank" per row, rank "-" for the unranked group. */
    private static List<String> order(Table table) {
        return table.rows().stream()
                .map(row -> row.firstName() + ":" + (row.rank() == null ? "-" : row.rank()))
                .toList();
    }

    private static Candidate batter(String name, long innings, long dismissals, long runs) {
        return candidate(name, counters().bat(innings, dismissals, runs));
    }

    // ---- the column catalogue ----

    @Test
    void theGroupsHaveTheFixedColumnsInDisplayOrder() {
        assertThat(codes(Group.BATTING)).containsExactly(
                "matches", "innings", "runs", "balls", "highestScore", "average", "strikeRate", "outs", "fours",
                "sixes", "fiftyPlus", "hundredPlus");
        assertThat(codes(Group.BOWLING)).containsExactly(
                "matches", "overs", "maidens", "dots", "runs", "wickets", "average", "economy", "strikeRate", "best",
                "threeW", "fourW", "fiveW");
        assertThat(codes(Group.FIELDING)).containsExactly("matches", "catches", "stumpings", "runOuts", "total");
    }

    private static List<String> codes(Group group) {
        return LeaderboardColumn.of(group).stream().map(LeaderboardColumn::getCode).toList();
    }

    @Test
    void onlyTheBowlingAverageEconomyAndStrikeRateRankLowestFirst() {
        EnumSet<LeaderboardColumn> lowest = EnumSet.noneOf(LeaderboardColumn.class);
        for (LeaderboardColumn column : LeaderboardColumn.values()) {
            if (column.getDirection() == Direction.LOWEST) {
                lowest.add(column);
            }
        }

        assertThat(lowest).containsExactlyInAnyOrder(
                LeaderboardColumn.BOWL_AVERAGE, LeaderboardColumn.BOWL_ECONOMY, LeaderboardColumn.BOWL_STRIKE_RATE);
    }

    @Test
    void onlyTheRateColumnsOfferAMinimum() {
        for (LeaderboardColumn column : LeaderboardColumn.values()) {
            MinimumKind expected = switch (column) {
                case BAT_AVERAGE, BAT_STRIKE_RATE -> MinimumKind.INNINGS;
                case BOWL_AVERAGE, BOWL_ECONOMY, BOWL_STRIKE_RATE -> MinimumKind.OVERS;
                default -> MinimumKind.NONE;
            };
            assertThat(column.getMinimumKind()).as(column.name()).isEqualTo(expected);
        }
    }

    @Test
    void columnsAreFoundByExactCodeWithinTheirGroupAndEachGroupHasADefault() {
        assertThat(LeaderboardColumn.byCode(Group.BATTING, "strikeRate")).contains(LeaderboardColumn.BAT_STRIKE_RATE);
        assertThat(LeaderboardColumn.byCode(Group.BOWLING, "strikeRate")).contains(LeaderboardColumn.BOWL_STRIKE_RATE);
        assertThat(LeaderboardColumn.byCode(Group.FIELDING, "strikeRate")).isEmpty();
        assertThat(LeaderboardColumn.byCode(Group.BATTING, "StrikeRate")).isEmpty();
        assertThat(LeaderboardColumn.defaultFor(Group.BATTING)).isEqualTo(LeaderboardColumn.BAT_RUNS);
        assertThat(LeaderboardColumn.defaultFor(Group.BOWLING)).isEqualTo(LeaderboardColumn.BOWL_WICKETS);
        assertThat(LeaderboardColumn.defaultFor(Group.FIELDING)).isEqualTo(LeaderboardColumn.FIELD_TOTAL);
    }

    // ---- who is listed ----

    @Test
    void eachTableListsEveryoneWithThatGroupsDataEvenWithAZeroSortValue() {
        Candidate batsman = batter("Bat", 2, 2, 40);
        Candidate bowler = candidate("Bowl", counters().bowl(1, 24, 20, 0));
        Candidate fielderOnly = candidate("Field", counters().matches(1));
        Candidate nothing = candidate("Nothing", counters());

        assertThat(order(table(Group.BATTING, LeaderboardColumn.BAT_FOURS, batsman, bowler, fielderOnly, nothing)))
                .containsExactly("Bat:1");
        assertThat(order(table(Group.BOWLING, LeaderboardColumn.BOWL_WICKETS, batsman, bowler, fielderOnly, nothing)))
                .containsExactly("Bowl:1");
        // the fielding table lists anyone who played, with a zero total
        assertThat(order(table(Group.FIELDING, LeaderboardColumn.FIELD_TOTAL, fielderOnly, nothing)))
                .containsExactly("Field:1");
        assertThat(table(Group.BATTING, LeaderboardColumn.BAT_SIXES, batsman).rows().get(0).values().get("sixes").value())
                .isEqualByComparingTo("0");
    }

    // ---- batting sorts with a board ----

    @Test
    void battingRunsUsesTheMostRunsOrdering() {
        Table t = table(
                Group.BATTING,
                LeaderboardColumn.BAT_RUNS,
                candidate("A", counters().bat(5, 5, 100).highest(60, false)),
                candidate("B", counters().bat(4, 4, 100).highest(50, false)),
                candidate("C", counters().bat(4, 4, 100).highest(70, false)),
                candidate("D", counters().bat(6, 6, 200)));

        assertThat(order(t)).containsExactly("D:1", "C:2", "B:3", "A:4");
    }

    @Test
    void battingAverageRanksTheDismissedAndLeavesTheNeverDismissedUnrankedByRunsThenName() {
        Table t = table(
                Group.BATTING,
                LeaderboardColumn.BAT_AVERAGE,
                batter("A", 2, 2, 100),
                batter("B", 4, 4, 200),
                batter("C", 3, 2, 100),
                batter("D", 3, 3, 60),
                batter("E", 3, 0, 150),
                batter("F", 2, 0, 150),
                batter("G", 2, 0, 50));

        assertThat(order(t)).containsExactly("B:1", "C:2", "A:3", "D:4", "E:-", "F:-", "G:-");
        assertThat(t.ranked()).isEqualTo(4);
        assertThat(t.listed()).isEqualTo(7);
        assertThat(t.rows().get(4).values().get("average").value()).isNull();
    }

    @Test
    void battingStrikeRateListsEveryoneButPlayersWithNoBallsAreUnranked() {
        Table t = table(
                Group.BATTING,
                LeaderboardColumn.BAT_STRIKE_RATE,
                candidate("A", counters().bat(2, 2, 60).ballsOn(2, 60, 60)),
                candidate("B", counters().bat(2, 2, 100).ballsOn(2, 100, 100)),
                candidate("C", counters().bat(2, 2, 90)),
                candidate("D", counters().bat(2, 2, 90).ballsOn(2, 90, 60)));

        assertThat(order(t)).containsExactly("D:1", "B:2", "A:3", "C:-");
    }

    @Test
    void battingHighestScoreOrdersByRunsThenNotOutAndAPlayerWithNoScoreIsUnranked() {
        Table t = table(
                Group.BATTING,
                LeaderboardColumn.BAT_HIGHEST_SCORE,
                candidate("A", counters().bat(2, 2, 50).highest(50, false)),
                candidate("B", counters().bat(2, 1, 50).highest(50, true)),
                candidate("C", counters().bat(2, 2, 70).highest(70, false)),
                candidate("D", counters().bat(1, 1, 0)));

        assertThat(order(t)).containsExactly("C:1", "B:2", "A:3", "D:-");
        LeaderboardCell cell = t.rows().get(1).values().get("highestScore");
        assertThat(cell.runs()).isEqualTo(50);
        assertThat(cell.notOut()).isTrue();
        assertThat(cell.value()).isNull();
    }

    @Test
    void battingFoursSixesFiftiesAndHundredsUseTheirBoardTieBreaks() {
        Candidate a = candidate("A", counters().bat(3, 3, 100).fours(5).sixes(2).milestones(2, 2, 1));
        Candidate b = candidate("B", counters().bat(2, 2, 60).fours(5).sixes(2).milestones(2, 2, 1));
        Candidate c = candidate("C", counters().bat(2, 2, 80).fours(5).sixes(2).milestones(2, 2, 1));

        // all equal on the count: fewer innings, then more runs
        assertThat(order(table(Group.BATTING, LeaderboardColumn.BAT_FOURS, a, b, c))).containsExactly("C:1", "B:2", "A:3");
        assertThat(order(table(Group.BATTING, LeaderboardColumn.BAT_SIXES, a, b, c))).containsExactly("C:1", "B:2", "A:3");
        // 50+ and 100+ tie-break on runs first, then fewer innings
        assertThat(order(table(Group.BATTING, LeaderboardColumn.BAT_FIFTY_PLUS, a, b, c)))
                .containsExactly("A:1", "C:2", "B:3");
        assertThat(order(table(Group.BATTING, LeaderboardColumn.BAT_HUNDRED_PLUS, a, b, c)))
                .containsExactly("A:1", "C:2", "B:3");
    }

    // ---- batting generic columns ----

    @Test
    void genericBattingColumnsSortByValueThenRunsThenFewerInnings() {
        Candidate a = candidate("A", counters().bat(3, 3, 50).ballsOn(3, 50, 100));
        Candidate b = candidate("B", counters().bat(3, 3, 70).ballsOn(3, 70, 100));
        Candidate c = candidate("C", counters().bat(3, 3, 40).ballsOn(3, 40, 120));
        Candidate d = candidate("D", counters().bat(2, 2, 50).ballsOn(2, 50, 100));

        // balls faced: C (120); then the 100s by runs (B 70), then runs 50 by fewer innings (D before A)
        assertThat(order(table(Group.BATTING, LeaderboardColumn.BAT_BALLS, a, b, c, d)))
                .containsExactly("C:1", "B:2", "D:3", "A:4");
        // innings: A, B, C have 3; most runs B, then A (50 beats C's 40); D has 2
        assertThat(order(table(Group.BATTING, LeaderboardColumn.BAT_INNINGS, a, b, c, d)))
                .containsExactly("B:1", "A:2", "C:3", "D:4");
    }

    @Test
    void battingMatchesAndOutsAreGenericColumns() {
        Candidate a = candidate("A", counters().bat(2, 2, 50).matches(6));
        Candidate b = candidate("B", counters().bat(2, 1, 80).matches(6));
        Candidate c = candidate("C", counters().bat(2, 2, 10).matches(4));

        assertThat(order(table(Group.BATTING, LeaderboardColumn.BAT_MATCHES, a, b, c))).containsExactly("B:1", "A:2", "C:3");
        assertThat(order(table(Group.BATTING, LeaderboardColumn.BAT_OUTS, a, b, c))).containsExactly("A:1", "C:2", "B:3");
    }

    // ---- bowling ----

    @Test
    void bowlingWicketsUsesTheMostWicketsOrdering() {
        Table t = table(
                Group.BOWLING,
                LeaderboardColumn.BOWL_WICKETS,
                candidate("A", counters().bowl(2, 60, 50, 5)),
                candidate("B", counters().bowl(2, 60, 40, 5)),
                candidate("C", counters().bowl(2, 48, 40, 5)),
                candidate("D", counters().bowl(3, 90, 80, 7)),
                candidate("E", counters().bowl(1, 24, 10, 0)));

        assertThat(order(t)).containsExactly("D:1", "C:2", "B:3", "A:4", "E:5");
    }

    @Test
    void bowlingAverageEconomyAndStrikeRateAreLowestFirstWithNoWicketPlayersUnranked() {
        Candidate a = candidate("A", counters().bowl(2, 60, 100, 5)); // avg 20, econ 10, SR 12
        Candidate b = candidate("B", counters().bowl(2, 48, 80, 8)); // avg 10, econ 10, SR 6
        Candidate c = candidate("C", counters().bowl(1, 12, 10, 0)); // none; econ 5
        Candidate d = candidate("D", counters().bowl(2, 60, 50, 0)); // none; econ 5, 10 overs

        assertThat(order(table(Group.BOWLING, LeaderboardColumn.BOWL_AVERAGE, a, b, c, d)))
                .containsExactly("B:1", "A:2", "D:-", "C:-");
        assertThat(order(table(Group.BOWLING, LeaderboardColumn.BOWL_STRIKE_RATE, a, b, c, d)))
                .containsExactly("B:1", "A:2", "D:-", "C:-");
        // economy: everyone who bowled a ball has one, so nobody is unranked: D and C at 5.00 (D has more overs), then B
        // and A at 10.00 (B has more wickets)
        assertThat(order(table(Group.BOWLING, LeaderboardColumn.BOWL_ECONOMY, a, b, c, d)))
                .containsExactly("D:1", "C:2", "B:3", "A:4");
    }

    @Test
    void bowlingBestOrdersByWicketsThenFewerRunsThenMoreBallsAndNoBestIsUnranked() {
        Table t = table(
                Group.BOWLING,
                LeaderboardColumn.BOWL_BEST,
                candidate("A", counters().bowl(1, 24, 17, 4).best(4, 17, 24)),
                candidate("B", counters().bowl(1, 30, 17, 4).best(4, 17, 30)),
                candidate("C", counters().bowl(1, 30, 60, 5).best(5, 60, 30)),
                candidate("D", counters().bowl(1, 24, 10, 0)));

        assertThat(order(t)).containsExactly("C:1", "B:2", "A:3", "D:-");
        LeaderboardCell cell = t.rows().get(0).values().get("best");
        assertThat(cell.wickets()).isEqualTo(5);
        assertThat(cell.runs()).isEqualTo(60);
    }

    @Test
    void bowlingDotsPutsPlayersWithNoRecordedDotsLastAndUnrankedByOvers() {
        Table t = table(
                Group.BOWLING,
                LeaderboardColumn.BOWL_DOTS,
                candidate("A", counters().bowl(2, 60, 40, 3).dots(2, 30, 60)),
                candidate("B", counters().bowl(2, 60, 40, 3).dots(1, 40, 60)),
                candidate("C", counters().bowl(2, 60, 40, 3)),
                candidate("D", counters().bowl(3, 90, 40, 3)),
                candidate("E", counters().bowl(2, 48, 40, 3).dots(1, 0, 24)));

        // E recorded dots and took none: a real zero, ranked. C and D recorded none: a dash, unranked, more overs first.
        assertThat(order(t)).containsExactly("B:1", "A:2", "E:3", "D:-", "C:-");
        assertThat(t.rows().get(3).values().get("dots").value()).isNull();
        assertThat(t.rows().get(2).values().get("dots").value()).isEqualByComparingTo("0");
    }

    @Test
    void bowlingHaulColumnsBreakTiesByWicketsThenFewerRuns() {
        Candidate a = candidate("A", counters().bowl(2, 60, 30, 4).hauls(1, 1, 1));
        Candidate b = candidate("B", counters().bowl(2, 72, 30, 4).hauls(1, 1, 1));
        Candidate c = candidate("C", counters().bowl(2, 72, 30, 6).hauls(1, 1, 1));
        Candidate d = candidate("D", counters().bowl(2, 72, 20, 4).hauls(1, 1, 1));

        for (LeaderboardColumn column :
                List.of(LeaderboardColumn.BOWL_THREE_W, LeaderboardColumn.BOWL_FOUR_W, LeaderboardColumn.BOWL_FIVE_W)) {
            assertThat(order(table(Group.BOWLING, column, a, b, c, d))).as(column.name()).containsExactly("C:1", "D:2", "A:3", "B:3");
        }
    }

    @Test
    void bowlingMaidensBreakTiesByMoreOversThenMoreWickets() {
        Candidate a = candidate("A", withMaidens(counters().bowl(1, 60, 30, 1), 3));
        Candidate b = candidate("B", withMaidens(counters().bowl(2, 72, 30, 1), 3));
        Candidate c = candidate("C", withMaidens(counters().bowl(2, 72, 30, 2), 3));
        Candidate d = candidate("D", withMaidens(counters().bowl(1, 30, 30, 0), 0));

        // a zero is a real value in the table: D is listed, ranked last
        assertThat(order(table(Group.BOWLING, LeaderboardColumn.BOWL_MAIDENS, a, b, c, d)))
                .containsExactly("C:1", "B:2", "A:3", "D:4");
    }

    private static PlayerStatsTestData.Counters withMaidens(PlayerStatsTestData.Counters c, long maidens) {
        c.maidens = maidens;
        return c;
    }

    @Test
    void genericBowlingColumnsSortByValueThenWicketsThenFewerBowlingInnings() {
        Candidate a = candidate("A", counters().bowl(2, 48, 50, 3));
        Candidate b = candidate("B", counters().bowl(2, 48, 50, 5));
        Candidate c = candidate("C", counters().bowl(1, 24, 50, 5));
        Candidate d = candidate("D", counters().bowl(2, 48, 70, 1));

        // runs conceded: D (70), then the 50s by wickets (B and C 5) and fewer innings (C), then A
        assertThat(order(table(Group.BOWLING, LeaderboardColumn.BOWL_RUNS, a, b, c, d)))
                .containsExactly("D:1", "C:2", "B:3", "A:4");
    }

    @Test
    void bowlingOversSortsByOversShownToTwoDecimals() {
        Candidate a = candidate("A", counters().bowl(2, 48, 40, 3));
        Candidate b = candidate("B", counters().bowl(2, 48, 40, 5));
        Candidate c = candidate("C", counters().bowl(3, 60, 40, 1));

        Table t = table(Group.BOWLING, LeaderboardColumn.BOWL_OVERS, a, b, c);

        assertThat(order(t)).containsExactly("C:1", "B:2", "A:3");
        LeaderboardCell cell = t.rows().get(0).values().get("overs");
        assertThat(cell.value()).isEqualByComparingTo("10.00");
        assertThat(cell.balls()).isEqualTo(60);
        assertThat(cell.ballsPerOver()).isEqualTo(6);
    }

    @Test
    void theOversCellOfMixedOverLengthsCarriesNoOverLength() {
        Candidate mixed = candidate("A", counters().bowl(2, 43, 41, 3).overs("8").ballsPerOver(5, 6));

        LeaderboardCell cell = table(Group.BOWLING, LeaderboardColumn.BOWL_OVERS, mixed).rows().get(0).values().get("overs");

        assertThat(cell.balls()).isEqualTo(43);
        assertThat(cell.ballsPerOver()).isNull();
    }

    // ---- fielding ----

    @Test
    void fieldingColumnsSortByTheirValueAndTotalBreaksTiesByFewerMatchesThenMoreCatches() {
        Candidate a = candidate("A", counters().matches(4).fielding(2, 1, 0));
        Candidate b = candidate("B", counters().matches(4).fielding(3, 0, 0));
        Candidate c = candidate("C", counters().matches(2).fielding(1, 1, 1));
        Candidate d = candidate("D", counters().matches(5).fielding(0, 0, 5));

        assertThat(order(table(Group.FIELDING, LeaderboardColumn.FIELD_TOTAL, a, b, c, d)))
                .containsExactly("D:1", "C:2", "B:3", "A:4");
        assertThat(order(table(Group.FIELDING, LeaderboardColumn.FIELD_CATCHES, a, b, c, d)))
                .containsExactly("B:1", "A:2", "C:3", "D:4");
        assertThat(order(table(Group.FIELDING, LeaderboardColumn.FIELD_STUMPINGS, a, b, c, d)))
                .containsExactly("C:1", "A:2", "B:3", "D:4");
        assertThat(order(table(Group.FIELDING, LeaderboardColumn.FIELD_RUN_OUTS, a, b, c, d)))
                .containsExactly("D:1", "C:2", "A:3", "B:3");
    }

    @Test
    void fieldingMatchesIsGenericByValueThenDismissalsThenFewerMatches() {
        Candidate a = candidate("A", counters().matches(5).fielding(1, 0, 0));
        Candidate b = candidate("B", counters().matches(5).fielding(3, 0, 0));
        Candidate c = candidate("C", counters().matches(6));

        assertThat(order(table(Group.FIELDING, LeaderboardColumn.FIELD_MATCHES, a, b, c)))
                .containsExactly("C:1", "B:2", "A:3");
    }

    // ---- competition ranking and ties ----

    @Test
    void ranksAreCompetitionRankedAndEqualPlayersAreListedByNameThenId() {
        Table t = table(
                Group.BATTING,
                LeaderboardColumn.BAT_RUNS,
                batter("carol", 3, 3, 40),
                batter("Bob", 3, 3, 40),
                batter("Ann", 3, 3, 50),
                batter("Dan", 3, 3, 30));

        assertThat(order(t)).containsExactly("Ann:1", "Bob:2", "carol:2", "Dan:4");
    }

    @Test
    void allEqualPlayersShareRankOne() {
        Table t = table(Group.FIELDING, LeaderboardColumn.FIELD_TOTAL,
                candidate("B", counters().matches(2).fielding(1, 0, 0)),
                candidate("A", counters().matches(2).fielding(1, 0, 0)));

        assertThat(order(t)).containsExactly("A:1", "B:1");
    }

    // ---- reversed direction ----

    @Test
    void reversingAHighestFirstSortRanksFromTheLowestAndRecomputesTheRanks() {
        Table t = table(
                Group.BATTING,
                LeaderboardColumn.BAT_RUNS,
                Direction.LOWEST,
                batter("A", 3, 3, 50),
                batter("B", 3, 3, 40),
                batter("C", 3, 3, 40),
                batter("D", 3, 3, 30));

        assertThat(order(t)).containsExactly("D:1", "B:2", "C:2", "A:4");
    }

    @Test
    void reversingKeepsTheTieBreaksInTheirStatedOrder() {
        // two batters on a 50 average: the tie-break (more runs first) is not reversed
        Table t = table(
                Group.BATTING,
                LeaderboardColumn.BAT_AVERAGE,
                Direction.LOWEST,
                batter("A", 2, 2, 100),
                batter("B", 4, 4, 200),
                batter("D", 3, 3, 60));

        assertThat(order(t)).containsExactly("D:1", "B:2", "A:3");
    }

    @Test
    void reversingTheUnrankedGroupStaysLastInBothDirections() {
        Candidate ranked1 = batter("A", 2, 2, 100);
        Candidate ranked2 = batter("B", 2, 2, 60);
        Candidate neverOut = batter("Z", 2, 0, 500);

        assertThat(order(table(Group.BATTING, LeaderboardColumn.BAT_AVERAGE, Direction.HIGHEST, ranked1, ranked2, neverOut)))
                .containsExactly("A:1", "B:2", "Z:-");
        assertThat(order(table(Group.BATTING, LeaderboardColumn.BAT_AVERAGE, Direction.LOWEST, ranked1, ranked2, neverOut)))
                .containsExactly("B:1", "A:2", "Z:-");
    }

    @Test
    void reversingALowestFirstColumnRanksTheHighestFirst() {
        Candidate a = candidate("A", counters().bowl(2, 60, 100, 5)); // average 20
        Candidate b = candidate("B", counters().bowl(2, 48, 80, 8)); // average 10
        Candidate c = candidate("C", counters().bowl(2, 60, 100, 5)); // average 20, same as A
        Candidate none = candidate("N", counters().bowl(1, 12, 10, 0));

        Table t = table(Group.BOWLING, LeaderboardColumn.BOWL_AVERAGE, opposite(Direction.LOWEST), a, b, c, none);

        assertThat(order(t)).containsExactly("A:1", "C:1", "B:3", "N:-");
    }

    // ---- optional minimum ----

    @Test
    void aBattingMinimumKeepsPlayersExactlyAtItRemovesAndCountsTheRest() {
        Table t = table(
                Group.BATTING,
                LeaderboardColumn.BAT_AVERAGE,
                3,
                batter("A", 3, 3, 90),
                batter("B", 2, 2, 200),
                batter("C", 2, 0, 90),
                batter("D", 4, 0, 90));

        assertThat(order(t)).containsExactly("A:1", "D:-");
        assertThat(t.belowMinimum()).isEqualTo(2);
        assertThat(t.listed()).isEqualTo(2);
    }

    @Test
    void theStrikeRateMinimumCountsInningsThatRecordedBalls() {
        Table t = table(
                Group.BATTING,
                LeaderboardColumn.BAT_STRIKE_RATE,
                3,
                candidate("A", counters().bat(5, 5, 100).ballsOn(2, 40, 40)),
                candidate("B", counters().bat(3, 3, 60).ballsOn(3, 60, 60)));

        assertThat(order(t)).containsExactly("B:1");
        assertThat(t.belowMinimum()).isEqualTo(1);
    }

    @Test
    void anOversMinimumKeepsExactlyThatManyOvers() {
        Table t = table(
                Group.BOWLING,
                LeaderboardColumn.BOWL_ECONOMY,
                4,
                candidate("A", counters().bowl(1, 24, 20, 2)),
                candidate("B", counters().bowl(1, 23, 10, 2)));

        assertThat(order(t)).containsExactly("A:1");
        assertThat(t.belowMinimum()).isEqualTo(1);
    }

    @Test
    void aMinimumIsIgnoredOnASortThatIsNotARate() {
        Table t = table(Group.BATTING, LeaderboardColumn.BAT_RUNS, 99, batter("A", 1, 1, 5), batter("B", 2, 2, 50));

        assertThat(order(t)).containsExactly("B:1", "A:2");
        assertThat(t.belowMinimum()).isZero();
    }

    @Test
    void noMinimumListsEveryoneIncludingAOneInningsPlayerOnARateSort() {
        Table t = table(Group.BATTING, LeaderboardColumn.BAT_AVERAGE, batter("A", 1, 1, 100), batter("B", 10, 10, 400));

        assertThat(order(t)).containsExactly("A:1", "B:2");
        assertThat(t.belowMinimum()).isZero();
    }

    // ---- rows ----

    @Test
    void smallSampleIsFlaggedOnRateSortsOnly() {
        Candidate small = batter("A", 2, 2, 100);
        Candidate enough = batter("B", 3, 3, 90);

        Table rate = table(Group.BATTING, LeaderboardColumn.BAT_AVERAGE, small, enough);
        Table counting = table(Group.BATTING, LeaderboardColumn.BAT_RUNS, small, enough);

        assertThat(rate.rows()).extracting(LeaderboardTableRow::smallSample).containsExactly(true, false);
        assertThat(counting.rows()).extracting(LeaderboardTableRow::smallSample).containsOnly(false);
    }

    @Test
    void economySmallSampleUsesOversAgainstTheDefault() {
        Table t = table(
                Group.BOWLING,
                LeaderboardColumn.BOWL_ECONOMY,
                candidate("A", counters().bowl(1, 35, 20, 1)),
                candidate("B", counters().bowl(1, 36, 20, 1)));

        assertThat(t.rows()).extracting(LeaderboardTableRow::firstName, LeaderboardTableRow::smallSample)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("A", true), org.assertj.core.groups.Tuple.tuple("B", false));
    }

    @Test
    void everyRowCarriesAValueForEveryColumnOfTheGroupAndTheTeamName() {
        Candidate a = batter("A", 2, 2, 50);
        Candidate b = batter("B", 2, 2, 40);

        Table t = LeaderboardTableRanker.rank(
                Group.BATTING,
                LeaderboardColumn.BAT_RUNS,
                Direction.HIGHEST,
                List.of(a, b),
                null,
                DEFAULTS,
                Map.of(a.playerId(), "Eagles"),
                Map.of());

        assertThat(t.rows().get(0).values().keySet()).containsExactlyElementsOf(
                LeaderboardColumn.of(Group.BATTING).stream().map(LeaderboardColumn::getCode).toList());
        assertThat(t.rows().get(0).teamName()).isEqualTo("Eagles");
        assertThat(t.rows().get(1).teamName()).isNull();
        assertThat(t.rows().get(0).active()).isTrue();
        assertThat(t.rows().get(0).values().get("runs").value()).isEqualByComparingTo("50");
    }

    @Test
    void coverageIsSetOnlyForSortsOnOptionalColumns() {
        Candidate a = candidate("A", counters().bat(5, 5, 100).ballsOn(2, 40, 40));

        assertThat(table(Group.BATTING, LeaderboardColumn.BAT_STRIKE_RATE, a).coverage().used()).isEqualTo(2);
        assertThat(table(Group.BATTING, LeaderboardColumn.BAT_STRIKE_RATE, a).coverage().counted()).isEqualTo(5);
        assertThat(table(Group.BATTING, LeaderboardColumn.BAT_BALLS, a).coverage()).isNull();
    }

    @Test
    void anEmptyTableIsEmptyNotAnError() {
        Table t = table(Group.BATTING, LeaderboardColumn.BAT_RUNS, (Integer) null);

        assertThat(t.rows()).isEmpty();
        assertThat(t.listed()).isZero();
        assertThat(t.ranked()).isZero();
        assertThat(t.page(0, 10)).isEmpty();
    }

    // ---- paging ----

    @Test
    void pagesSliceTheOrderedListAndAPastTheEndPageIsEmpty() {
        Candidate[] players = Arrays.stream(new String[] {"A", "B", "C", "D", "E"})
                .map(name -> batter(name, 1, 1, 100 - name.charAt(0)))
                .toArray(Candidate[]::new);
        Table t = table(Group.BATTING, LeaderboardColumn.BAT_RUNS, players);

        assertThat(names(t.page(0, 2))).containsExactly("A", "B");
        assertThat(names(t.page(1, 2))).containsExactly("C", "D");
        assertThat(names(t.page(2, 2))).containsExactly("E");
        assertThat(t.page(3, 2)).isEmpty();
        assertThat(t.page(0, 100)).hasSize(5);
        assertThat(t.listed()).isEqualTo(5);
    }

    @Test
    void tiesSpanningAPageBoundaryKeepAStableOrderAndTheSameRankOnBothPages() {
        Table t = table(
                Group.BATTING,
                LeaderboardColumn.BAT_RUNS,
                batter("A", 3, 3, 90),
                batter("B", 3, 3, 50),
                batter("C", 3, 3, 50),
                batter("D", 3, 3, 50),
                batter("E", 3, 3, 10));

        assertThat(t.page(0, 2)).extracting(LeaderboardTableRow::rank).containsExactly(1, 2);
        assertThat(t.page(1, 2)).extracting(LeaderboardTableRow::rank).containsExactly(2, 2);
        assertThat(t.page(2, 2)).extracting(LeaderboardTableRow::rank).containsExactly(5);
        assertThat(names(t.page(0, 2))).containsExactly("A", "B");
        assertThat(names(t.page(1, 2))).containsExactly("C", "D");
    }

    @Test
    void theUnrankedGroupIsPagedAfterTheRankedOnes() {
        Table t = table(
                Group.BATTING,
                LeaderboardColumn.BAT_AVERAGE,
                batter("A", 2, 2, 100),
                batter("B", 2, 2, 60),
                batter("C", 2, 0, 200),
                batter("D", 2, 0, 100));

        assertThat(names(t.page(0, 2))).containsExactly("A", "B");
        assertThat(names(t.page(1, 2))).containsExactly("C", "D");
        assertThat(t.page(1, 2)).extracting(LeaderboardTableRow::rank).containsOnlyNulls();
    }

    private static List<String> names(List<LeaderboardTableRow> rows) {
        return rows.stream().map(LeaderboardTableRow::firstName).toList();
    }

    @Test
    void theCandidateFiguresEqualTheCalculatorsSoTheTableMatchesThePlayerPage() {
        Candidate a = candidate("A", counters().bat(5, 3, 233).ballsOn(5, 233, 190));
        BigDecimal average = PlayerStatsCalculator.calculate(a.counters(), PlayerStatsFacts.EMPTY).batting().average();

        Table t = table(Group.BATTING, LeaderboardColumn.BAT_AVERAGE, a);

        assertThat(t.rows().get(0).values().get("average").value()).isEqualByComparingTo(average);
    }
}
