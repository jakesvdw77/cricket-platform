package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.TeamStatsDto;
import com.cricketlegend.dto.TeamStatsFilterOptionsDto;
import com.cricketlegend.dto.TeamStatsTableDto;
import com.cricketlegend.dto.TeamStatsTableDto.TeamStatsTableRow;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.support.PlayerStatsSeed;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/116-team-stats.md, "Backend integration": the counting rules, filters, tenancy and hand-computed figures of
 * the team table and the team page against real Postgres and the real service. NOT {@code @Transactional}. The scenarios
 * (and their scores) are written in {@link PlayerStatsSeed#seedTeamStats()}; the expected figures below were computed by
 * hand from those scores (and cross-checked with an independent model of the spec's definitions).
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class TeamStatsIntegrationTest {

    @Autowired
    private TeamStatsService service;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

    private PlayerStatsSeed seed;
    private UUID clubId;
    private final Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

    @BeforeEach
    void setUp() {
        seed = new PlayerStatsSeed(context);
        seed.seedTeamStats();
        clubId = seed.w.club().getId();
    }

    @AfterEach
    void cleanUp() {
        seed.cleanUp();
    }

    // ---- helpers ----

    private TeamStatsDto page(Team team) {
        return page(admin, team, null, null, null);
    }

    private TeamStatsDto page(Authentication caller, Team team, UUID season, UUID league, String competition) {
        return service.team(caller, clubId, team.getId(), season, league, competition);
    }

    private TeamStatsTableDto table() {
        return table(admin, null, null, null, null);
    }

    private TeamStatsTableDto table(Authentication caller, UUID season, UUID league, UUID section, String competition) {
        return service.table(caller, clubId, null, null, season, league, section, competition, null, 0, 100);
    }

    private static List<String> names(TeamStatsTableDto t) {
        return t.rows().stream().map(TeamStatsTableRow::teamName).toList();
    }

    private static TeamStatsTableRow row(TeamStatsTableDto t, Team team) {
        return t.rows().stream().filter(r -> team.getId().equals(r.teamId())).findFirst()
                .orElseThrow(() -> new AssertionError(team.getName() + " is not in the table " + names(t)));
    }

    private static BigDecimal cell(TeamStatsTableRow r, String code) {
        return r.values().get(code).value();
    }

    private static void eq(BigDecimal actual, String expected) {
        if (expected == null) {
            assertThat(actual).isNull();
        } else {
            assertThat(actual).isNotNull();
            assertThat(actual).isEqualByComparingTo(expected);
        }
    }

    private Authentication sectionManager(Section section) {
        return new TestingAuthenticationToken(seed.fixtures.sectionManagerSubject(section), "n/a");
    }

    // ---- hand-computed figures ----

    @Test
    void hawksAllTimeFiguresAreTheHandComputedOnes() {
        TeamStatsDto h = page(seed.tsHawks);

        // 16 counted results: 11 W (one by a forfeit received), 2 L (one forfeit conceded), 2 T, 1 NR (H10)
        assertThat(h.record().played()).isEqualTo(16);
        assertThat(h.record().won()).isEqualTo(11);
        assertThat(h.record().lost()).isEqualTo(2);
        assertThat(h.record().tied()).isEqualTo(2);
        assertThat(h.record().drawn()).isZero();
        assertThat(h.record().noResult()).isEqualTo(1);
        assertThat(h.record().decisive()).isEqualTo(13);
        eq(h.record().winPercent(), "84.6");
        assertThat(h.basis().resultsCounted()).isEqualTo(16);
        assertThat(h.basis().internalResults()).isEqualTo(2);
        assertThat(h.basis().resultsNoBallBowled()).isEqualTo(1);
        assertThat(h.basis().forfeits().received()).isEqualTo(1);
        assertThat(h.basis().forfeits().conceded()).isEqualTo(1);

        var bat = h.batting();
        assertThat(bat.runs()).isEqualTo(1895);
        assertThat(bat.wicketsLost()).isEqualTo(80);
        assertThat(bat.innings()).isEqualTo(14);
        eq(bat.battingAverage(), "23.69");
        eq(bat.runsPerInnings(), "135.36");
        eq(bat.runRate(), "7.79");
        assertThat(bat.ballsFaced()).isEqualTo(1500);
        // 200 twice (H1 and H18): the more recent match, with its 8 wickets and opponent
        assertThat(bat.highestTotal().runs()).isEqualTo(200);
        assertThat(bat.highestTotal().wickets()).isEqualTo(8);
        assertThat(bat.highestTotal().matchId()).isEqualTo(seed.tsMatches.get("H18").getId());
        assertThat(bat.highestTotal().opponentName()).isEqualTo("Late Visitors");
        // 95 all out; the 45-run abandoned innings, the 90-run chase and the 91 chase are never lows
        assertThat(bat.lowestTotal().runs()).isEqualTo(95);
        assertThat(bat.lowestTotal().allOut()).isTrue();
        assertThat(bat.lowestTotal().matchId()).isEqualTo(seed.tsMatches.get("H3").getId());
        assertThat(bat.coverage().inningsUsable()).isEqualTo(14);
        assertThat(bat.coverage().inningsCounted()).isEqualTo(14);
        assertThat(bat.coverage().inningsClassifiable()).isEqualTo(12);

        var chase = h.chasing();
        assertThat(chase.highestSuccessfulChase().runs()).isEqualTo(184);
        assertThat(chase.highestSuccessfulChase().target()).isEqualTo(181);
        assertThat(chase.highestSuccessfulChase().wickets()).isEqualTo(4);
        assertThat(chase.highestSuccessfulChase().matchId()).isEqualTo(seed.tsMatches.get("H2").getId());
        assertThat(chase.largestVictoryByRuns().margin()).isEqualTo(50);
        assertThat(chase.largestVictoryByRuns().matchId()).isEqualTo(seed.tsMatches.get("H18").getId());
        // H2 and H17 both won by 6 wickets: the one with more balls remaining (20 against 10) wins the tie
        assertThat(chase.largestVictoryByWickets().margin()).isEqualTo(6);
        assertThat(chase.largestVictoryByWickets().ballsRemaining()).isEqualTo(20);
        assertThat(chase.largestVictoryByWickets().matchId()).isEqualTo(seed.tsMatches.get("H2").getId());

        var bowl = h.bowling();
        assertThat(bowl.wicketsTaken()).isEqualTo(103);
        assertThat(bowl.runsConceded()).isEqualTo(1506);
        assertThat(bowl.ballsBowled()).isEqualTo(1295);
        eq(bowl.bowlingAverage(), "14.62");
        eq(bowl.economy(), "7.20");
        assertThat(bowl.coverage().inningsUsable()).isEqualTo(13);
        assertThat(bowl.coverage().inningsCounted()).isEqualTo(13);

        // extras: only H1 (12), H2 (8), H3 (5) and D1 (7) recorded a total; summary-level and others are left out
        var ex = h.extras();
        assertThat(ex.conceded()).isEqualTo(32);
        eq(ex.averagePerMatch(), "8.00");
        assertThat(ex.coverage().inningsWithExtras()).isEqualTo(4);
        assertThat(ex.coverage().inningsCounted()).isEqualTo(13);
        assertThat(ex.wides()).isEqualTo(15);
        assertThat(ex.noBalls()).isEqualTo(4);
        assertThat(ex.byes()).isEqualTo(5);
        assertThat(ex.legByes()).isEqualTo(3);
        assertThat(ex.penaltyRuns()).isZero();
        assertThat(ex.componentCoverage().wides().inningsRecorded()).isEqualTo(3);
        assertThat(ex.componentCoverage().penaltyRuns().inningsRecorded()).isEqualTo(2);
        assertThat(ex.componentCoverage().penaltyRuns().inningsCounted()).isEqualTo(13);

        // Net run rate: two leagues and two seasons among the usable results
        assertThat(h.netRunRate().status()).isEqualTo("NOT_ONE_COMPETITION");
        assertThat(h.netRunRate().value()).isNull();
        assertThat(h.netRunRate().matchesUsed()).isEqualTo(10);
        assertThat(h.netRunRate().matchesCounted()).isEqualTo(14);
        assertThat(h.netRunRate().rule()).isEqualTo("FULL_QUOTA");
        assertThat(h.notCaptured()).extracting(n -> n.code()).containsExactly("PARTNERSHIPS");
    }

    @Test
    void hawksFormIsTheLastFiveCountedResultsNewestFirst() {
        var form = page(seed.tsHawks).form();

        assertThat(form).hasSize(5);
        assertThat(form).extracting(f -> f.matchId()).containsExactly(
                seed.tsMatches.get("D2").getId(), seed.tsMatches.get("H17").getId(), seed.tsMatches.get("H16").getId(),
                seed.tsMatches.get("H18").getId(), seed.tsMatches.get("D1").getId());
        assertThat(form).extracting(f -> f.result()).containsExactly("TIED", "WON", "WON", "WON", "WON");
        assertThat(form).extracting(f -> f.derby()).containsExactly(true, false, false, false, true);
        assertThat(form).extracting(f -> f.opponentName())
                .containsExactly("TS Kites", "Occasionals", "Occasionals", "Late Visitors", "TS Kites");
    }

    @Test
    void netRunRateIsShownForOneLeagueInOneSeasonAndOnlyThen() {
        // s1 / l1: eight WON or TIE results with two usable innings (H1 H2 H3 H4 H6 H11 D1 H18); DLS none, H12 has one innings
        TeamStatsDto one = page(admin, seed.tsHawks, seed.s1.getId(), seed.l1.getId(), null);
        assertThat(one.netRunRate().status()).isEqualTo("SHOWN");
        eq(one.netRunRate().value(), "0.82");
        assertThat(one.netRunRate().matchesUsed()).isEqualTo(8);
        assertThat(one.netRunRate().matchesCounted()).isEqualTo(10);
        assertThat(one.netRunRate().leagueId()).isEqualTo(seed.l1.getId());
        assertThat(one.netRunRate().seasonId()).isEqualTo(seed.s1.getId());

        assertThat(page(admin, seed.tsHawks, seed.s1.getId(), null, null).netRunRate().status())
                .isEqualTo("NOT_ONE_COMPETITION");
        assertThat(page(admin, seed.tsHawks, null, seed.l1.getId(), null).netRunRate().status())
                .isEqualTo("NOT_ONE_COMPETITION");
        // season 2: only H16 is usable (the friendlies have no league)
        var s2 = page(admin, seed.tsHawks, seed.s2.getId(), null, null).netRunRate();
        assertThat(s2.status()).isEqualTo("SHOWN");
        eq(s2.value(), "1.00");
        assertThat(s2.matchesUsed()).isEqualTo(1);
        var l2 = page(admin, seed.tsHawks, null, seed.l2.getId(), null).netRunRate();
        eq(l2.value(), "1.50");
        // friendlies never feed it
        assertThat(page(admin, seed.tsHawks, null, null, "FRIENDLY").netRunRate().status())
                .isEqualTo("NO_USABLE_RESULTS");
    }

    @Test
    void filtersNarrowTheFiguresOfATeam() {
        TeamStatsDto s1l1 = page(admin, seed.tsHawks, seed.s1.getId(), seed.l1.getId(), null);
        assertThat(s1l1.record().played()).isEqualTo(12);
        assertThat(s1l1.record().won()).isEqualTo(8);
        assertThat(s1l1.batting().runs()).isEqualTo(1404);
        assertThat(s1l1.bowling().wicketsTaken()).isEqualTo(66);
        eq(s1l1.record().winPercent(), "80.0");
        eq(s1l1.batting().runRate(), "8.02");
        eq(s1l1.bowling().economy(), "7.44");

        TeamStatsDto s2 = page(admin, seed.tsHawks, seed.s2.getId(), null, null);
        assertThat(s2.record().played()).isEqualTo(3);
        assertThat(s2.record().tied()).isEqualTo(1);
        assertThat(s2.batting().runs()).isEqualTo(341);
        assertThat(s2.chasing().highestSuccessfulChase().runs()).isEqualTo(91);
        assertThat(s2.chasing().highestSuccessfulChase().target()).isEqualTo(91);

        TeamStatsDto friendly = page(admin, seed.tsHawks, null, null, "FRIENDLY");
        assertThat(friendly.record().played()).isEqualTo(2);
        assertThat(friendly.chasing().largestVictoryByRuns()).isNull();
        assertThat(friendly.batting().lowestTotal().runs()).isEqualTo(120);

        TeamStatsDto league = page(admin, seed.tsHawks, null, null, "LEAGUE");
        assertThat(league.record().played()).isEqualTo(14);

        TeamStatsDto l2 = page(admin, seed.tsHawks, null, seed.l2.getId(), null);
        assertThat(l2.record().played()).isEqualTo(1);
        // 8 balls per over: 150 off 160 balls is 20 overs, 7.50; the opposition 120 off 160 is 6.00
        eq(l2.batting().runRate(), "7.50");
        eq(l2.bowling().economy(), "6.00");

        // an inconsistent combination: friendlies of a league
        TeamStatsDto none = page(admin, seed.tsHawks, null, seed.l1.getId(), "FRIENDLY");
        assertThat(none.basis().resultsCounted()).isZero();
        assertThat(table(admin, null, seed.l1.getId(), null, "FRIENDLY").rows()).isEmpty();
    }

    @Test
    void forfeitsCountInTheRecordButNeverFeedAFigure() {
        // H7 received and H8 conceded carry stray innings of 150 and 100 that must never be read
        TeamStatsDto h = page(admin, seed.tsHawks, seed.s1.getId(), seed.l1.getId(), null);
        assertThat(h.basis().forfeits().received()).isEqualTo(1);
        assertThat(h.basis().forfeits().conceded()).isEqualTo(1);
        // 10 own innings in s1/l1 (12 results minus 2 forfeits)
        assertThat(h.batting().innings()).isEqualTo(10);
        assertThat(h.batting().coverage().inningsCounted()).isEqualTo(10);
        assertThat(h.bowling().coverage().inningsCounted()).isEqualTo(9);
        assertThat(h.netRunRate().matchesCounted()).isEqualTo(10);

        var last = page(seed.tsHawks).form();
        assertThat(last).noneMatch(f -> f.forfeit());
        TeamStatsDto onlyForfeitScope = page(admin, seed.tsHawks, seed.s1.getId(), seed.l1.getId(), null);
        assertThat(onlyForfeitScope.record().won()).isEqualTo(8);
        assertThat(onlyForfeitScope.record().lost()).isEqualTo(2);
    }

    @Test
    void aNoResultWithNoBallBowledIsNotCountedButReportedAndOneWithPlayCountsAsANoResult() {
        TeamStatsDto h = page(seed.tsHawks);

        assertThat(h.basis().resultsNoBallBowled()).isEqualTo(1);
        assertThat(h.record().noResult()).isEqualTo(1);
        // H10 (45/2 in 30 balls, 0/0/0) feeds the totals: both innings are in the counts
        assertThat(h.batting().innings()).isEqualTo(14);
        assertThat(h.bowling().coverage().inningsUsable()).isEqualTo(13);
        // but never a high, a low or net run rate: the lowest total stays 95, not 45
        assertThat(h.batting().lowestTotal().runs()).isEqualTo(95);

        long clubWide = table().basis().resultsNoBallBowled();
        assertThat(clubWide).as("Hawks' H9 and the base club's two").isEqualTo(3);
        // washing H10 out (no ball bowled) removes it from the count
        jdbc.update("update match_innings set balls = 0 where match_result_id in (select id from match_result where match_id = ?)",
                seed.tsMatches.get("H10").getId());
        TeamStatsDto after = page(seed.tsHawks);
        assertThat(after.record().noResult()).isZero();
        assertThat(after.record().played()).isEqualTo(15);
        assertThat(after.basis().resultsNoBallBowled()).isEqualTo(2);
    }

    @Test
    void aDraftNeverCountsAnUnpublishedResultDisappearsAndADeletedOneIsGone() {
        assertThat(page(seed.tsHawks).record().played()).isEqualTo(16);

        // a draft of a new match
        var draftMatch = seed.match(seed.tsHawks, null, seed.s1, seed.l1, true);
        var draft = seed.result(draftMatch, "DRAFT", "WON", "HOME");
        draft.set(1, "HOME", 999, 0, 120, false);
        assertThat(page(seed.tsHawks).record().played()).isEqualTo(16);
        assertThat(page(seed.tsHawks).batting().highestTotal().runs()).isEqualTo(200);

        // unpublish H1 by flipping it back to a draft: it disappears
        seed.setStatus(seed.tsMatches.get("H1"), "DRAFT");
        TeamStatsDto after = page(seed.tsHawks);
        assertThat(after.record().played()).isEqualTo(15);
        assertThat(after.record().won()).isEqualTo(10);
        assertThat(after.chasing().largestVictoryByRuns().margin()).isEqualTo(50);
        assertThat(after.chasing().largestVictoryByRuns().matchId()).isEqualTo(seed.tsMatches.get("H18").getId());

        // deleted result: the innings go with it
        UUID h18 = seed.tsMatches.get("H18").getId();
        jdbc.update("delete from match_result where match_id = ?", h18);
        TeamStatsDto gone = page(seed.tsHawks);
        assertThat(gone.record().played()).isEqualTo(14);
        assertThat(gone.chasing().largestVictoryByRuns().margin()).isEqualTo(40);
    }

    @Test
    void aDeactivatedMatchWithAPublishedSummaryLevelResultCountsWithCoverageAndNoExtras() {
        // H11 (summary level, match inactive): counted, its 160/5 and 120/10 are in the totals, extras not recorded
        TeamStatsDto h = page(admin, seed.tsHawks, seed.s1.getId(), seed.l1.getId(), null);
        assertThat(h.record().won()).isEqualTo(8);
        // the coverage says 4 of 9 opposition innings recorded extras (H1, H2, H3, D1; H11 and the rest did not)
        assertThat(h.extras().coverage().inningsWithExtras()).isEqualTo(4);
        assertThat(h.extras().coverage().inningsCounted()).isEqualTo(9);
        assertThat(h.extras().conceded()).isEqualTo(32);

        // a team where no innings recorded extras: null, never 0
        TeamStatsDto owls = page(seed.tsOwls);
        assertThat(owls.extras().conceded()).isNull();
        assertThat(owls.extras().averagePerMatch()).isNull();
        assertThat(owls.extras().wides()).isNull();
        assertThat(owls.extras().coverage().inningsWithExtras()).isZero();
        assertThat(owls.extras().coverage().inningsCounted()).isEqualTo(1);
    }

    @Test
    void aResultWithOneInningsMissingCountsInTheRecordAndLeavesTheMissingSideOutOfTheFigures() {
        // H12: only Hawks 130/4/120 exists. The record counts it; the runs figures count 14 own innings but only 13 opposition ones
        TeamStatsDto h = page(seed.tsHawks);
        assertThat(h.record().won()).isEqualTo(11);
        assertThat(h.batting().innings()).isEqualTo(14);
        assertThat(h.bowling().coverage().inningsCounted()).isEqualTo(13);
        // not a net run rate result (one innings), not classifiable for a low (quota unknown, not all out)
        assertThat(h.netRunRate().matchesUsed()).isEqualTo(10);
        assertThat(h.batting().coverage().inningsClassifiable()).isEqualTo(12);
    }

    @Test
    void dlsAndSuperOverResultsFollowTheirRules() {
        // Doves: DV1 won by DLS chasing 190/2, DV2 lost by DLS (120/10 all out), DV3 lost by DLS (30/1 off a full 120 balls)
        TeamStatsDto d = page(seed.tsDoves);
        assertThat(d.record().won()).isEqualTo(1);
        assertThat(d.record().lost()).isEqualTo(2);
        eq(d.record().winPercent(), "33.3");
        assertThat(d.batting().runs()).isEqualTo(340);
        assertThat(d.batting().wicketsLost()).isEqualTo(13);
        eq(d.batting().battingAverage(), "26.15");
        eq(d.batting().runRate(), "6.58");
        assertThat(d.batting().highestTotal().runs()).isEqualTo(190);
        // 120 all out counts under DLS; the 30 off a full quota does not
        assertThat(d.batting().lowestTotal().runs()).isEqualTo(120);
        assertThat(d.batting().lowestTotal().allOut()).isTrue();
        assertThat(d.chasing().highestSuccessfulChase()).as("a DLS chase never qualifies").isNull();
        assertThat(d.chasing().largestVictoryByWickets()).as("a DLS win has no comparable margin").isNull();
        assertThat(d.chasing().largestVictoryByRuns()).isNull();
        assertThat(d.netRunRate().status()).isEqualTo("NO_USABLE_RESULTS");
        assertThat(d.netRunRate().matchesUsed()).isZero();
        assertThat(d.netRunRate().matchesCounted()).isEqualTo(3);
        assertThat(d.bowling().wicketsTaken()).isEqualTo(9);
        eq(d.bowling().bowlingAverage(), "30.11");
        eq(d.bowling().economy(), "7.39");

        // H6 was a super-over win: a win, regular innings 100 only (the 15 and 12 of the super over are ignored),
        // no margin, and it feeds net run rate through its regular innings
        TeamStatsDto h = page(admin, seed.tsHawks, seed.s1.getId(), seed.l1.getId(), null);
        assertThat(h.batting().runs()).isEqualTo(1404);
        assertThat(h.netRunRate().matchesUsed()).isEqualTo(8);
    }

    @Test
    void aDrawOnlyTeamHasNoDecisiveResultAndNoNetRunRate() {
        TeamStatsDto o = page(seed.tsOwls);
        assertThat(o.record().drawn()).isEqualTo(1);
        assertThat(o.record().played()).isEqualTo(1);
        assertThat(o.record().decisive()).isZero();
        assertThat(o.record().winPercent()).isNull();
        assertThat(o.netRunRate().status()).isEqualTo("NO_USABLE_RESULTS");
        // a draw still sets the high and the low (160, a full quota)
        assertThat(o.batting().highestTotal().runs()).isEqualTo(160);
        assertThat(o.batting().lowestTotal().runs()).isEqualTo(160);
        assertThat(o.chasing().largestVictoryByRuns()).isNull();

        TeamStatsTableRow r = row(table(), seed.tsOwls);
        assertThat(cell(r, "winPercent")).isNull();
        assertThat(r.rank()).as("winPercent is not the default sort, the team is ranked on wins").isNotNull();
        TeamStatsTableDto byWinPercent = service.table(
                admin, clubId, "winPercent", null, null, null, null, null, null, 0, 100);
        assertThat(row(byWinPercent, seed.tsOwls).rank()).as("no decisive result: unranked").isNull();
    }

    @Test
    void aTeamWithNoResultIsNotListedAndItsPageIsZero() {
        assertThat(names(table())).doesNotContain("TS Wrens");
        TeamStatsDto wrens = page(seed.tsWrens);

        assertThat(wrens.basis().resultsCounted()).isZero();
        assertThat(wrens.record().played()).isZero();
        assertThat(wrens.record().winPercent()).isNull();
        assertThat(wrens.batting().runs()).isNull();
        assertThat(wrens.batting().runRate()).isNull();
        assertThat(wrens.batting().highestTotal()).isNull();
        assertThat(wrens.bowling().economy()).isNull();
        assertThat(wrens.form()).isEmpty();
        assertThat(wrens.netRunRate().status()).isEqualTo("NO_USABLE_RESULTS");
    }

    @Test
    void aDerbyIsOneWinAndOneLossAndAnInternalTieIsATieForBoth() {
        TeamStatsDto kites = page(seed.tsKites);
        assertThat(kites.record().played()).isEqualTo(2);
        assertThat(kites.record().won()).isZero();
        assertThat(kites.record().lost()).isEqualTo(1);
        assertThat(kites.record().tied()).isEqualTo(1);
        assertThat(kites.basis().internalResults()).isEqualTo(2);
        eq(kites.record().winPercent(), "0.0");
        // own and opposition innings are the right way round: Kites batted 130 and 120, Hawks batted 150 and 120
        assertThat(kites.batting().runs()).isEqualTo(250);
        assertThat(kites.batting().wicketsLost()).isEqualTo(17);
        assertThat(kites.bowling().runsConceded()).isEqualTo(270);
        assertThat(kites.bowling().wicketsTaken()).isEqualTo(11);
        eq(kites.batting().battingAverage(), "14.71");
        eq(kites.batting().runRate(), "6.25");
        eq(kites.bowling().bowlingAverage(), "24.55");
        eq(kites.bowling().economy(), "6.75");
        assertThat(kites.batting().highestTotal().runs()).isEqualTo(130);
        assertThat(kites.batting().lowestTotal().runs()).isEqualTo(120);
        // Hawks' extras were never recorded on the Hawks innings, so Kites concede none
        assertThat(kites.extras().conceded()).isNull();
        // one usable league result (D1): -1.00
        assertThat(kites.netRunRate().status()).isEqualTo("SHOWN");
        eq(kites.netRunRate().value(), "-1.00");
        assertThat(kites.netRunRate().matchesUsed()).isEqualTo(1);
        assertThat(kites.form()).extracting(f -> f.opponentName()).containsExactly("TS Hawks", "TS Hawks");
        assertThat(kites.form()).extracting(f -> f.derby()).containsExactly(true, true);
    }

    @Test
    void aTeamFilterOnADerbyTakesOneSideOnlyAndTheTableHasBothTeams() {
        TeamStatsTableDto t = table();
        assertThat(names(t)).contains("TS Hawks", "TS Kites");
        // Σ played counts a derby once for each of its two teams
        long played = t.rows().stream().mapToLong(r -> cell(r, "played").longValue()).sum();
        assertThat(played).isEqualTo(t.basis().resultsCounted() + t.basis().internalResults());
    }

    @Test
    void anOpponentThatIsFreeTextAndOneThatIsAnotherClubsTeamGiveIdenticalResults() {
        TeamStatsDto swifts = page(seed.tsSwifts);
        // two identical wins: X1 v "Occasionals", X2 v Rivals TS
        assertThat(swifts.record().played()).isEqualTo(2);
        assertThat(swifts.record().won()).isEqualTo(2);
        eq(swifts.record().winPercent(), "100.0");
        assertThat(swifts.batting().runs()).isEqualTo(280);
        assertThat(swifts.batting().wicketsLost()).isEqualTo(8);
        eq(swifts.batting().battingAverage(), "35.00");
        eq(swifts.batting().runsPerInnings(), "140.00");
        eq(swifts.batting().runRate(), "7.00");
        assertThat(swifts.batting().highestTotal().runs()).isEqualTo(140);
        assertThat(swifts.bowling().wicketsTaken()).isEqualTo(16);
        assertThat(swifts.bowling().runsConceded()).isEqualTo(240);
        eq(swifts.bowling().bowlingAverage(), "15.00");
        eq(swifts.bowling().economy(), "6.00");
        assertThat(swifts.extras().conceded()).isEqualTo(12);
        eq(swifts.extras().averagePerMatch(), "6.00");
        assertThat(swifts.extras().wides()).isEqualTo(6);
        assertThat(swifts.extras().noBalls()).isEqualTo(2);
        assertThat(swifts.extras().byes()).isEqualTo(2);
        assertThat(swifts.extras().legByes()).isEqualTo(2);
        assertThat(swifts.extras().penaltyRuns()).isZero();
        assertThat(swifts.chasing().largestVictoryByRuns().margin()).isEqualTo(20);
        assertThat(swifts.netRunRate().status()).isEqualTo("SHOWN");
        eq(swifts.netRunRate().value(), "1.00");
        assertThat(swifts.netRunRate().matchesUsed()).isEqualTo(2);
        assertThat(swifts.form()).extracting(f -> f.opponentName()).containsExactlyInAnyOrder("Occasionals", "Rivals TS");
        assertThat(swifts.form()).extracting(f -> f.derby()).containsExactly(false, false);

        // the other club's team never appears in our table
        assertThat(names(table())).doesNotContain("Rivals TS", "Villagers 1 other");
    }

    // ---- table ----

    @Test
    void theTableCellsAreTheHandComputedOnesAndRankedByWins() {
        TeamStatsTableDto t = table();
        TeamStatsTableRow hawks = row(t, seed.tsHawks);

        assertThat(t.sort().code()).isEqualTo("won");
        long moreWins = t.rows().stream().filter(r -> cell(r, "won").compareTo(cell(hawks, "won")) > 0).count();
        // equal wins are ordered by win percentage, so a team with the same wins and a better percentage ranks above
        assertThat(hawks.rank()).as("competition ranking on wins").isGreaterThanOrEqualTo((int) moreWins + 1);
        assertThat(t.rows().stream().map(r -> cell(r, "won")).toList()).isSortedAccordingTo(
                java.util.Comparator.<BigDecimal>reverseOrder());
        assertThat(hawks.sectionName()).isEqualTo("Seniors A");
        assertThat(cell(hawks, "played")).isEqualByComparingTo("16");
        assertThat(cell(hawks, "won")).isEqualByComparingTo("11");
        assertThat(cell(hawks, "lost")).isEqualByComparingTo("2");
        assertThat(cell(hawks, "tied")).isEqualByComparingTo("2");
        assertThat(cell(hawks, "noResult")).isEqualByComparingTo("1");
        eq(cell(hawks, "winPercent"), "84.6");
        assertThat(cell(hawks, "runs")).isEqualByComparingTo("1895");
        eq(cell(hawks, "battingAverage"), "23.69");
        eq(cell(hawks, "runRate"), "7.79");
        assertThat(hawks.values().get("highTotal").runs()).isEqualTo(200);
        assertThat(hawks.values().get("highTotal").wickets()).isEqualTo(8);
        assertThat(cell(hawks, "wicketsTaken")).isEqualByComparingTo("103");
        eq(cell(hawks, "bowlingAverage"), "14.62");
        eq(cell(hawks, "economy"), "7.20");
        assertThat(hawks.values().get("netRunRate").status()).isEqualTo("NOT_ONE_COMPETITION");
        assertThat(cell(hawks, "netRunRate")).isNull();
        assertThat(t.basis().teamsListed()).isEqualTo(t.rows().size());
        assertThat(t.columns()).hasSize(15);
    }

    @Test
    void eachFilterAloneAndCombinedNarrowsTheTable() {
        TeamStatsTableDto s2 = table(admin, seed.s2.getId(), null, null, null);
        // the base club's own seniors2 draw is also a season 2 friendly
        assertThat(names(s2)).contains("TS Hawks", "TS Kites").doesNotContain("TS Owls", "TS Swifts", "TS Doves");

        TeamStatsTableDto l2 = table(admin, null, seed.l2.getId(), null, null);
        assertThat(names(l2)).contains("TS Hawks").doesNotContain("TS Kites", "TS Owls", "TS Swifts", "TS Doves");

        TeamStatsTableDto friendly = table(admin, null, null, null, "FRIENDLY");
        assertThat(names(friendly)).contains("TS Hawks", "TS Kites").doesNotContain("TS Swifts", "TS Doves");
        assertThat(cell(row(friendly, seed.tsHawks), "played")).isEqualByComparingTo("2");

        TeamStatsTableDto s2l1 = table(admin, seed.s2.getId(), seed.l1.getId(), null, "LEAGUE");
        assertThat(names(s2l1)).contains("TS Hawks").doesNotContain("TS Kites");

        // an inconsistent combination (a league's friendlies) is an empty table, not an error
        TeamStatsTableDto empty = table(admin, null, seed.l1.getId(), null, "FRIENDLY");
        assertThat(empty.rows()).isEmpty();
        assertThat(empty.basis().resultsCounted()).isZero();
    }

    @Test
    void aSectionFilterChoosesTheTeamsAndNeverChangesATeamsOwnFigures() {
        TeamStatsTableDto all = table();
        TeamStatsTableDto seniors = table(admin, null, null, seed.w.seniors().getId(), null);
        TeamStatsTableDto a1 = table(admin, null, null, seed.seniorsA1.getId(), null);
        TeamStatsTableDto juniors = table(admin, null, null, seed.w.juniors().getId(), null);

        // Seniors includes Seniors A and the grandchild Seniors A1; the sibling Juniors does not appear
        assertThat(names(seniors)).contains("TS Hawks", "TS Kites", "TS Owls", "TS Doves").doesNotContain("TS Swifts");
        assertThat(names(a1)).contains("TS Kites").doesNotContain("TS Hawks", "TS Owls");
        assertThat(names(juniors)).contains("TS Swifts").doesNotContain("TS Hawks", "TS Kites");

        // Kites in the A1 table: its derby opponent's innings still feed its own bowling figures
        TeamStatsTableRow kitesA1 = row(a1, seed.tsKites);
        TeamStatsTableRow kitesAll = row(all, seed.tsKites);
        assertThat(kitesA1.values()).isEqualTo(kitesAll.values());
        assertThat(cell(kitesA1, "wicketsTaken")).isEqualByComparingTo("11");
        assertThat(row(seniors, seed.tsHawks).values()).isEqualTo(row(all, seed.tsHawks).values());
        // the basis counts only results with a team in the listed set
        assertThat(a1.basis().resultsCounted()).isLessThan(all.basis().resultsCounted());
    }

    @Test
    void sectionScopedManagersSeeOnlyTheirSectionsTeams() {
        Authentication juniors = sectionManager(seed.w.juniors());
        TeamStatsTableDto t = table(juniors, null, null, null, null);

        assertThat(names(t)).contains("TS Swifts").doesNotContain("TS Hawks", "TS Kites", "TS Owls");
        assertThat(page(juniors, seed.tsSwifts, null, null, null).record().played()).isEqualTo(2);
        assertThatThrownBy(() -> page(juniors, seed.tsHawks, null, null, null))
                .as("a team outside the manager's sections is refused (403 at the HTTP layer)")
                .isInstanceOf(RuntimeException.class).isNotInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> table(juniors, null, null, seed.w.seniors().getId(), null))
                .isInstanceOf(RuntimeException.class).isNotInstanceOf(NotFoundException.class);
    }

    // ---- tenancy ----

    @Test
    void anotherClubsTeamSeasonLeagueAndSectionAreNotFoundAndNeverCounted() {
        UUID otherTeam = seed.other.seniors1().getId();
        assertThatThrownBy(() -> service.team(admin, clubId, otherTeam, null, null, null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.team(admin, clubId, UUID.randomUUID(), null, null, null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.team(admin, clubId, seed.tsHawks.getId(), seed.other.season().getId(), null, null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.team(admin, clubId, seed.tsHawks.getId(), UUID.randomUUID(), null, null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.team(admin, clubId, seed.tsHawks.getId(), null, UUID.randomUUID(), null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> table(admin, seed.other.season().getId(), null, null, null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> table(admin, null, null, seed.other.seniors().getId(), null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> table(admin, null, UUID.randomUUID(), null, null)).isInstanceOf(NotFoundException.class);

        // the other club's team (home side of a published result of its own) is in no table of ours
        assertThat(table().rows()).extracting(TeamStatsTableRow::teamId).doesNotContain(otherTeam, seed.tsRivals.getId());
    }

    // ---- filter options ----

    @Test
    void filterOptionsOfferOnlyValuesWithCountedTeamResults() {
        TeamStatsFilterOptionsDto o = service.filterOptions(admin, clubId, null);

        assertThat(o.seasonIds()).containsExactlyInAnyOrder(seed.s1.getId(), seed.s2.getId());
        assertThat(o.leagueIds()).contains(seed.l1.getId(), seed.l2.getId());
        assertThat(o.competitions()).containsExactlyInAnyOrder("LEAGUE", "FRIENDLY");
        assertThat(o.sectionIds()).contains(seed.seniorsA.getId(), seed.seniorsA1.getId(), seed.w.seniors().getId(),
                seed.w.juniors().getId());
        assertThat(o.leagueIds()).doesNotContain(seed.other.season().getId());

        // a section manager sees only values inside their sections
        TeamStatsFilterOptionsDto juniors = service.filterOptions(sectionManager(seed.w.juniors()), clubId, null);
        assertThat(juniors.sectionIds()).containsOnly(seed.w.juniors().getId());
        assertThat(juniors.competitions()).containsExactly("LEAGUE");
        assertThat(juniors.seasonIds()).containsExactly(seed.s1.getId());

        // a league with no counted team result is not offered
        var unused = seed.fixtures.league(seed.w, 11);
        assertThat(service.filterOptions(admin, clubId, null).leagueIds()).doesNotContain(unused.getId());
    }

    @Test
    void filterOptionsCanBeNarrowedToOneTeam() {
        TeamStatsFilterOptionsDto swifts = service.filterOptions(admin, clubId, seed.tsSwifts.getId());
        assertThat(swifts.sectionIds()).containsExactly(seed.w.juniors().getId());
        assertThat(swifts.seasonIds()).containsExactly(seed.s1.getId());
        assertThat(swifts.competitions()).containsExactly("LEAGUE");

        TeamStatsFilterOptionsDto hawks = service.filterOptions(admin, clubId, seed.tsHawks.getId());
        assertThat(hawks.sectionIds()).containsExactly(seed.seniorsA.getId());

        TeamStatsFilterOptionsDto wrens = service.filterOptions(admin, clubId, seed.tsWrens.getId());
        assertThat(wrens.seasonIds()).isEmpty();
        assertThat(wrens.leagueIds()).isEmpty();
        assertThat(wrens.sectionIds()).isEmpty();
        assertThat(wrens.competitions()).isEmpty();

        assertThatThrownBy(() -> service.filterOptions(admin, clubId, UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.filterOptions(admin, clubId, seed.other.seniors1().getId()))
                .isInstanceOf(NotFoundException.class);
    }
}
