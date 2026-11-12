package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.dto.MyStatsDto;
import com.cricketlegend.dto.PlayerMatchRowDto;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBatting;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBattingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBowling;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBowlingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchFielding;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchFieldingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchResult;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchSpell;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchTeam;
import com.cricketlegend.dto.PlayerStatsDto;
import com.cricketlegend.service.support.PlayerStatsCalculator.AgeBand;
import com.cricketlegend.service.support.PlayerStatsCalculator.InningsDetail;
import com.cricketlegend.service.support.PlayerStatsCalculator.RawBattingDetail;
import com.cricketlegend.service.support.PlayerStatsCalculator.ResultVenue;
import com.cricketlegend.service.support.PlayerStatsCalculator.SeasonCounters;
import com.cricketlegend.service.support.PlayerStatsCalculator.WicketDetail;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * docs/specs/147 Test Plan: every figure that the Player Hub "My stats" payload adds to {@code PlayerStatsCalculator}, with
 * its null and zero-denominator cases. Pure: hand-built inputs only, no Spring.
 */
class PlayerStatsCalculatorHubTest {

    private static final Instant T0 = Instant.parse("2031-06-01T10:00:00Z");
    private static int counter;

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }

    /** An innings: sequence, position, runs (null = not stored), balls, how out. */
    private static InningsDetail inn(int seq, Integer pos, Integer runs, Integer balls, DismissalType out) {
        return detail("Opp", false, seq, pos, runs, balls, out, null, true, true, null, null);
    }

    private static InningsDetail detail(String opponent, boolean derby, int seq, Integer pos, Integer runs, Integer balls,
            DismissalType out, String bowler, boolean fieldKnown, boolean clubField, UUID areaId, String areaName) {
        int n = ++counter;
        return new InningsDetail(new UUID(0, n), new UUID(1, n), T0.plusSeconds(n * 86400L), opponent, derby, null, seq, pos,
                runs, balls, null, null, out, out != null && !out.isWicket() && out.batted(), bowler, fieldKnown, clubField,
                areaId, areaName);
    }

    // ---- summary ----

    private static PlayerMatchRowDto row(UUID matchId, UUID resultId, UUID leagueId, String leagueName, List<PlayerMatchTeam> teams,
            PlayerMatchResult result, boolean battingCard, List<PlayerMatchSpell> spells, Long catches) {
        PlayerMatchBowling bowling = spells == null
                ? new PlayerMatchBowling(PlayerMatchBowlingStatus.NO_CARD, null, null, null, null, null, null)
                : new PlayerMatchBowling(PlayerMatchBowlingStatus.BOWLED, spells, null, null, null, null, null);
        PlayerMatchFielding fielding = catches == null
                ? new PlayerMatchFielding(PlayerMatchFieldingStatus.NO_CARD, null, null, null)
                : new PlayerMatchFielding(PlayerMatchFieldingStatus.RECORDED, catches, 0L, 0L);
        return new PlayerMatchRowDto(matchId, resultId, T0.plusSeconds(++counter * 86400L), teams, "Opp", false,
                leagueId, leagueName, leagueId == null ? "FRIENDLY" : "LEAGUE", result, 6, battingCard, spells != null,
                new PlayerMatchBatting(battingCard ? PlayerMatchBattingStatus.BATTED : PlayerMatchBattingStatus.NO_CARD, null,
                        null, null, null, null, null),
                bowling, fielding, new PlayerMatchRowDto.PlayerMatchAwards(0, 0));
    }

    private static PlayerMatchRowDto simple(PlayerMatchResult result, boolean battingCard) {
        int n = ++counter;
        return row(new UUID(2, n), new UUID(3, n), null, null, List.of(), result, battingCard, null, null);
    }

    private static PlayerMatchSpell spell(int balls, int maidens, int runs, int wickets, Integer wides, Integer noBalls) {
        return new PlayerMatchSpell(balls, maidens, runs, wickets, null, wides, noBalls);
    }

    private static PlayerMatchRowDto bowlRow(UUID resultId, int ballsPerOver, PlayerMatchSpell... spells) {
        int n = ++counter;
        PlayerMatchRowDto r = row(new UUID(2, n), resultId, null, null, List.of(), PlayerMatchResult.WON, false, List.of(spells), null);
        return new PlayerMatchRowDto(r.matchId(), r.resultId(), r.matchDate(), r.ourTeams(), r.opponentName(), false, null, null,
                r.competition(), r.result(), ballsPerOver, false, true, r.batting(), r.bowling(), r.fielding(), r.awards());
    }

    @Test
    void summaryListsLeaguesAndTeamsWithDistinctMatchesMostPlayedFirstAndSkipsFriendlies() {
        UUID leagueA = UUID.randomUUID();
        UUID leagueB = UUID.randomUUID();
        UUID team1 = UUID.randomUUID();
        UUID team2 = UUID.randomUUID();
        PlayerMatchTeam t1 = new PlayerMatchTeam("HOME", team1, "Hawks");
        PlayerMatchTeam t2 = new PlayerMatchTeam("HOME", team2, "Kites");
        UUID derbyMatch = UUID.randomUUID();
        List<PlayerMatchRowDto> rows = List.of(
                row(UUID.randomUUID(), UUID.randomUUID(), leagueA, "Alpha", List.of(t1), PlayerMatchResult.WON, true, null, null),
                row(UUID.randomUUID(), UUID.randomUUID(), leagueA, "Alpha", List.of(t1), PlayerMatchResult.WON, true, null, null),
                row(UUID.randomUUID(), UUID.randomUUID(), leagueB, "Beta", List.of(t2), PlayerMatchResult.LOST, true, null, null),
                // a friendly: no league, still counts for the team
                row(UUID.randomUUID(), UUID.randomUUID(), null, null, List.of(t2), PlayerMatchResult.DRAWN, true, null, null),
                // a derby: both teams on one match row, counted once for each
                row(derbyMatch, UUID.randomUUID(), leagueA, "Alpha", List.of(t1, t2), PlayerMatchResult.INTERNAL, true, null, null));
        PlayerStatsDto stats = statsFor(5, 120, 24, 6, 3);
        PlayerStatsCounters c = PlayerStatsTestData.counters().bat(5, 4, 120).ballsOn(5, 120, 150).build();

        MyStatsDto.MyStatsSummary s = PlayerStatsCalculator.summary(stats, c, rows);

        assertThat(s.leaguesPlayed()).extracting(MyStatsDto.MyStatsLeagueMatches::name).containsExactly("Alpha", "Beta");
        assertThat(s.leaguesPlayed()).extracting(MyStatsDto.MyStatsLeagueMatches::matches).containsExactly(3L, 1L);
        assertThat(s.teamsRepresented()).extracting(MyStatsDto.MyStatsTeamMatches::name).containsExactly("Hawks", "Kites");
        assertThat(s.teamsRepresented()).extracting(MyStatsDto.MyStatsTeamMatches::matches).containsExactly(3L, 3L);
        assertThat(s.matchesPlayed()).isEqualTo(5);
        assertThat(s.runsScored()).isEqualTo(120);
        assertThat(s.ballsFaced()).isEqualTo(150);
        assertThat(s.ballsBowled()).isEqualTo(24);
        assertThat(s.ballsPerOver()).isEqualTo(6);
        assertThat(s.catchesTaken()).isEqualTo(6);
    }

    @Test
    void summaryHasNoBallsFacedWhenNoInningsRecordedBallsAndNoBallsPerOverWhenMixed() {
        PlayerStatsCounters noBalls = PlayerStatsTestData.counters().bat(2, 2, 40).build();
        MyStatsDto.MyStatsSummary s = PlayerStatsCalculator.summary(statsFor(2, 40, 0, 0, 0), noBalls, List.of());
        assertThat(s.ballsFaced()).isNull();
        assertThat(s.ballsPerOver()).isNull();
        assertThat(s.leaguesPlayed()).isEmpty();
        assertThat(s.teamsRepresented()).isEmpty();
    }

    private static PlayerStatsDto statsFor(long matches, long runs, long ballsBowled, long catches, long unused) {
        PlayerStatsCounters c = PlayerStatsTestData.counters()
                .matches(matches).bat(matches, matches - 1, runs).ballsOn(matches, runs, runs + 30)
                .bowl(ballsBowled > 0 ? 1 : 0, ballsBowled, 10, 1).fielding(catches, 0, 0).build();
        PlayerStatsCalculator.Figures f = PlayerStatsCalculator.calculate(c, PlayerStatsFacts.EMPTY);
        return new PlayerStatsDto(null, null, f.basis(), f.batting(), f.bowling(), f.fielding(), f.awards(), f.record(), f.form(),
                f.notCaptured());
    }

    // ---- ages and guides ----

    @Test
    void ageBandIsAtTheLatestCountedMatchWithBoundariesAtThirteenAndEighteen() {
        Instant match = Instant.parse("2031-06-15T10:00:00Z");
        assertThat(PlayerStatsCalculator.ageBand(null, match)).isEqualTo(AgeBand.UNKNOWN);
        assertThat(PlayerStatsCalculator.ageBand(LocalDate.of(2018, 6, 16), match)).isEqualTo(AgeBand.UNDER_13); // 12, day before 13th
        assertThat(PlayerStatsCalculator.ageBand(LocalDate.of(2018, 6, 15), match)).isEqualTo(AgeBand.AGE_13_17); // turns 13 today
        assertThat(PlayerStatsCalculator.ageBand(LocalDate.of(2013, 6, 16), match)).isEqualTo(AgeBand.AGE_13_17); // 17
        assertThat(PlayerStatsCalculator.ageBand(LocalDate.of(2013, 6, 15), match)).isEqualTo(AgeBand.ADULT); // turns 18 today
        assertThat(PlayerStatsCalculator.ageBand(LocalDate.of(2040, 1, 1), match)).isEqualTo(AgeBand.UNKNOWN); // born after the match
        // no counted match: today
        assertThat(PlayerStatsCalculator.ageBand(LocalDate.now().minusYears(30), null)).isEqualTo(AgeBand.ADULT);
    }

    @Test
    void guidesPerAgeBand() {
        assertThat(PlayerStatsCalculator.guides(AgeBand.UNDER_13)).isEqualTo(new MyStatsDto.MyStatsGuides(15, 30, "UNDER_13"));
        assertThat(PlayerStatsCalculator.guides(AgeBand.AGE_13_17)).isEqualTo(new MyStatsDto.MyStatsGuides(20, 40, "AGE_13_17"));
        assertThat(PlayerStatsCalculator.guides(AgeBand.ADULT)).isEqualTo(new MyStatsDto.MyStatsGuides(30, 50, "ADULT"));
        assertThat(PlayerStatsCalculator.guides(AgeBand.UNKNOWN)).isEqualTo(new MyStatsDto.MyStatsGuides(30, 50, "UNKNOWN"));
    }

    @Test
    void strikeRateIsNullWhenRunsOrBallsAreNotRecordedOrBallsAreZero() {
        assertThat(PlayerStatsCalculator.strikeRate(30, 20)).isEqualByComparingTo("150.00");
        assertThat(PlayerStatsCalculator.strikeRate(null, 20)).isNull();
        assertThat(PlayerStatsCalculator.strikeRate(30, null)).isNull();
        assertThat(PlayerStatsCalculator.strikeRate(30, 0)).isNull();
        assertThat(PlayerStatsCalculator.strikeRate(0, 5)).isEqualByComparingTo("0.00");
    }

    // ---- join ----

    @Test
    void joinInningsKeepsTheRowsOrderAndDerivesNotOutFromTheDismissal() {
        UUID r1 = UUID.randomUUID();
        UUID r2 = UUID.randomUUID();
        PlayerMatchRowDto m1 = row(UUID.randomUUID(), r1, null, null, List.of(), PlayerMatchResult.WON, true, null, null);
        PlayerMatchRowDto m2 = row(UUID.randomUUID(), r2, null, null, List.of(), PlayerMatchResult.WON, true, null, null);
        List<RawBattingDetail> raw = List.of(
                new RawBattingDetail(r2, 1, 1, 10, 12, 1, 0, DismissalType.BOWLED, "Sam", null, true, true, null, null),
                new RawBattingDetail(r1, 2, 3, 20, 15, 2, 0, DismissalType.NOT_OUT, null, null, false, false, null, null),
                new RawBattingDetail(r1, 1, 4, 5, 8, 0, 0, DismissalType.RETIRED_NOT_OUT, null, null, true, true, null, null),
                new RawBattingDetail(UUID.randomUUID(), 1, 1, 99, 9, 0, 0, DismissalType.BOWLED, null, null, true, true, null, null));

        List<InningsDetail> joined = PlayerStatsCalculator.joinInnings(List.of(m1, m2), raw);

        assertThat(joined).hasSize(3); // the detail of a result not among the rows is dropped
        assertThat(joined.get(0).resultId()).isEqualTo(r1);
        assertThat(joined.get(2).resultId()).isEqualTo(r2);
        assertThat(joined.get(0).notOut()).isTrue();
        assertThat(joined.get(2).notOut()).isFalse();
        assertThat(PlayerStatsCalculator.joinInnings(List.of(), List.of())).isEmpty();
    }

    // ---- rolling ----

    @Test
    void rollingAverageIsRunsPerDismissalOverTheLastFiveAndNullWhileNoDismissal() {
        List<InningsDetail> innings = new ArrayList<>();
        innings.add(inn(1, 1, 50, 40, DismissalType.NOT_OUT));
        innings.add(inn(1, 1, 10, 10, DismissalType.BOWLED));
        for (int i = 0; i < 4; i++) {
            innings.add(inn(1, 1, 20, 10, DismissalType.CAUGHT));
        }
        MyStatsDto.MyStatsRolling r = PlayerStatsCalculator.rolling(innings);

        assertThat(r.span()).isEqualTo(5);
        assertThat(r.points()).hasSize(6);
        assertThat(r.points().get(0).average()).isNull(); // only a not out so far
        assertThat(r.points().get(1).average()).isEqualByComparingTo("60.00"); // 60 runs, 1 dismissal
        assertThat(r.points().get(5).average()).isEqualByComparingTo("18.00"); // last five innings: 10 + 4x20 = 90 over 5 dismissals
        assertThat(r.hint()).isNull(); // too few for two halves of at least three
    }

    @Test
    void rollingHintComparesTheLastFiveWithTheFiveBeforeAndEmptyHistoryGivesNothing() {
        List<InningsDetail> improving = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            improving.add(inn(1, 1, 10, 10, DismissalType.BOWLED));
        }
        for (int i = 0; i < 5; i++) {
            improving.add(inn(1, 1, 30, 10, DismissalType.BOWLED));
        }
        MyStatsDto.MyStatsTrendHint hint = PlayerStatsCalculator.rolling(improving).hint();
        assertThat(hint.direction()).isEqualTo("UP");
        assertThat(hint.recent()).isEqualByComparingTo("30.00");
        assertThat(hint.earlier()).isEqualByComparingTo("10.00");

        MyStatsDto.MyStatsRolling empty = PlayerStatsCalculator.rolling(List.of());
        assertThat(empty.points()).isEmpty();
        assertThat(empty.hint()).isNull();
    }

    @Test
    void rollingKeepsOnlyTheLastThirtyPoints() {
        List<InningsDetail> many = new ArrayList<>();
        for (int i = 0; i < 40; i++) {
            many.add(inn(1, 1, 10, 10, DismissalType.BOWLED));
        }
        assertThat(PlayerStatsCalculator.rolling(many).points()).hasSize(30);
    }

    // ---- bands ----

    @Test
    void bandsCountOnlyStoredScoresAndHaveTheEdgesAtTenThirtyAndFifty() {
        List<MyStatsDto.MyStatsBand> b = PlayerStatsCalculator.bands(List.of(
                inn(1, 1, 0, 1, DismissalType.BOWLED), inn(1, 1, 9, 5, DismissalType.BOWLED),
                inn(1, 1, 10, 5, DismissalType.BOWLED), inn(1, 1, 29, 5, DismissalType.BOWLED),
                inn(1, 1, 30, 5, DismissalType.BOWLED), inn(1, 1, 49, 5, DismissalType.BOWLED),
                inn(1, 1, 50, 5, DismissalType.NOT_OUT), inn(1, 1, 120, 5, DismissalType.NOT_OUT),
                inn(1, 1, null, null, DismissalType.BOWLED)));

        assertThat(b).extracting(MyStatsDto.MyStatsBand::filter)
                .containsExactly("BAND_0_9", "BAND_10_29", "BAND_30_49", "BAND_50_PLUS");
        assertThat(b).extracting(MyStatsDto.MyStatsBand::innings).containsExactly(2L, 2L, 2L, 2L);
        assertThat(b).extracting(MyStatsDto.MyStatsBand::percent).allSatisfy(p -> assertThat(p).isEqualByComparingTo("25.00"));
    }

    @Test
    void bandsOfNoInningsAreZeroWithANullPercentNotADivisionByZero() {
        List<MyStatsDto.MyStatsBand> b = PlayerStatsCalculator.bands(List.of());
        assertThat(b).hasSize(4);
        assertThat(b).allSatisfy(x -> {
            assertThat(x.innings()).isZero();
            assertThat(x.percent()).isNull();
        });
    }

    // ---- innings number ----

    @Test
    void byInningsNumberSplitsFirstAndSecondInningsWithAveragesOnDismissals() {
        MyStatsDto.MyStatsByInningsNumber n = PlayerStatsCalculator.byInningsNumber(List.of(
                inn(1, 1, 40, 30, DismissalType.BOWLED), inn(1, 1, 20, 30, DismissalType.NOT_OUT),
                inn(2, 1, 10, 30, DismissalType.CAUGHT), inn(3, 1, 99, 30, DismissalType.BOWLED)));

        assertThat(n.battingFirst().innings()).isEqualTo(2);
        assertThat(n.battingFirst().notOuts()).isEqualTo(1);
        assertThat(n.battingFirst().runs()).isEqualTo(60);
        assertThat(n.battingFirst().average()).isEqualByComparingTo("60.00");
        assertThat(n.battingFirst().filter()).isEqualTo("FIRST_INNINGS");
        assertThat(n.chasing().innings()).isEqualTo(1);
        assertThat(n.chasing().average()).isEqualByComparingTo("10.00");
        assertThat(n.chasing().filter()).isEqualTo("SECOND_INNINGS");
    }

    @Test
    void byInningsNumberWithOnlyNotOutsOrNothingHasANullAverage() {
        MyStatsDto.MyStatsByInningsNumber n =
                PlayerStatsCalculator.byInningsNumber(List.of(inn(1, 1, 40, 30, DismissalType.NOT_OUT)));
        assertThat(n.battingFirst().average()).isNull();
        assertThat(n.chasing().innings()).isZero();
        assertThat(n.chasing().average()).isNull();
    }

    // ---- opposition ----

    @Test
    void byOppositionGroupsNamesIgnoringCaseAndSpacesLeavesDerbiesOutAndOrdersByInningsThenName() {
        List<MyStatsDto.MyStatsOpposition> o = PlayerStatsCalculator.byOpposition(List.of(
                detail("Zebras", false, 1, 1, 10, 5, DismissalType.BOWLED, null, true, true, null, null),
                detail(" zebras ", false, 1, 1, 30, 5, DismissalType.NOT_OUT, null, true, true, null, null),
                detail("Ants", false, 1, 1, 7, 5, DismissalType.BOWLED, null, true, true, null, null),
                detail("Bees", false, 1, 1, 8, 5, DismissalType.BOWLED, null, true, true, null, null),
                detail("Own Club", true, 1, 1, 99, 5, DismissalType.BOWLED, null, true, true, null, null),
                detail(null, false, 1, 1, 99, 5, DismissalType.BOWLED, null, true, true, null, null),
                detail("  ", false, 1, 1, 99, 5, DismissalType.BOWLED, null, true, true, null, null)));

        assertThat(o).extracting(MyStatsDto.MyStatsOpposition::opponentName).containsExactly("zebras", "Ants", "Bees");
        MyStatsDto.MyStatsOpposition z = o.get(0);
        assertThat(z.innings()).isEqualTo(2);
        assertThat(z.runs()).isEqualTo(40);
        assertThat(z.average()).isEqualByComparingTo("40.00");
        assertThat(z.scores()).extracting(MyStatsDto.MyStatsScore::runs).containsExactly(10, 30);
        assertThat(z.scores().get(1).notOut()).isTrue();
        assertThat(PlayerStatsCalculator.byOpposition(List.of())).isEmpty();
    }

    // ---- dismissed by ----

    @Test
    void dismissedByCountsOnlyBowlerCreditedOutsAndKeepsUnnamedBowlersApart() {
        MyStatsDto.MyStatsDismissedBy d = PlayerStatsCalculator.dismissedBy(List.of(
                detail("O", false, 1, 1, 1, 1, DismissalType.BOWLED, "Sam Fast", true, true, null, null),
                detail("O", false, 1, 1, 1, 1, DismissalType.LBW, " sam fast", true, true, null, null),
                detail("O", false, 1, 1, 1, 1, DismissalType.CAUGHT, "Abe Slow", true, true, null, null),
                detail("O", false, 1, 1, 1, 1, DismissalType.STUMPED, null, true, true, null, null),
                detail("O", false, 1, 1, 1, 1, DismissalType.CAUGHT, "  ", true, true, null, null),
                detail("O", false, 1, 1, 1, 1, DismissalType.RUN_OUT, "Not Credited", true, true, null, null),
                detail("O", false, 1, 1, 1, 1, DismissalType.NOT_OUT, "Nobody", true, true, null, null)));

        assertThat(d.total()).isEqualTo(5);
        assertThat(d.notRecorded()).isEqualTo(2);
        // " sam fast" is a different spelling and is kept as recorded (only surrounding spaces are trimmed)
        assertThat(d.bowlers()).extracting(MyStatsDto.MyStatsNameCount::name).contains("Abe Slow");
        assertThat(d.bowlers().stream().mapToLong(MyStatsDto.MyStatsNameCount::count).sum() + d.notRecorded())
                .isEqualTo(d.total());
        assertThat(PlayerStatsCalculator.dismissedBy(List.of()).total()).isZero();
    }

    // ---- wickets by position ----

    @Test
    void wicketsByPositionGroupsOpenersMiddleTailAndCountsMissingPositionsAsNotRecorded() {
        MyStatsDto.MyStatsWicketsByPosition w = PlayerStatsCalculator.wicketsByPosition(List.of(
                new WicketDetail(null, 1, DismissalType.BOWLED, null),
                new WicketDetail(null, 2, DismissalType.CAUGHT, "Kim"),
                new WicketDetail(null, 3, DismissalType.LBW, null),
                new WicketDetail(null, 6, DismissalType.CAUGHT, "Kim"),
                new WicketDetail(null, 7, DismissalType.STUMPED, null),
                new WicketDetail(null, 11, DismissalType.BOWLED, null),
                new WicketDetail(null, 12, DismissalType.BOWLED, null),
                new WicketDetail(null, 0, DismissalType.BOWLED, null),
                new WicketDetail(null, null, DismissalType.BOWLED, null),
                new WicketDetail(null, 4, DismissalType.RUN_OUT, "Kim"),
                new WicketDetail(null, 4, null, null)));

        assertThat(w.groups()).extracting(MyStatsDto.MyStatsPositionGroup::key).containsExactly("OPENERS", "MIDDLE", "TAIL");
        assertThat(w.groups()).extracting(MyStatsDto.MyStatsPositionGroup::count).containsExactly(2L, 2L, 2L);
        assertThat(w.notRecorded()).isEqualTo(3);
        assertThat(w.total()).isEqualTo(9); // run out and null types are not the bowler's wickets
        assertThat(w.groups().stream().mapToLong(MyStatsDto.MyStatsPositionGroup::count).sum() + w.notRecorded())
                .isEqualTo(w.total());
        assertThat(w.caughtBy()).containsExactly(new MyStatsDto.MyStatsNameCount("Kim", 2));
    }

    @Test
    void wicketsByPositionOfNothingIsAllZero() {
        MyStatsDto.MyStatsWicketsByPosition w = PlayerStatsCalculator.wicketsByPosition(List.of());
        assertThat(w.total()).isZero();
        assertThat(w.groups()).extracting(MyStatsDto.MyStatsPositionGroup::count).containsExactly(0L, 0L, 0L);
        assertThat(w.caughtBy()).isEmpty();
    }

    // ---- milestones ----

    @Test
    void milestoneIsTheFirstRungAboveTheCurrentFigureThenMultiplesOfTheStep() {
        long[] ladder = {50, 100};
        assertThat(PlayerStatsCalculator.milestone(0, ladder, 1000)).isEqualTo(new MyStatsDto.MyStatsMilestone(0, 50, 50));
        assertThat(PlayerStatsCalculator.milestone(49, ladder, 1000)).isEqualTo(new MyStatsDto.MyStatsMilestone(49, 50, 1));
        assertThat(PlayerStatsCalculator.milestone(50, ladder, 1000)).isEqualTo(new MyStatsDto.MyStatsMilestone(50, 100, 50));
        assertThat(PlayerStatsCalculator.milestone(100, ladder, 1000)).isEqualTo(new MyStatsDto.MyStatsMilestone(100, 1000, 900));
        assertThat(PlayerStatsCalculator.milestone(2500, ladder, 1000)).isEqualTo(new MyStatsDto.MyStatsMilestone(2500, 3000, 500));
    }

    @Test
    void milestonesTakeThePersonalBestsFromTheHistoryWithTheMostRecentWinningTies() {
        UUID mOld = UUID.randomUUID();
        UUID mNew = UUID.randomUUID();
        InningsDetail oldInn = new InningsDetail(UUID.randomUUID(), mOld, T0, "O", false, null, 1, 1, 60, 50, 0, 0,
                DismissalType.BOWLED, false, null, true, true, null, null);
        InningsDetail newInn = new InningsDetail(UUID.randomUUID(), mNew, T0.plusSeconds(1), "O", false, null, 1, 1, 60, 30, 0, 0,
                DismissalType.BOWLED, false, null, true, true, null, null);
        InningsDetail notOutInn = new InningsDetail(UUID.randomUUID(), UUID.randomUUID(), T0.plusSeconds(2), "O", false, null, 1, 1,
                60, 10, 0, 0, DismissalType.NOT_OUT, true, null, true, true, null, null);
        InningsDetail shortBalls = new InningsDetail(UUID.randomUUID(), UUID.randomUUID(), T0.plusSeconds(3), "O", false, null, 1, 1,
                30, 10, 0, 0, DismissalType.BOWLED, false, null, true, true, null, null);

        PlayerMatchRowDto first = bowlRow(UUID.randomUUID(), 6, spell(24, 0, 20, 3, null, null));
        PlayerMatchRowDto second = bowlRow(UUID.randomUUID(), 6, spell(24, 0, 20, 3, null, null));
        PlayerStatsCounters counters = PlayerStatsTestData.counters().bat(4, 3, 210).fielding(4, 0, 0).bowl(2, 48, 40, 6).build();

        MyStatsDto.MyStatsMilestones m = PlayerStatsCalculator.milestones(
                counters, List.of(first, second), List.of(oldInn, newInn, notOutInn, shortBalls));

        assertThat(m.runs()).isEqualTo(new MyStatsDto.MyStatsMilestone(210, 250, 40));
        assertThat(m.wickets()).isEqualTo(new MyStatsDto.MyStatsMilestone(6, 10, 4));
        assertThat(m.catches()).isEqualTo(new MyStatsDto.MyStatsMilestone(4, 5, 1));
        assertThat(m.personalBests().highestScore().runs()).isEqualTo(60);
        assertThat(m.personalBests().highestScore().notOut()).isTrue(); // 60* beats 60
        assertThat(m.personalBests().bestBowling().matchId()).isEqualTo(second.matchId()); // tie: most recent
        assertThat(m.personalBests().bestBowling().wickets()).isEqualTo(3);
        assertThat(m.personalBests().mostCatches()).isNull(); // no fielding credit
        // best strike rate needs 20 or more balls: 60 off 30 is 200.00 and 60 off 50 is 120.00
        assertThat(m.personalBests().bestStrikeRate().strikeRate()).isEqualByComparingTo("200.00");
        assertThat(m.personalBests().bestStrikeRate().matchId()).isEqualTo(mNew);
        assertThat(m.personalBests().minimumBalls()).isEqualTo(20);
    }

    @Test
    void personalBestsOfAnEmptyHistoryAreAllNull() {
        MyStatsDto.MyStatsMilestones m =
                PlayerStatsCalculator.milestones(PlayerStatsTestData.counters().build(), List.of(), List.of());
        assertThat(m.runs()).isEqualTo(new MyStatsDto.MyStatsMilestone(0, 50, 50));
        assertThat(m.personalBests().highestScore()).isNull();
        assertThat(m.personalBests().bestBowling()).isNull();
        assertThat(m.personalBests().mostCatches()).isNull();
        assertThat(m.personalBests().bestStrikeRate()).isNull();
    }

    @Test
    void anInningsWithNoStoredScoreOrTooFewBallsIsNeverAPersonalBest() {
        InningsDetail noRuns = inn(1, 1, null, null, DismissalType.BOWLED);
        InningsDetail fewBalls = inn(1, 1, 30, 19, DismissalType.BOWLED);
        MyStatsDto.MyStatsPersonalBests pb = PlayerStatsCalculator
                .milestones(PlayerStatsTestData.counters().build(), List.of(), List.of(noRuns, fewBalls)).personalBests();
        assertThat(pb.highestScore().runs()).isEqualTo(30);
        assertThat(pb.bestStrikeRate()).isNull();
    }

    // ---- team record when scoring ----

    @Test
    void teamRecordWhenScoringSplitsOnThirtyAndCountsNoResultsAsMatchesOnly() {
        PlayerMatchRowDto won = simple(PlayerMatchResult.WON, true);
        PlayerMatchRowDto lost = simple(PlayerMatchResult.LOST, true);
        PlayerMatchRowDto tied = simple(PlayerMatchResult.TIED, true);
        PlayerMatchRowDto drawn = simple(PlayerMatchResult.DRAWN, true);
        PlayerMatchRowDto abandoned = simple(PlayerMatchResult.ABANDONED, true);
        PlayerMatchRowDto noCard = simple(PlayerMatchResult.WON, false);
        PlayerMatchRowDto derby = simple(PlayerMatchResult.INTERNAL, true);
        PlayerMatchRowDto derbyReal = new PlayerMatchRowDto(derby.matchId(), derby.resultId(), derby.matchDate(), derby.ourTeams(),
                null, true, null, null, derby.competition(), derby.result(), 6, true, false, derby.batting(), derby.bowling(),
                derby.fielding(), derby.awards());
        PlayerMatchRowDto noRuns = simple(PlayerMatchResult.LOST, true);

        List<InningsDetail> innings = List.of(
                forResult(won, 30), forResult(lost, 29), forResult(lost, 45), forResult(tied, 31), forResult(drawn, 5),
                forResult(abandoned, 60), forResult(noCard, 99), forResult(derbyReal, 99), forResult(noRuns, null));

        MyStatsDto.MyStatsTeamRecordWhenScoring r = PlayerStatsCalculator.teamRecordWhenScoring(
                List.of(won, lost, tied, drawn, abandoned, noCard, derbyReal, noRuns), innings);

        assertThat(r.threshold()).isEqualTo(30);
        // scored 30+: won (30), lost (45 best of 29 and 45), tied (31), abandoned (60)
        assertThat(r.scored()).isEqualTo(new MyStatsDto.MyStatsRecordSplit(4, 1, 1, 1, 0, bd("33.3")));
        // not scored: drawn (5) and the loss with no stored score
        assertThat(r.notScored()).isEqualTo(new MyStatsDto.MyStatsRecordSplit(2, 0, 1, 0, 1, bd("0.0")));
        assertThat(r.scoredFilter()).isEqualTo("SCORED_30_PLUS");
        assertThat(r.notScoredFilter()).isEqualTo("UNDER_30");
    }

    private static InningsDetail forResult(PlayerMatchRowDto row, Integer runs) {
        return new InningsDetail(row.resultId(), row.matchId(), row.matchDate(), "O", row.derby(), null, 1, 1, runs, 10, 0, 0,
                DismissalType.BOWLED, false, null, true, true, null, null);
    }

    @Test
    void teamRecordWhenScoringWithNoMatchesHasNullWinPercents() {
        MyStatsDto.MyStatsTeamRecordWhenScoring r = PlayerStatsCalculator.teamRecordWhenScoring(List.of(), List.of());
        assertThat(r.scored().matches()).isZero();
        assertThat(r.scored().winPercent()).isNull();
        assertThat(r.notScored().winPercent()).isNull();
    }

    // ---- home and away ----

    @Test
    void homeAwaySplitsOnTheClubFieldAndCountsUnknownFieldMatchesOnce() {
        InningsDetail home1 = detail("O", false, 1, 1, 40, 10, DismissalType.BOWLED, null, true, true, null, null);
        InningsDetail home2 = detail("O", false, 1, 1, 10, 10, DismissalType.NOT_OUT, null, true, true, null, null);
        InningsDetail away = detail("O", false, 1, 1, 6, 10, DismissalType.CAUGHT, null, true, false, null, null);
        InningsDetail unknown = detail("O", false, 1, 1, 77, 10, DismissalType.BOWLED, null, false, false, null, null);
        InningsDetail unknownSecond = new InningsDetail(unknown.resultId(), unknown.matchId(), unknown.matchDate(), "O", false,
                null, 2, 1, 1, 1, 0, 0, DismissalType.BOWLED, false, null, false, false, null, null);

        MyStatsDto.MyStatsHomeAway h = PlayerStatsCalculator.homeAway(List.of(home1, home2, away, unknown, unknownSecond));

        assertThat(h.home()).isEqualTo(new MyStatsDto.MyStatsFieldSplit(2, 1, 50, bd("50.00")));
        assertThat(h.away()).isEqualTo(new MyStatsDto.MyStatsFieldSplit(1, 1, 6, bd("6.00")));
        assertThat(h.unknownFieldMatches()).isEqualTo(1); // one result, two innings
    }

    @Test
    void homeAwayWithNothingHasZeroSplitsAndNullAverages() {
        MyStatsDto.MyStatsHomeAway h = PlayerStatsCalculator.homeAway(List.of());
        assertThat(h.home().average()).isNull();
        assertThat(h.away().innings()).isZero();
        assertThat(h.unknownFieldMatches()).isZero();
    }

    // ---- batting position groups ----

    @Test
    void battingPositionGroupsMergeOpenersAndOmitEmptyOrOutOfRangePositions() {
        List<MyStatsDto.MyStatsBattingPositionGroup> g = PlayerStatsCalculator.battingPositionGroups(List.of(
                inn(1, 1, 10, 5, DismissalType.BOWLED), inn(1, 2, 30, 5, DismissalType.NOT_OUT),
                inn(1, 2, null, null, DismissalType.BOWLED), inn(1, 4, 20, 5, DismissalType.CAUGHT),
                inn(1, 11, 3, 5, DismissalType.NOT_OUT), inn(1, 12, 99, 5, DismissalType.BOWLED),
                inn(1, 0, 99, 5, DismissalType.BOWLED), inn(1, null, 99, 5, DismissalType.BOWLED)));

        assertThat(g).extracting(MyStatsDto.MyStatsBattingPositionGroup::key).containsExactly("OPENER", "4", "11");
        MyStatsDto.MyStatsBattingPositionGroup opener = g.get(0);
        assertThat(opener.label()).isEqualTo("Opener");
        assertThat(opener.innings()).isEqualTo(3);
        assertThat(opener.runs()).isEqualTo(40);
        assertThat(opener.notOuts()).isEqualTo(1);
        assertThat(opener.dismissals()).isEqualTo(2);
        assertThat(opener.average()).isEqualByComparingTo("20.00");
        assertThat(opener.highest()).isEqualTo(30);
        assertThat(g.get(2).average()).isNull(); // a not out only: no dismissal to divide by
        assertThat(PlayerStatsCalculator.battingPositionGroups(List.of())).isEmpty();
    }

    @Test
    void battingPositionHighestIsNullWhenNoScoreWasStored() {
        List<MyStatsDto.MyStatsBattingPositionGroup> g =
                PlayerStatsCalculator.battingPositionGroups(List.of(inn(1, 5, null, null, DismissalType.BOWLED)));
        assertThat(g.get(0).highest()).isNull();
        assertThat(g.get(0).runs()).isZero();
    }

    // ---- batting venues ----

    @Test
    void battingVenuesSortByRunsGroupNoAreaAsUnknownAndCapAtTwelveWithOtherVenues() {
        UUID home = UUID.randomUUID();
        List<InningsDetail> innings = new ArrayList<>();
        innings.add(detail("O", false, 1, 1, 10, 5, DismissalType.BOWLED, null, true, true, home, "Home Oval"));
        innings.add(detail("O", false, 1, 1, 50, 5, DismissalType.NOT_OUT, null, true, true, home, "Home Oval"));
        innings.add(detail("O", false, 1, 1, 5, 5, DismissalType.BOWLED, null, false, false, null, null));
        List<MyStatsDto.MyStatsBattingVenue> few = PlayerStatsCalculator.battingVenues(innings);
        assertThat(few).extracting(MyStatsDto.MyStatsBattingVenue::name).containsExactly("Home Oval", "Unknown venue");
        assertThat(few.get(0).home()).isTrue();
        assertThat(few.get(0).average()).isEqualByComparingTo("60.00");
        assertThat(few.get(1).home()).isNull();
        assertThat(few.get(1).venueKey()).isEqualTo("unknown");

        List<InningsDetail> thirteen = new ArrayList<>();
        for (int i = 0; i < 14; i++) {
            thirteen.add(detail("O", false, 1, 1, 100 - i, 5, DismissalType.BOWLED, null, true, false, UUID.randomUUID(), "Ground " + i));
        }
        List<MyStatsDto.MyStatsBattingVenue> capped = PlayerStatsCalculator.battingVenues(thirteen);
        assertThat(capped).hasSize(13);
        MyStatsDto.MyStatsBattingVenue other = capped.get(12);
        assertThat(other.name()).isEqualTo("Other venues");
        assertThat(other.venueKey()).isEqualTo("other");
        assertThat(other.innings()).isEqualTo(2);
        assertThat(other.runs()).isEqualTo(88 + 87);
        assertThat(other.home()).isNull();
        assertThat(capped.stream().mapToLong(MyStatsDto.MyStatsBattingVenue::runs).sum())
                .isEqualTo(thirteen.stream().mapToLong(InningsDetail::runs).sum());
        assertThat(PlayerStatsCalculator.battingVenues(List.of())).isEmpty();
    }

    // ---- bowling home and away, venues ----

    @Test
    void bowlingHomeAwaySplitsSpellsByTheResultsVenueAndCountsUnknownSpells() {
        UUID homeResult = UUID.randomUUID();
        UUID awayResult = UUID.randomUUID();
        UUID unknownResult = UUID.randomUUID();
        UUID area1 = UUID.randomUUID();
        UUID area2 = UUID.randomUUID();
        List<PlayerMatchRowDto> rows = List.of(
                bowlRow(homeResult, 6, spell(24, 1, 20, 2, null, null), spell(12, 0, 10, 1, null, null)),
                bowlRow(awayResult, 6, spell(18, 0, 30, 0, null, null)),
                bowlRow(unknownResult, 6, spell(6, 0, 6, 0, null, null)),
                simple(PlayerMatchResult.WON, true));
        List<ResultVenue> venues = List.of(
                new ResultVenue(homeResult, area1, "Home", true),
                new ResultVenue(awayResult, area2, "Away", false),
                new ResultVenue(unknownResult, null, null, false));

        MyStatsDto.MyStatsBowlingHomeAway h = PlayerStatsCalculator.bowlingHomeAway(rows, venues);

        assertThat(h.home().spells()).isEqualTo(2);
        assertThat(h.home().balls()).isEqualTo(36);
        assertThat(h.home().wickets()).isEqualTo(3);
        assertThat(h.home().runs()).isEqualTo(30);
        assertThat(h.home().ballsPerOver()).isEqualTo(6);
        assertThat(h.home().economy()).isEqualByComparingTo("5.00");
        assertThat(h.home().average()).isEqualByComparingTo("10.00");
        assertThat(h.away().wickets()).isZero();
        assertThat(h.away().average()).isNull(); // no wickets: no average
        assertThat(h.away().economy()).isEqualByComparingTo("10.00");
        assertThat(h.unknownVenueSpells()).isEqualTo(1);
    }

    @Test
    void bowlingHomeAwayWithNoSpellsHasNullEconomyAndAverage() {
        MyStatsDto.MyStatsBowlingHomeAway h = PlayerStatsCalculator.bowlingHomeAway(List.of(), List.of());
        assertThat(h.home().spells()).isZero();
        assertThat(h.home().economy()).isNull();
        assertThat(h.home().average()).isNull();
        assertThat(h.home().ballsPerOver()).isNull();
        assertThat(h.unknownVenueSpells()).isZero();
    }

    @Test
    void aZeroBallSpellHasNoEconomyAndMixedOverLengthsHaveNoBallsPerOver() {
        UUID r1 = UUID.randomUUID();
        UUID r2 = UUID.randomUUID();
        UUID area = UUID.randomUUID();
        List<MyStatsDto.MyStatsBowlingVenue> v = PlayerStatsCalculator.bowlingVenues(
                List.of(bowlRow(r1, 6, spell(12, 0, 10, 1, null, null)), bowlRow(r2, 8, spell(16, 0, 20, 1, null, null))),
                List.of(new ResultVenue(r1, area, "Ground", false), new ResultVenue(r2, area, "Ground", false)));
        assertThat(v).hasSize(1);
        assertThat(v.get(0).ballsPerOver()).isNull();

        MyStatsDto.MyStatsBowlingHomeAway zero = PlayerStatsCalculator.bowlingHomeAway(
                List.of(bowlRow(r1, 6, spell(0, 0, 0, 1, null, null))), List.of(new ResultVenue(r1, area, "G", true)));
        assertThat(zero.home().economy()).isNull();
        assertThat(zero.home().average()).isEqualByComparingTo("0.00");
    }

    @Test
    void bowlingVenuesSortByWicketsThenEconomyAndCapAtTwelveWithOtherVenues() {
        UUID r1 = UUID.randomUUID();
        UUID r2 = UUID.randomUUID();
        UUID noVenue = UUID.randomUUID();
        UUID a1 = UUID.randomUUID();
        UUID a2 = UUID.randomUUID();
        List<MyStatsDto.MyStatsBowlingVenue> v = PlayerStatsCalculator.bowlingVenues(
                List.of(bowlRow(r1, 6, spell(12, 0, 24, 1, null, null)), bowlRow(r2, 6, spell(12, 0, 12, 1, null, null)),
                        bowlRow(noVenue, 6, spell(6, 0, 1, 2, null, null))),
                List.of(new ResultVenue(r1, a1, "Slow Pitch", true), new ResultVenue(r2, a2, "Fast Pitch", false)));
        assertThat(v).extracting(MyStatsDto.MyStatsBowlingVenue::name).containsExactly("Unknown venue", "Fast Pitch", "Slow Pitch");
        assertThat(v.get(1).economy()).isEqualByComparingTo("6.00");

        List<ResultVenue> venues = new ArrayList<>();
        List<PlayerMatchRowDto> rows = new ArrayList<>();
        for (int i = 0; i < 14; i++) {
            UUID r = UUID.randomUUID();
            venues.add(new ResultVenue(r, UUID.randomUUID(), "G" + i, false));
            rows.add(bowlRow(r, 6, spell(6, 0, 6, 1, null, null)));
        }
        List<MyStatsDto.MyStatsBowlingVenue> capped = PlayerStatsCalculator.bowlingVenues(rows, venues);
        assertThat(capped).hasSize(13);
        assertThat(capped.get(12).name()).isEqualTo("Other venues");
        assertThat(capped.get(12).spells()).isEqualTo(2);
        assertThat(capped.stream().mapToLong(MyStatsDto.MyStatsBowlingVenue::wickets).sum()).isEqualTo(14);
        assertThat(PlayerStatsCalculator.bowlingVenues(List.of(), List.of())).isEmpty();
    }

    // ---- by season ----

    @Test
    void bySeasonIsOldestFirstWithASeasonWithoutAStartLastAndANullAverageWithoutDismissals() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        List<MyStatsDto.MyStatsSeason> s = PlayerStatsCalculator.bySeason(List.of(
                new SeasonCounters(c, "Undated", null, 1, 1, 0, 5, 0),
                new SeasonCounters(b, "2032", LocalDate.of(2032, 1, 1), 4, 4, 2, 100, 3),
                new SeasonCounters(a, "2031", LocalDate.of(2031, 1, 1), 2, 2, 0, 50, 0)));

        assertThat(s).extracting(MyStatsDto.MyStatsSeason::label).containsExactly("2031", "2032", "Undated");
        assertThat(s.get(0).average()).isNull(); // no dismissal
        assertThat(s.get(1).average()).isEqualByComparingTo("50.00");
        assertThat(s.get(1).wickets()).isEqualTo(3);
        assertThat(PlayerStatsCalculator.bySeason(List.of())).isEmpty();
    }

    // ---- bowling discipline ----

    @Test
    void bowlingDisciplinePerOverUsesOnlySpellsThatRecordedThatFigureAndNeverChargesByes() {
        PlayerStatsCounters counters = PlayerStatsTestData.counters().bowl(3, 36, 30, 2).build();
        PlayerMatchRowDto r1 = bowlRow(UUID.randomUUID(), 6, spell(12, 0, 10, 1, 2, 1), spell(6, 0, 5, 0, 1, null));
        PlayerMatchRowDto r2 = bowlRow(UUID.randomUUID(), 6, spell(18, 0, 15, 1, null, null));

        MyStatsDto.MyStatsBowlingDiscipline d = PlayerStatsCalculator.bowlingDiscipline(counters, List.of(r1, r2));

        assertThat(d.inningsCounted()).isEqualTo(3);
        assertThat(d.inningsRecorded()).isEqualTo(1); // only the first spell recorded both figures
        // wides 2 + 1 over 3 overs (12 + 6 balls) = 1.00; no-balls 1 over 2 overs (12 balls) = 0.50
        assertThat(d.widesPerOver()).isEqualByComparingTo("1.00");
        assertThat(d.noBallsPerOver()).isEqualByComparingTo("0.50");
        assertThat(d.byInnings()).hasSize(3);
        assertThat(d.byInnings().get(2).wides()).isNull();
        assertThat(d.wides()).isEqualTo(counters.bowling().wides());
        assertThat(d.noBalls()).isEqualTo(counters.bowling().noBalls());
    }

    @Test
    void bowlingDisciplineWithNoSpellsOrZeroOversHasNullRates() {
        MyStatsDto.MyStatsBowlingDiscipline none =
                PlayerStatsCalculator.bowlingDiscipline(PlayerStatsTestData.counters().build(), List.of());
        assertThat(none.widesPerOver()).isNull();
        assertThat(none.noBallsPerOver()).isNull();
        assertThat(none.byInnings()).isEmpty();

        MyStatsDto.MyStatsBowlingDiscipline zeroBalls = PlayerStatsCalculator.bowlingDiscipline(
                PlayerStatsTestData.counters().build(), List.of(bowlRow(UUID.randomUUID(), 6, spell(0, 0, 0, 1, 2, 1))));
        assertThat(zeroBalls.widesPerOver()).isNull();
        assertThat(zeroBalls.inningsRecorded()).isEqualTo(1);
    }

    // ---- availability and fixtures ----

    @Test
    void availabilityCountsClosedPollsAnsweredAvailableAndDistinctSelectionsInScope() {
        UUID season = UUID.randomUUID();
        UUID league = UUID.randomUUID();
        UUID team = UUID.randomUUID();
        UUID otherSeason = UUID.randomUUID();
        UUID m1 = UUID.randomUUID();
        List<PlayerStatsCalculator.PollFact> polls = List.of(
                new PlayerStatsCalculator.PollFact(m1, season, league, team, AvailabilityStatus.AVAILABLE),
                new PlayerStatsCalculator.PollFact(UUID.randomUUID(), season, league, team, AvailabilityStatus.UNAVAILABLE),
                new PlayerStatsCalculator.PollFact(UUID.randomUUID(), season, null, team, null),
                new PlayerStatsCalculator.PollFact(UUID.randomUUID(), otherSeason, league, team, AvailabilityStatus.AVAILABLE));
        List<PlayerStatsCalculator.SelectionFact> selections = List.of(
                new PlayerStatsCalculator.SelectionFact(m1, season, league, team),
                new PlayerStatsCalculator.SelectionFact(m1, season, league, team),
                new PlayerStatsCalculator.SelectionFact(UUID.randomUUID(), otherSeason, league, team));

        MyStatsDto.MyStatsAvailability all = PlayerStatsCalculator.availability(polls, selections, 7, null, null, null, null);
        assertThat(all).isEqualTo(new MyStatsDto.MyStatsAvailability(4, 3, 2, 2, 7));

        MyStatsDto.MyStatsAvailability scoped = PlayerStatsCalculator.availability(
                polls, selections, 7, season, null, team, StatsScope.Competition.LEAGUE);
        assertThat(scoped).isEqualTo(new MyStatsDto.MyStatsAvailability(2, 2, 1, 1, 7));
        MyStatsDto.MyStatsAvailability friendly = PlayerStatsCalculator.availability(
                polls, selections, 7, season, null, null, StatsScope.Competition.FRIENDLY);
        assertThat(friendly.pollsTotal()).isEqualTo(1);
        assertThat(PlayerStatsCalculator.availability(List.of(), List.of(), 0, null, null, null, null))
                .isEqualTo(new MyStatsDto.MyStatsAvailability(0, 0, 0, 0, 0));
    }

    @Test
    void fixturesRemainingFiltersTheUpcomingLeagueIdsByLeagueAndCompetition() {
        UUID league = UUID.randomUUID();
        List<UUID> upcoming = new ArrayList<>();
        upcoming.add(league);
        upcoming.add(league);
        upcoming.add(UUID.randomUUID());
        upcoming.add(null); // a friendly
        assertThat(PlayerStatsCalculator.fixturesRemaining(upcoming, null, null)).isEqualTo(4);
        assertThat(PlayerStatsCalculator.fixturesRemaining(upcoming, league, null)).isEqualTo(2);
        assertThat(PlayerStatsCalculator.fixturesRemaining(upcoming, null, StatsScope.Competition.LEAGUE)).isEqualTo(3);
        assertThat(PlayerStatsCalculator.fixturesRemaining(upcoming, null, StatsScope.Competition.FRIENDLY)).isEqualTo(1);
        assertThat(PlayerStatsCalculator.fixturesRemaining(List.of(), null, null)).isZero();
    }

    @Test
    void resultsWithFieldingCardCountsRecordedFieldingOnly() {
        PlayerMatchRowDto recorded = row(UUID.randomUUID(), UUID.randomUUID(), null, null, List.of(), PlayerMatchResult.WON, true, null, 0L);
        assertThat(PlayerStatsCalculator.resultsWithFieldingCard(List.of(recorded, simple(PlayerMatchResult.WON, true)))).isEqualTo(1);
        assertThat(PlayerStatsCalculator.resultsWithFieldingCard(List.of())).isZero();
    }
}
