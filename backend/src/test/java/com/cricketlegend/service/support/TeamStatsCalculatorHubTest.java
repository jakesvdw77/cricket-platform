package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.dto.MyTeamStatsDto;
import com.cricketlegend.service.support.TeamStatsCalculator.BattingFact;
import com.cricketlegend.service.support.TeamStatsCalculator.BattingOrder;
import com.cricketlegend.service.support.TeamStatsCalculator.CloseGames;
import com.cricketlegend.service.support.TeamStatsCalculator.ContributionFact;
import com.cricketlegend.service.support.TeamStatsCalculator.Extent;
import com.cricketlegend.service.support.TeamStatsCalculator.FieldingFact;
import com.cricketlegend.service.support.TeamStatsCalculator.HeadToHead;
import com.cricketlegend.service.support.TeamStatsCalculator.HubFacts;
import com.cricketlegend.service.support.TeamStatsCalculator.ResultFact;
import com.cricketlegend.service.support.TeamStatsCalculator.ShareBlock;
import com.cricketlegend.service.support.TeamStatsCalculator.ShareKind;
import com.cricketlegend.service.support.TeamStatsCalculator.ShareLine;
import com.cricketlegend.service.support.TeamStatsCalculator.Squad;
import com.cricketlegend.service.support.TeamStatsCalculator.Toss;
import com.cricketlegend.service.support.TeamStatsCalculator.VenueFact;
import com.cricketlegend.service.support.TeamStatsCalculator.WicketFact;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/147 Test Plan: the Team stats figures added to {@code TeamStatsCalculator}, with their null and
 * zero-denominator cases. Pure: hand-built stored facts, no Spring.
 */
class TeamStatsCalculatorHubTest {

    private static final Instant T0 = Instant.parse("2031-06-01T10:00:00Z");
    private static int counter;

    /** A result of the team (side HOME): outcome, winning side, opponent, first batter, toss. */
    private static ResultFact result(String outcome, String winningSide, String opponent, String firstBat, String toss) {
        int n = ++counter;
        return new ResultFact(new UUID(0, n), T0.plusSeconds(n * 86400L), opponent, outcome, winningSide, "HOME", "REGULAR", null,
                null, toss, firstBat);
    }

    private static ResultFact margin(String outcome, String winningSide, String type, Long value) {
        int n = ++counter;
        return new ResultFact(new UUID(0, n), T0.plusSeconds(n * 86400L), "Opp", outcome, winningSide, "HOME", "REGULAR", type,
                value, null, null);
    }

    // ---- batting order and toss ----

    @Test
    void battingOrderCountsOnlyResultsThatRecordedItAndNeverAForfeit() {
        List<ResultFact> results = List.of(
                result("WON", "HOME", "A", "HOME", null),
                result("WON", "AWAY", "A", "HOME", null),
                result("WON", "HOME", "A", "AWAY", null),
                result("TIE", null, "A", "AWAY", null),
                result("WON", "HOME", "A", null, null),
                result("FORFEIT", "HOME", "A", null, null));

        BattingOrder o = TeamStatsCalculator.battingOrder(results);

        assertThat(o.battingFirst()).isEqualTo(new TeamStatsCalculator.Split(2, 1));
        assertThat(o.chasing()).isEqualTo(new TeamStatsCalculator.Split(2, 1));
        assertThat(o.recorded()).isEqualTo(4);
        assertThat(o.counted()).isEqualTo(5); // the forfeit is not counted
        BattingOrder none = TeamStatsCalculator.battingOrder(List.of());
        assertThat(none.recorded()).isZero();
        assertThat(none.counted()).isZero();
    }

    @Test
    void tossCountsWinsAmongTheResultsThatRecordedItAndIgnoresForfeits() {
        Toss t = TeamStatsCalculator.toss(List.of(
                result("WON", "HOME", "A", null, "HOME"), result("WON", "HOME", "A", null, "AWAY"),
                result("WON", "HOME", "A", null, null), result("FORFEIT", "HOME", "A", null, "HOME")));
        assertThat(t).isEqualTo(new Toss(1, 2, 3));
        assertThat(TeamStatsCalculator.toss(List.of())).isEqualTo(new Toss(0, 0, 0));
    }

    // ---- head to head ----

    @Test
    void headToHeadGroupsByTrimmedOpponentOrdersMostPlayedThenNameAndKeepsNoneRecordedLast() {
        List<HeadToHead> h = TeamStatsCalculator.headToHead(List.of(
                result("WON", "HOME", "Zebras", null, null),
                result("WON", "AWAY", " Zebras ", null, null),
                result("FORFEIT", "AWAY", "Zebras", null, null),
                result("DRAW", null, "Ants", null, null),
                result("NO_RESULT", null, "Bees", null, null),
                result("TIE", null, "Bees", null, null),
                result("WON", "HOME", null, null, null),
                result("WON", "HOME", "  ", null, null)));

        assertThat(h).extracting(HeadToHead::opponentName).containsExactly("Zebras", "Bees", null, "Ants");
        HeadToHead z = h.get(0);
        assertThat(z.played()).isEqualTo(3);
        assertThat(z.won()).isEqualTo(1);
        assertThat(z.lost()).isEqualTo(2);
        assertThat(z.results()).hasSize(3);
        assertThat(z.results().get(2).forfeit()).isTrue();
        assertThat(z.results().get(0).matchDate()).isBefore(z.results().get(1).matchDate());
        assertThat(h.get(1).tied()).isEqualTo(1);
        assertThat(h.get(1).noResult()).isEqualTo(1);
        assertThat(h.get(2).played()).isEqualTo(2); // none recorded sorts after the named opponents of equal count
        assertThat(h.get(3).drawn()).isEqualTo(1);
        assertThat(TeamStatsCalculator.headToHead(List.of())).isEmpty();
    }

    // ---- close games ----

    @Test
    void closeGamesAreRegularDecidedResultsUnderTwentyRunsOrTwoWickets() {
        CloseGames c = TeamStatsCalculator.closeGames(List.of(
                margin("WON", "HOME", "RUNS", 19L), // close win
                margin("WON", "HOME", "RUNS", 20L), // not close: exactly 20
                margin("WON", "AWAY", "RUNS", 5L), // close loss
                margin("WON", "HOME", "WICKETS", 1L), // close win
                margin("WON", "AWAY", "WICKETS", 2L), // not close
                margin("WON", "HOME", null, null), // decided, margin not stored
                margin("TIE", null, "RUNS", 0L), // never close
                margin("FORFEIT", "HOME", "RUNS", 1L)));

        assertThat(c.played()).isEqualTo(3);
        assertThat(c.won()).isEqualTo(2);
        assertThat(c.closeRuns()).isEqualTo(20);
        assertThat(c.closeWickets()).isEqualTo(2);
        assertThat(c.decided()).isEqualTo(6);
        assertThat(c.withMargin()).isEqualTo(5);
    }

    @Test
    void aResultNotDecidedInTheRegularInningsHasNoCloseMargin() {
        ResultFact dl = new ResultFact(UUID.randomUUID(), T0, "O", "WON", "HOME", "HOME", "DUCKWORTH_LEWIS", "RUNS", 3L, null, null);
        CloseGames c = TeamStatsCalculator.closeGames(List.of(dl));
        assertThat(c.played()).isZero();
        assertThat(c.decided()).isEqualTo(1);
        assertThat(c.withMargin()).isZero();
        CloseGames none = TeamStatsCalculator.closeGames(List.of());
        assertThat(none.decided()).isZero();
    }

    // ---- squad ----

    @Test
    void squadAveragesTheAvailableAnswersPerClosedPollAndHasNoAverageWithoutAPoll() {
        Extent extent = new Extent(0, 0, 0, 0, Extent.EMPTY.ownExtras(), 0, 0, 0, 0, 0, 0, 14, 3);
        Squad s = TeamStatsCalculator.squad(extent, Arrays.asList(10L, 11L, null), 5);
        assertThat(s.playersUsed()).isEqualTo(14);
        assertThat(s.guestAppearances()).isEqualTo(3);
        assertThat(s.averageAvailable()).isEqualByComparingTo("7.0"); // 21 over 3 polls
        assertThat(s.matchesWithPoll()).isEqualTo(3);
        assertThat(s.counted()).isEqualTo(5);

        Squad none = TeamStatsCalculator.squad(extent, List.of(), 5);
        assertThat(none.averageAvailable()).isNull();
        assertThat(none.matchesWithPoll()).isZero();
    }

    // ---- contribution ----

    private static ContributionFact runs(UUID profile, String name, long value) {
        return new ContributionFact(TeamStatsCalculator.RUNS, profile, name, value);
    }

    private static Extent extent(long ownUsable, long ownWithCard, long extrasInnings, long extras) {
        return new Extent(ownUsable, ownWithCard, 0, 0, Extent.EMPTY.ownExtras(), extrasInnings, extras, 0, 0, 0, 0, 0, 0);
    }

    @Test
    void runsContributionListsTheTopFiveThenOthersExtrasAndWhateverIsNotAttributed() {
        List<ContributionFact> facts = new ArrayList<>();
        long[] values = {80, 70, 60, 50, 40, 30, 20};
        for (int i = 0; i < values.length; i++) {
            facts.add(runs(UUID.randomUUID(), "P" + i, values[i]));
        }
        facts.add(runs(null, "Gary Guest", 25)); // guests are one entry that ranks with the players
        facts.add(runs(null, "Other Guest", 5));
        facts.add(runs(UUID.randomUUID(), "Zero", 0)); // a line of no runs is left out
        facts.add(new ContributionFact(TeamStatsCalculator.WICKETS, UUID.randomUUID(), "Bowler", 99)); // another kind
        // 80 70 60 50 40 | others: 30 + 30 (guests) + 20 = 80 | extras 12 | total 400 so 400 - 340 - 80 - 12 = ... see below
        ShareBlock b = TeamStatsCalculator.runsContribution(facts, extent(10, 9, 3, 12), 400L);

        assertThat(b.lines()).extracting(ShareLine::kind).containsExactly(
                ShareKind.PLAYER, ShareKind.PLAYER, ShareKind.PLAYER, ShareKind.PLAYER, ShareKind.PLAYER, ShareKind.OTHERS,
                ShareKind.EXTRAS, ShareKind.NOT_ATTRIBUTED);
        assertThat(b.lines()).extracting(ShareLine::label)
                .containsExactly("P0", "P1", "P2", "P3", "P4", "Others", "Extras", "Not Attributed");
        // others: P5 30 + Guests 30 + P6 20 = 80; attributed 300 + 80 + 12 = 392
        assertThat(b.lines().get(5).value()).isEqualTo(80);
        assertThat(b.lines().get(6).value()).isEqualTo(12);
        assertThat(b.lines().get(7).value()).isEqualTo(8);
        assertThat(b.lines().stream().mapToLong(ShareLine::value).sum()).isEqualTo(400);
        assertThat(b.lines().get(0).sharePercent()).isEqualByComparingTo("20.0");
        assertThat(b.total()).isEqualTo(400);
        assertThat(b.inningsWithCard()).isEqualTo(9);
        assertThat(b.inningsCounted()).isEqualTo(10);
    }

    @Test
    void guestsRankWithThePlayersAndAnUnnamedPlayerGetsALabel() {
        ShareBlock b = TeamStatsCalculator.runsContribution(List.of(
                runs(null, "G1", 50), runs(null, "G2", 40), runs(UUID.randomUUID(), "Sam", 60), runs(UUID.randomUUID(), " ", 5)),
                extent(1, 1, 0, 0), 155L);
        assertThat(b.lines()).extracting(ShareLine::label).containsExactly("Guests", "Sam", "Unnamed Player");
        assertThat(b.lines().get(0).kind()).isEqualTo(ShareKind.GUESTS);
        assertThat(b.lines().get(0).value()).isEqualTo(90);
        assertThat(b.lines()).noneMatch(l -> l.kind() == ShareKind.EXTRAS); // extras were not recorded
        assertThat(b.lines()).noneMatch(l -> l.kind() == ShareKind.NOT_ATTRIBUTED); // adds up exactly
    }

    @Test
    void aContributionWithoutATotalHasNoLinesAndOverAttributionAddsNoNotAttributedLine() {
        ShareBlock none = TeamStatsCalculator.runsContribution(List.of(runs(UUID.randomUUID(), "Sam", 50)), Extent.EMPTY, null);
        assertThat(none.lines()).isEmpty();
        assertThat(none.total()).isNull();

        ShareBlock zero = TeamStatsCalculator.runsContribution(List.of(), extent(1, 1, 0, 0), 0L);
        assertThat(zero.lines()).isEmpty();

        ShareBlock over = TeamStatsCalculator.runsContribution(List.of(runs(UUID.randomUUID(), "Sam", 50)), extent(1, 1, 0, 0), 40L);
        assertThat(over.lines()).noneMatch(l -> l.kind() == ShareKind.NOT_ATTRIBUTED);
    }

    @Test
    void wicketsContributionHasNoExtrasLineAndLabelsTheRemainderNotByABowler() {
        Extent e = new Extent(0, 0, 8, 7, Extent.EMPTY.ownExtras(), 5, 99, 0, 0, 0, 0, 0, 0);
        ShareBlock b = TeamStatsCalculator.wicketsContribution(List.of(
                new ContributionFact(TeamStatsCalculator.WICKETS, UUID.randomUUID(), "Sam", 6),
                new ContributionFact(TeamStatsCalculator.WICKETS, UUID.randomUUID(), "Abe", 2),
                runs(UUID.randomUUID(), "Batter", 100)), e, 10L);
        assertThat(b.lines()).extracting(ShareLine::label).containsExactly("Sam", "Abe", "Not By A Bowler");
        assertThat(b.lines().get(2).value()).isEqualTo(2);
        assertThat(b.inningsWithCard()).isEqualTo(7);
        assertThat(b.inningsCounted()).isEqualTo(8);
    }

    // ---- amendment 3 facts ----

    private static BattingFact bat(UUID match, int seq, Long inningsRuns, Integer pos, Integer runs, Integer balls, Integer fours,
            Integer sixes, String howOut) {
        return new BattingFact(match, seq, inningsRuns, true, pos, runs, balls, fours, sixes, howOut);
    }

    private static HubFacts factsOfBatting(BattingFact... rows) {
        return new HubFacts(List.of(rows), List.of(), List.of(), List.of());
    }

    @Test
    void dismissalsCountNotOutsAndTypesAndLeaveOutFactsOfResultsOutsideTheHistory() {
        ResultFact r = result("WON", "HOME", "A", "HOME", null);
        UUID m = r.matchId();
        HubFacts facts = factsOfBatting(
                bat(m, 1, 100L, 1, 30, 20, 2, 0, "BOWLED"), bat(m, 1, 100L, 2, 20, 20, 2, 0, "CAUGHT"),
                bat(m, 1, 100L, 3, 10, 20, 0, 0, "CAUGHT"), bat(m, 1, 100L, 4, 5, 8, 0, 0, "NOT_OUT"),
                bat(m, 1, 100L, 5, 0, 0, 0, 0, "RETIRED_NOT_OUT"), bat(m, 1, 100L, 6, null, null, null, null, "DID_NOT_BAT"),
                bat(m, 1, 100L, 7, 1, 1, 0, 0, null),
                bat(UUID.randomUUID(), 1, 50L, 1, 50, 40, 0, 0, "BOWLED"),
                new BattingFact(m, 2, 90L, false, null, null, null, null, null, null));

        MyTeamStatsDto.MyTeamDismissals d = TeamStatsCalculator.dismissals(facts, List.of(r));

        assertThat(d.notOut()).isEqualTo(2);
        assertThat(d.wickets()).isEqualTo(3);
        assertThat(d.types()).extracting(MyTeamStatsDto.MyTeamTypeCount::type).containsExactlyInAnyOrder("BOWLED", "CAUGHT");
        assertThat(d.types().stream().filter(t -> t.type().equals("CAUGHT")).findFirst().orElseThrow().percent())
                .isEqualByComparingTo("40.0"); // 2 of the 5 batted innings
        assertThat(d.notRecorded()).isEqualTo(1);
        assertThat(d.coverage().recorded()).isEqualTo(1);
        assertThat(d.coverage().counted()).isEqualTo(2); // the second innings has no batting entry at all
        assertThat(TeamStatsCalculator.dismissals(HubFacts.EMPTY, List.of(r)).wickets()).isZero();
        assertThat(TeamStatsCalculator.dismissals(HubFacts.EMPTY, List.of(r)).types()).isEmpty();
    }

    @Test
    void aForfeitedResultsFactsAreNotCounted() {
        ResultFact forfeit = result("FORFEIT", "HOME", "A", null, null);
        HubFacts facts = factsOfBatting(bat(forfeit.matchId(), 1, 10L, 1, 10, 5, 0, 0, "BOWLED"));
        assertThat(TeamStatsCalculator.dismissals(facts, List.of(forfeit)).wickets()).isZero();
        assertThat(TeamStatsCalculator.battingPositionGroups(facts, List.of(forfeit))).isEmpty();
    }

    @Test
    void teamBattingPositionGroupsMergeOpenersTakeShareOfRunsAndOmitEmptyOrOutOfRangePositions() {
        ResultFact r = result("WON", "HOME", "A", "HOME", null);
        UUID m = r.matchId();
        HubFacts facts = factsOfBatting(
                bat(m, 1, 100L, 1, 30, 20, 0, 0, "BOWLED"), bat(m, 1, 100L, 2, 10, 20, 0, 0, "NOT_OUT"),
                bat(m, 1, 100L, 4, 40, 20, 0, 0, "CAUGHT"), bat(m, 1, 100L, 12, 99, 20, 0, 0, "BOWLED"),
                bat(m, 1, 100L, null, 99, 20, 0, 0, "BOWLED"), bat(m, 1, 100L, 5, 99, 20, 0, 0, "DID_NOT_BAT"));

        List<MyTeamStatsDto.MyTeamPositionGroup> g = TeamStatsCalculator.battingPositionGroups(facts, List.of(r));

        assertThat(g).extracting(MyTeamStatsDto.MyTeamPositionGroup::key).containsExactly("OPENER", "4");
        assertThat(g.get(0).innings()).isEqualTo(2);
        assertThat(g.get(0).runs()).isEqualTo(40);
        assertThat(g.get(0).notOuts()).isEqualTo(1);
        assertThat(g.get(0).dismissals()).isEqualTo(1);
        assertThat(g.get(0).average()).isEqualByComparingTo("40.00");
        assertThat(g.get(0).sharePercent()).isEqualByComparingTo("50.0");
        assertThat(TeamStatsCalculator.battingPositionGroups(HubFacts.EMPTY, List.of(r))).isEmpty();
    }

    @Test
    void boundariesUseOnlyInningsWhereEveryCountedRowRecordedFoursAndSixes() {
        ResultFact r = result("WON", "HOME", "A", "HOME", null);
        UUID m = r.matchId();
        HubFacts facts = factsOfBatting(
                // innings 1: complete, with balls: 4 fours 1 six, 100 team runs, 40 balls
                bat(m, 1, 100L, 1, 40, 20, 3, 1, "BOWLED"), bat(m, 1, 100L, 2, 20, 20, 1, 0, "CAUGHT"),
                // innings 2: one row blank, so the innings is out
                bat(m, 2, 80L, 1, 40, 20, 3, 1, "BOWLED"), bat(m, 2, 80L, 2, 20, 20, null, null, "CAUGHT"));

        MyTeamStatsDto.MyTeamBoundaries b = TeamStatsCalculator.boundaries(facts, List.of(r));

        assertThat(b.fours()).isEqualTo(4);
        assertThat(b.sixes()).isEqualTo(1);
        assertThat(b.boundaryRuns()).isEqualTo(22); // 4 x 4 + 6
        assertThat(b.boundaryPercent()).isEqualByComparingTo("22.0");
        assertThat(b.ballsPerBoundary()).isEqualByComparingTo("8.0"); // 40 balls over 5 boundaries
        assertThat(b.inningsRecorded()).isEqualTo(1);
        assertThat(b.inningsCounted()).isEqualTo(2);
    }

    @Test
    void boundariesWithNothingRecordedAreAllNullNotZero() {
        ResultFact r = result("WON", "HOME", "A", "HOME", null);
        MyTeamStatsDto.MyTeamBoundaries none = TeamStatsCalculator.boundaries(
                factsOfBatting(bat(r.matchId(), 1, 50L, 1, 50, 30, null, null, "BOWLED")), List.of(r));
        assertThat(none.fours()).isNull();
        assertThat(none.sixes()).isNull();
        assertThat(none.boundaryRuns()).isNull();
        assertThat(none.boundaryPercent()).isNull();
        assertThat(none.ballsPerBoundary()).isNull();
        assertThat(none.inningsRecorded()).isZero();
        assertThat(none.inningsCounted()).isEqualTo(1);
        assertThat(TeamStatsCalculator.boundaries(HubFacts.EMPTY, List.of()).inningsCounted()).isZero();
    }

    @Test
    void boundariesWithoutBallsGiveNoBallsPerBoundary() {
        ResultFact r = result("WON", "HOME", "A", "HOME", null);
        MyTeamStatsDto.MyTeamBoundaries b = TeamStatsCalculator.boundaries(
                factsOfBatting(bat(r.matchId(), 1, 50L, 1, 50, null, 2, 0, "BOWLED")), List.of(r));
        assertThat(b.fours()).isEqualTo(2);
        assertThat(b.ballsPerBoundary()).isNull();
    }

    @Test
    void byInningsNumberSplitsTheTeamsInningsBySideThatBattedFirst() {
        ResultFact first = result("WON", "HOME", "A", "HOME", null);
        ResultFact chase = result("WON", "AWAY", "A", "AWAY", null);
        ResultFact chaseWon = result("WON", "HOME", "A", "AWAY", null);
        ResultFact unknown = result("WON", "HOME", "A", null, null);
        HubFacts facts = factsOfBatting(
                bat(first.matchId(), 1, 150L, 1, 1, 1, 0, 0, "BOWLED"),
                bat(chase.matchId(), 2, 100L, 1, 1, 1, 0, 0, "BOWLED"),
                bat(chaseWon.matchId(), 2, 120L, 1, 1, 1, 0, 0, "BOWLED"),
                bat(unknown.matchId(), 1, 999L, 1, 1, 1, 0, 0, "BOWLED"));

        MyTeamStatsDto.MyTeamInningsSplit s = TeamStatsCalculator.byInningsNumber(facts, List.of(first, chase, chaseWon, unknown));

        assertThat(s.first().played()).isEqualTo(1);
        assertThat(s.first().won()).isEqualTo(1);
        assertThat(s.first().runs()).isEqualTo(150);
        assertThat(s.first().average()).isEqualByComparingTo("150.00");
        assertThat(s.chasing().played()).isEqualTo(2);
        assertThat(s.chasing().won()).isEqualTo(1);
        assertThat(s.chasing().runs()).isEqualTo(220);
        assertThat(s.chasing().average()).isEqualByComparingTo("110.00");
        MyTeamStatsDto.MyTeamInningsSplit none = TeamStatsCalculator.byInningsNumber(HubFacts.EMPTY, List.of());
        assertThat(none.first().runs()).isNull();
        assertThat(none.first().average()).isNull();
    }

    private static VenueFact venue(ResultFact r, UUID area, String name, boolean home, Long ownRuns, Long oppRuns) {
        return new VenueFact(r.matchId(), area, name, home, ownRuns, 5L, oppRuns, 8L);
    }

    @Test
    void venuesSumPerPlayingAreaSkipForfeitsAndNameAnUnknownArea() {
        UUID ground = UUID.randomUUID();
        ResultFact w = result("WON", "HOME", "A", null, null);
        ResultFact l = result("WON", "AWAY", "A", null, null);
        ResultFact t = result("TIE", null, "A", null, null);
        ResultFact noArea = result("WON", "HOME", "A", null, null);
        ResultFact forfeit = result("FORFEIT", "HOME", "A", null, null);
        HubFacts facts = new HubFacts(List.of(), List.of(
                venue(w, ground, "Home Oval", true, 150L, 100L), venue(l, ground, "Home Oval", true, 90L, 100L),
                venue(t, ground, "Home Oval", true, 100L, 100L), venue(noArea, null, null, false, null, null),
                venue(forfeit, ground, "Home Oval", true, 1L, 1L)), List.of(), List.of());

        List<MyTeamStatsDto.MyTeamVenue> v = TeamStatsCalculator.venues(facts, List.of(w, l, t, noArea, forfeit));

        assertThat(v).extracting(MyTeamStatsDto.MyTeamVenue::name).containsExactly("Home Oval", "Unknown venue");
        MyTeamStatsDto.MyTeamVenue home = v.get(0);
        assertThat(home.matches()).isEqualTo(3);
        assertThat(home.won()).isEqualTo(1);
        assertThat(home.lost()).isEqualTo(1);
        assertThat(home.tied()).isEqualTo(1);
        assertThat(home.runsScored()).isEqualTo(340);
        assertThat(home.runsConceded()).isEqualTo(300);
        assertThat(home.home()).isTrue();
        assertThat(v.get(1).home()).isNull();
        assertThat(v.get(1).venueKey()).isEqualTo("unknown");
        assertThat(v.get(1).runsScored()).isNull(); // nothing recorded is null, not zero
        assertThat(TeamStatsCalculator.venues(HubFacts.EMPTY, List.of(w))).isEmpty();
    }

    @Test
    void venuesBeyondTwelveFoldIntoOtherVenuesKeepingTheTotals() {
        List<ResultFact> results = new ArrayList<>();
        List<VenueFact> venues = new ArrayList<>();
        for (int i = 0; i < 14; i++) {
            ResultFact r = result("WON", "HOME", "A", null, null);
            results.add(r);
            venues.add(venue(r, UUID.randomUUID(), "G" + i, false, 10L, 5L));
        }
        List<MyTeamStatsDto.MyTeamVenue> v =
                TeamStatsCalculator.venues(new HubFacts(List.of(), venues, List.of(), List.of()), results);
        assertThat(v).hasSize(13);
        assertThat(v.get(12).name()).isEqualTo("Other venues");
        assertThat(v.get(12).matches()).isEqualTo(2);
        assertThat(v.get(12).runsScored()).isEqualTo(20);
        assertThat(v.stream().mapToLong(MyTeamStatsDto.MyTeamVenue::matches).sum()).isEqualTo(14);
    }

    @Test
    void wicketTypesSplitByCreditedDismissalsAndLeaveWhatIsNotItemised() {
        ResultFact r = result("WON", "HOME", "A", null, null);
        UUID m = r.matchId();
        UUID row1 = UUID.randomUUID();
        UUID row2 = UUID.randomUUID();
        UUID row3 = UUID.randomUUID();
        HubFacts facts = new HubFacts(List.of(), List.of(), List.of(
                new WicketFact(m, 2, row1, 3, "BOWLED", 2), new WicketFact(m, 2, row1, 3, "CAUGHT", 1),
                // credited exceeds stored: wholly not itemised
                new WicketFact(m, 2, row2, 1, "BOWLED", 2),
                // stored 2, none credited: not itemised
                new WicketFact(m, 2, row3, 2, null, 0),
                // an innings without a bowling row
                new WicketFact(m, 3, null, null, null, 0)), List.of());

        MyTeamStatsDto.MyTeamWicketTypes w = TeamStatsCalculator.wicketTypes(facts, List.of(r));

        assertThat(w.total()).isEqualTo(6);
        assertThat(w.types()).extracting(MyTeamStatsDto.MyTeamTypeCount::type).containsExactlyInAnyOrder("BOWLED", "CAUGHT");
        assertThat(w.types().stream().mapToLong(MyTeamStatsDto.MyTeamTypeCount::count).sum() + w.notItemised()).isEqualTo(6);
        assertThat(w.notItemised()).isEqualTo(3);
        assertThat(w.coverage().recorded()).isEqualTo(1);
        assertThat(w.coverage().counted()).isEqualTo(2);
        assertThat(TeamStatsCalculator.wicketTypes(HubFacts.EMPTY, List.of(r)).total()).isZero();
        assertThat(TeamStatsCalculator.wicketTypes(HubFacts.EMPTY, List.of(r)).types()).isEmpty();
    }

    @Test
    void fieldingTotalsGroupGuestsAndFoldFielderBeyondEightIntoOthers() {
        ResultFact r1 = result("WON", "HOME", "A", null, null);
        ResultFact r2 = result("WON", "HOME", "A", null, null);
        ResultFact noRecord = result("WON", "HOME", "A", null, null);
        List<FieldingFact> rows = new ArrayList<>();
        rows.add(new FieldingFact(r1.matchId(), UUID.randomUUID(), "Sam", 1, 3, 1, 0));
        rows.add(new FieldingFact(r2.matchId(), null, "Gary", 1, 2, 0, 0));
        rows.add(new FieldingFact(r2.matchId(), null, "Other", 1, 1, 0, 1));
        rows.add(new FieldingFact(noRecord.matchId(), null, null, 0, 0, 0, 0)); // a result with no fielding record
        for (int i = 0; i < 8; i++) {
            rows.add(new FieldingFact(r1.matchId(), UUID.randomUUID(), "F" + i, 1, 1, 0, 0));
        }
        rows.add(new FieldingFact(r1.matchId(), UUID.randomUUID(), "Nothing", 1, 0, 0, 0));

        MyTeamStatsDto.MyTeamFielding f = TeamStatsCalculator.fielding(new HubFacts(List.of(), List.of(), List.of(), rows),
                List.of(r1, r2, noRecord));

        assertThat(f.catches()).isEqualTo(3 + 2 + 1 + 8);
        assertThat(f.stumpings()).isEqualTo(1);
        assertThat(f.runOuts()).isEqualTo(1);
        assertThat(f.dismissals()).isEqualTo(f.catches() + f.stumpings() + f.runOuts());
        assertThat(f.byFielder()).hasSize(8);
        assertThat(f.byFielder().get(0).name()).isEqualTo("Guests"); // 4 each: by name
        assertThat(f.byFielder().get(0).total()).isEqualTo(4);
        assertThat(f.byFielder().get(1).name()).isEqualTo("Sam");
        assertThat(f.byFielder().get(1).total()).isEqualTo(4);
        assertThat(f.byFielder().stream().mapToLong(MyTeamStatsDto.MyTeamFielder::total).sum() + f.others())
                .isEqualTo(f.dismissals());
        assertThat(f.others()).isEqualTo(2); // F-fielders ranked 9 and 10 of 10 (one catch each)
        assertThat(f.dismissalsPerMatch()).isEqualByComparingTo("8.00"); // 16 over the two results with a record
        assertThat(f.coverage().recorded()).isEqualTo(2);
        assertThat(f.coverage().counted()).isEqualTo(3);
    }

    @Test
    void fieldingOfNothingHasNullPerMatchAndNoFielders() {
        MyTeamStatsDto.MyTeamFielding f = TeamStatsCalculator.fielding(HubFacts.EMPTY, List.of());
        assertThat(f.dismissals()).isZero();
        assertThat(f.dismissalsPerMatch()).isNull();
        assertThat(f.byFielder()).isEmpty();
        assertThat(f.others()).isZero();
    }
}
