package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.PlayerMatchRowDto;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBattingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBowlingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchFieldingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchResult;
import com.cricketlegend.service.support.PlayerMatchRowBuilder.AwardFact;
import com.cricketlegend.service.support.PlayerMatchRowBuilder.BattingFact;
import com.cricketlegend.service.support.PlayerMatchRowBuilder.BowlingFact;
import com.cricketlegend.service.support.PlayerMatchRowBuilder.FieldingFact;
import com.cricketlegend.service.support.PlayerMatchRowBuilder.MatchHeader;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/** docs/specs/115-player-match-list.md, "What a row contains": one case per rule of the pure row builder. */
class PlayerMatchRowBuilderTest {

    private static final UUID RESULT = UUID.randomUUID();
    private static final UUID MATCH = UUID.randomUUID();
    private static final UUID HOME_TEAM = UUID.randomUUID();
    private static final UUID AWAY_TEAM = UUID.randomUUID();
    private static final Instant DATE = Instant.parse("2026-03-14T09:30:00Z");

    private static MatchHeader header(
            ResultOutcomeType outcome,
            ResultSide winner,
            boolean derby,
            boolean onHome,
            boolean onAway,
            boolean battingCard,
            boolean bowlingCard) {
        return new MatchHeader(
                RESULT, MATCH, DATE, 6, outcome, winner, derby, onHome, onAway, null, null,
                HOME_TEAM, "Home XI", AWAY_TEAM, "Away XI", "Opposition CC", battingCard, bowlingCard);
    }

    /** A normal match on the home side, both cards captured. */
    private static MatchHeader home(ResultOutcomeType outcome, ResultSide winner) {
        return header(outcome, winner, false, true, false, true, true);
    }

    private static MatchHeader withCards(boolean battingCard, boolean bowlingCard) {
        return header(ResultOutcomeType.WON, ResultSide.HOME, false, true, false, battingCard, bowlingCard);
    }

    private static BattingFact bat(Integer runs, Integer balls, Integer fours, Integer sixes, DismissalType out) {
        return new BattingFact(RESULT, runs, balls, fours, sixes, out);
    }

    private static BowlingFact bowl(int balls, int maidens, int runs, int wickets, Integer dots) {
        return new BowlingFact(RESULT, balls, maidens, runs, wickets, dots, null, null);
    }

    private static PlayerMatchRowDto row(
            MatchHeader h, List<BattingFact> b, List<BowlingFact> w, List<FieldingFact> f, List<AwardFact> a) {
        return PlayerMatchRowBuilder.row(h, b, w, f, a);
    }

    private static PlayerMatchRowDto bare(MatchHeader h) {
        return row(h, List.of(), List.of(), List.of(), List.of());
    }

    // ---- result from the player's side ----

    @Test
    void homePlayerWinsWhenHomeWon() {
        assertThat(bare(home(ResultOutcomeType.WON, ResultSide.HOME)).result()).isEqualTo(PlayerMatchResult.WON);
    }

    @Test
    void homePlayerLosesWhenAwayWon() {
        assertThat(bare(home(ResultOutcomeType.WON, ResultSide.AWAY)).result()).isEqualTo(PlayerMatchResult.LOST);
    }

    @Test
    void awayPlayerWinsWhenAwayWon() {
        var h = header(ResultOutcomeType.WON, ResultSide.AWAY, false, false, true, true, true);
        assertThat(bare(h).result()).isEqualTo(PlayerMatchResult.WON);
    }

    @Test
    void awayPlayerLosesWhenHomeWon() {
        var h = header(ResultOutcomeType.WON, ResultSide.HOME, false, false, true, true, true);
        assertThat(bare(h).result()).isEqualTo(PlayerMatchResult.LOST);
    }

    @Test
    void tieDrawNoResultAndAbandonedHaveTheirOwnValues() {
        assertThat(bare(home(ResultOutcomeType.TIE, null)).result()).isEqualTo(PlayerMatchResult.TIED);
        assertThat(bare(home(ResultOutcomeType.DRAW, null)).result()).isEqualTo(PlayerMatchResult.DRAWN);
        assertThat(bare(home(ResultOutcomeType.NO_RESULT, null)).result()).isEqualTo(PlayerMatchResult.NO_RESULT);
        assertThat(bare(home(ResultOutcomeType.ABANDONED, null)).result()).isEqualTo(PlayerMatchResult.ABANDONED);
    }

    @ParameterizedTest
    @EnumSource(value = ResultOutcomeType.class, names = "FORFEIT", mode = EnumSource.Mode.EXCLUDE)
    void aDerbyIsInternalWhateverTheOutcomeAndNeverWonOrLost(ResultOutcomeType outcome) {
        var h = header(outcome, outcome == ResultOutcomeType.WON ? ResultSide.HOME : null, true, true, false, true, true);
        assertThat(bare(h).result()).isEqualTo(PlayerMatchResult.INTERNAL);
    }

    // ---- passthrough ----

    @Test
    void identityDateBallsPerOverAndCompetitionPassThrough() {
        var h = new MatchHeader(RESULT, MATCH, DATE, 8, ResultOutcomeType.DRAW, null, false, true, false,
                UUID.fromString("00000000-0000-0000-0000-000000000009"), "Premier",
                HOME_TEAM, "Home XI", null, "Away free text", "Away free text", true, true);
        var r = bare(h);
        assertThat(r.matchId()).isEqualTo(MATCH);
        assertThat(r.resultId()).isEqualTo(RESULT);
        assertThat(r.matchDate()).isEqualTo(DATE);
        assertThat(r.ballsPerOver()).isEqualTo(8);
        assertThat(r.competition()).isEqualTo("LEAGUE");
        assertThat(r.leagueName()).isEqualTo("Premier");
        assertThat(r.opponentName()).isEqualTo("Away free text");
        assertThat(r.hasBattingCard()).isTrue();
        assertThat(r.hasBowlingCard()).isTrue();
    }

    @Test
    void aMatchWithoutALeagueIsFriendly() {
        assertThat(bare(home(ResultOutcomeType.WON, ResultSide.HOME)).competition()).isEqualTo("FRIENDLY");
    }

    @Test
    void ourTeamsFollowTheSideFlags() {
        var homeRow = bare(home(ResultOutcomeType.WON, ResultSide.HOME));
        assertThat(homeRow.ourTeams()).singleElement().satisfies(t -> {
            assertThat(t.side()).isEqualTo("HOME");
            assertThat(t.teamId()).isEqualTo(HOME_TEAM);
            assertThat(t.teamName()).isEqualTo("Home XI");
        });
        var awayRow = bare(header(ResultOutcomeType.WON, ResultSide.HOME, false, false, true, true, true));
        assertThat(awayRow.ourTeams()).singleElement().satisfies(t -> {
            assertThat(t.side()).isEqualTo("AWAY");
            assertThat(t.teamId()).isEqualTo(AWAY_TEAM);
            assertThat(t.teamName()).isEqualTo("Away XI");
        });
    }

    // ---- batting status ----

    @Test
    void noBattingCardIsNoCardWithNoFigures() {
        var b = bare(withCards(false, true)).batting();
        assertThat(b.status()).isEqualTo(PlayerMatchBattingStatus.NO_CARD);
        assertThat(b.innings()).isNull();
        assertThat(b.inningsCount()).isNull();
        assertThat(b.runs()).isNull();
        assertThat(b.ballsFaced()).isNull();
    }

    @Test
    void aCapturedCardWithoutARowForThePlayerIsDidNotBat() {
        var b = bare(withCards(true, false)).batting();
        assertThat(b.status()).isEqualTo(PlayerMatchBattingStatus.DID_NOT_BAT);
        assertThat(b.runs()).isNull();
        assertThat(b.innings()).isNull();
    }

    @Test
    void aCountedBattingRowIsBattedEvenWhenTheCardFlagIsFalse() {
        var r = row(withCards(false, false), List.of(bat(10, 12, 1, 0, DismissalType.BOWLED)),
                List.of(), List.of(), List.of());
        assertThat(r.batting().status()).isEqualTo(PlayerMatchBattingStatus.BATTED);
        assertThat(r.batting().runs()).isEqualTo(10L);
    }

    @Test
    void aSingleInningsFillsTheBlock() {
        var r = row(home(ResultOutcomeType.WON, ResultSide.HOME),
                List.of(bat(47, 38, 5, 2, DismissalType.CAUGHT)), List.of(), List.of(), List.of());
        var b = r.batting();
        assertThat(b.status()).isEqualTo(PlayerMatchBattingStatus.BATTED);
        assertThat(b.inningsCount()).isEqualTo(1);
        assertThat(b.runs()).isEqualTo(47L);
        assertThat(b.ballsFaced()).isEqualTo(38L);
        assertThat(b.fours()).isEqualTo(5L);
        assertThat(b.sixes()).isEqualTo(2L);
        assertThat(b.innings()).singleElement().satisfies(i -> {
            assertThat(i.runs()).isEqualTo(47);
            assertThat(i.balls()).isEqualTo(38);
            assertThat(i.howOut()).isEqualTo(DismissalType.CAUGHT);
            assertThat(i.notOut()).isFalse();
            assertThat(i.fours()).isEqualTo(5);
            assertThat(i.sixes()).isEqualTo(2);
        });
    }

    @Test
    void multiInningsKeepsEachInningsAndSumsTheTotals() {
        var r = row(home(ResultOutcomeType.DRAW, null),
                List.of(bat(30, 40, 3, 1, DismissalType.LBW), bat(12, 20, 1, 0, DismissalType.NOT_OUT)),
                List.of(), List.of(), List.of());
        var b = r.batting();
        assertThat(b.innings()).hasSize(2);
        assertThat(b.inningsCount()).isEqualTo(2);
        assertThat(b.runs()).isEqualTo(42L);
        assertThat(b.ballsFaced()).isEqualTo(60L);
        assertThat(b.fours()).isEqualTo(4L);
        assertThat(b.sixes()).isEqualTo(1L);
        assertThat(b.innings().get(0).runs()).isEqualTo(30);
        assertThat(b.innings().get(1).runs()).isEqualTo(12);
    }

    // ---- optional-column coverage ----

    @Test
    void unrecordedBallsFoursAndSixesStayNullAndRunsAreStillSummed() {
        var r = row(home(ResultOutcomeType.WON, ResultSide.HOME),
                List.of(bat(20, null, null, null, DismissalType.BOWLED)), List.of(), List.of(), List.of());
        var b = r.batting();
        assertThat(b.innings().get(0).balls()).isNull();
        assertThat(b.innings().get(0).fours()).isNull();
        assertThat(b.ballsFaced()).isNull();
        assertThat(b.fours()).isNull();
        assertThat(b.sixes()).isNull();
        assertThat(b.runs()).isEqualTo(20L);
    }

    @Test
    void ballsNullInOneInningsAreSkippedByTheSumNotCountedAsZero() {
        // the "balls = 0 with runs > 0" case reaches the builder already as null (spec 103 "valid balls")
        var r = row(home(ResultOutcomeType.WON, ResultSide.HOME),
                List.of(bat(15, null, 2, null, DismissalType.BOWLED), bat(10, 11, null, 1, DismissalType.CAUGHT)),
                List.of(), List.of(), List.of());
        var b = r.batting();
        assertThat(b.ballsFaced()).isEqualTo(11L);
        assertThat(b.fours()).isEqualTo(2L);
        assertThat(b.sixes()).isEqualTo(1L);
        assertThat(b.runs()).isEqualTo(25L);
        assertThat(b.innings().get(0).balls()).isNull();
    }

    @Test
    void aNullRunsValueSumsToZeroNotNull() {
        var r = row(home(ResultOutcomeType.WON, ResultSide.HOME),
                List.of(bat(null, null, null, null, DismissalType.RUN_OUT)), List.of(), List.of(), List.of());
        assertThat(r.batting().runs()).isEqualTo(0L);
    }

    // ---- not out / out ----

    @ParameterizedTest
    @EnumSource(value = DismissalType.class, names = {"NOT_OUT", "RETIRED_NOT_OUT"})
    void notOutAndRetiredNotOutAreNotOut(DismissalType out) {
        var r = row(home(ResultOutcomeType.WON, ResultSide.HOME),
                List.of(bat(5, 5, 0, 0, out)), List.of(), List.of(), List.of());
        assertThat(r.batting().innings().get(0).notOut()).isTrue();
        assertThat(r.batting().innings().get(0).howOut()).isEqualTo(out);
    }

    @ParameterizedTest
    @EnumSource(value = DismissalType.class,
            names = {"NOT_OUT", "RETIRED_NOT_OUT", "DID_NOT_BAT"}, mode = EnumSource.Mode.EXCLUDE)
    void everyDismissalIncludingRetiredOutIsOut(DismissalType out) {
        var r = row(home(ResultOutcomeType.WON, ResultSide.HOME),
                List.of(bat(5, 5, 0, 0, out)), List.of(), List.of(), List.of());
        assertThat(r.batting().innings().get(0).notOut()).isFalse();
        assertThat(r.batting().innings().get(0).howOut()).isEqualTo(out);
    }

    // ---- bowling ----

    @Test
    void noBowlingCardIsNoCard() {
        var w = bare(withCards(true, false)).bowling();
        assertThat(w.status()).isEqualTo(PlayerMatchBowlingStatus.NO_CARD);
        assertThat(w.spells()).isNull();
        assertThat(w.wickets()).isNull();
        assertThat(w.balls()).isNull();
    }

    @Test
    void aCapturedBowlingCardWithoutARowIsDidNotBowl() {
        var w = bare(withCards(false, true)).bowling();
        assertThat(w.status()).isEqualTo(PlayerMatchBowlingStatus.DID_NOT_BOWL);
        assertThat(w.wickets()).isNull();
    }

    @Test
    void aBowlingRowWithBallsOrRunsIsBowledAndFillsTheBlock() {
        var r = row(home(ResultOutcomeType.WON, ResultSide.HOME), List.of(),
                List.of(new BowlingFact(RESULT, 24, 2, 31, 3, 7, 1, 0)), List.of(), List.of());
        var w = r.bowling();
        assertThat(w.status()).isEqualTo(PlayerMatchBowlingStatus.BOWLED);
        assertThat(w.balls()).isEqualTo(24L);
        assertThat(w.maidens()).isEqualTo(2L);
        assertThat(w.runs()).isEqualTo(31L);
        assertThat(w.wickets()).isEqualTo(3L);
        assertThat(w.dots()).isEqualTo(7L);
        assertThat(w.spells()).singleElement().satisfies(s -> {
            assertThat(s.balls()).isEqualTo(24);
            assertThat(s.wickets()).isEqualTo(3);
            assertThat(s.wides()).isEqualTo(1);
            assertThat(s.noBalls()).isEqualTo(0);
        });
    }

    @Test
    void aRowWithRunsButNoBallsStillCountsAsASpell() {
        var r = row(home(ResultOutcomeType.WON, ResultSide.HOME), List.of(),
                List.of(bow(0, 0, 4, 0, null)), List.of(), List.of());
        assertThat(r.bowling().status()).isEqualTo(PlayerMatchBowlingStatus.BOWLED);
        assertThat(r.bowling().spells()).hasSize(1);
    }

    private static BowlingFact bow(int balls, int maidens, int runs, int wickets, Integer dots) {
        return bowl(balls, maidens, runs, wickets, dots);
    }

    @Test
    void multiSpellSumsAndKeepsEachSpell() {
        var r = row(home(ResultOutcomeType.DRAW, null), List.of(),
                List.of(bowl(18, 1, 20, 2, 5), bowl(12, 0, 15, 1, 3)), List.of(), List.of());
        var w = r.bowling();
        assertThat(w.spells()).hasSize(2);
        assertThat(w.balls()).isEqualTo(30L);
        assertThat(w.maidens()).isEqualTo(1L);
        assertThat(w.runs()).isEqualTo(35L);
        assertThat(w.wickets()).isEqualTo(3L);
        assertThat(w.dots()).isEqualTo(8L);
    }

    @Test
    void dotsAreNullWhenNoneRecordedAndSumOverRecordedOnly() {
        var none = row(home(ResultOutcomeType.WON, ResultSide.HOME), List.of(),
                List.of(bowl(12, 0, 10, 1, null)), List.of(), List.of());
        assertThat(none.bowling().dots()).isNull();
        var some = row(home(ResultOutcomeType.WON, ResultSide.HOME), List.of(),
                List.of(bowl(12, 0, 10, 1, null), bowl(6, 0, 4, 0, 2)), List.of(), List.of());
        assertThat(some.bowling().dots()).isEqualTo(2L);
    }

    @Test
    void anEmptyBowlingRowDoesNotAppearAsASpellButItsStoredFiguresStillSumWhenAnotherRowBowled() {
        var r = row(home(ResultOutcomeType.WON, ResultSide.HOME), List.of(),
                List.of(bowl(12, 0, 10, 1, null), bowl(0, 0, 0, 2, null)), List.of(), List.of());
        var w = r.bowling();
        assertThat(w.spells()).hasSize(1);
        assertThat(w.wickets()).isEqualTo(3L);
    }

    /**
     * PINS CURRENT BEHAVIOUR, suspected defect: a stored bowling row with 0 balls, 0 runs and wickets (e.g. a
     * run-out credit style row) that is the player's only bowling row yields DID_NOT_BOWL with no wickets shown, while
     * spec 103's aggregate sums those stored wickets. Parity with PlayerStatsDto would then differ.
     */
    @Test
    void currentBehaviourOnlyZeroBallZeroRunRowWithWicketsIsDidNotBowlAndHidesTheWickets() {
        var r = row(home(ResultOutcomeType.WON, ResultSide.HOME), List.of(),
                List.of(bowl(0, 0, 0, 2, null)), List.of(), List.of());
        assertThat(r.bowling().status()).isEqualTo(PlayerMatchBowlingStatus.DID_NOT_BOWL);
        assertThat(r.bowling().wickets()).isNull();
    }

    // ---- fielding ----

    @Test
    void noCardAtAllAndNoFieldingRowIsNoCard() {
        var f = bare(withCards(false, false)).fielding();
        assertThat(f.status()).isEqualTo(PlayerMatchFieldingStatus.NO_CARD);
        assertThat(f.catches()).isNull();
        assertThat(f.stumpings()).isNull();
        assertThat(f.runOuts()).isNull();
    }

    @Test
    void aBattingOnlyCardRecordsFieldingAsZeros() {
        var f = bare(withCards(true, false)).fielding();
        assertThat(f.status()).isEqualTo(PlayerMatchFieldingStatus.RECORDED);
        assertThat(f.catches()).isZero();
        assertThat(f.stumpings()).isZero();
        assertThat(f.runOuts()).isZero();
    }

    @Test
    void aBowlingOnlyCardRecordsFieldingToo() {
        assertThat(bare(withCards(false, true)).fielding().status()).isEqualTo(PlayerMatchFieldingStatus.RECORDED);
    }

    @Test
    void aFieldingRowIsNeverDroppedEvenWithNoCardFlag() {
        var r = row(withCards(false, false), List.of(), List.of(),
                List.of(new FieldingFact(RESULT, 2, 0, 1)), List.of());
        assertThat(r.fielding().status()).isEqualTo(PlayerMatchFieldingStatus.RECORDED);
        assertThat(r.fielding().catches()).isEqualTo(2L);
        assertThat(r.fielding().runOuts()).isEqualTo(1L);
    }

    @Test
    void fieldingCreditsAreSummedAcrossRows() {
        var r = row(home(ResultOutcomeType.WON, ResultSide.HOME), List.of(), List.of(),
                List.of(new FieldingFact(RESULT, 1, 1, 0), new FieldingFact(RESULT, 2, 0, 3)), List.of());
        assertThat(r.fielding().catches()).isEqualTo(3L);
        assertThat(r.fielding().stumpings()).isEqualTo(1L);
        assertThat(r.fielding().runOuts()).isEqualTo(3L);
    }

    @Test
    void aTeamListOnlyMatchIsNoCardOnAllThreeBlocks() {
        var r = bare(withCards(false, false));
        assertThat(r.batting().status()).isEqualTo(PlayerMatchBattingStatus.NO_CARD);
        assertThat(r.bowling().status()).isEqualTo(PlayerMatchBowlingStatus.NO_CARD);
        assertThat(r.fielding().status()).isEqualTo(PlayerMatchFieldingStatus.NO_CARD);
        assertThat(r.result()).isEqualTo(PlayerMatchResult.WON);
    }

    // ---- derby ----

    @Test
    void aDerbyPlayerOnBothSidesIsOneRowWithBothSidesFiguresCombined() {
        var h = header(ResultOutcomeType.WON, ResultSide.HOME, true, true, true, true, true);
        var r = row(h,
                List.of(bat(20, 15, 2, 0, DismissalType.BOWLED), bat(30, 25, 1, 1, DismissalType.NOT_OUT)),
                List.of(bowl(12, 1, 9, 1, 4), bowl(6, 0, 8, 0, 1)),
                List.of(new FieldingFact(RESULT, 1, 0, 0), new FieldingFact(RESULT, 0, 0, 1)),
                List.of(new AwardFact(RESULT, 0, 1), new AwardFact(RESULT, 0, 1)));
        assertThat(r.derby()).isTrue();
        assertThat(r.result()).isEqualTo(PlayerMatchResult.INTERNAL);
        assertThat(r.ourTeams()).extracting(t -> t.side()).containsExactly("HOME", "AWAY");
        assertThat(r.ourTeams()).extracting(t -> t.teamName()).containsExactly("Home XI", "Away XI");
        assertThat(r.opponentName()).isNull();
        assertThat(r.batting().runs()).isEqualTo(50L);
        assertThat(r.batting().inningsCount()).isEqualTo(2);
        assertThat(r.bowling().balls()).isEqualTo(18L);
        assertThat(r.bowling().wickets()).isEqualTo(1L);
        assertThat(r.fielding().catches()).isEqualTo(1L);
        assertThat(r.fielding().runOuts()).isEqualTo(1L);
        assertThat(r.awards().teamPlayerOfTheMatch()).isEqualTo(2);
    }

    @Test
    void aDerbyWithOnlyOneSideKeepsOneTeamAndNoOpponent() {
        var h = header(ResultOutcomeType.WON, ResultSide.HOME, true, false, true, true, true);
        var r = bare(h);
        assertThat(r.ourTeams()).extracting(t -> t.side()).containsExactly("AWAY");
        assertThat(r.opponentName()).isNull();
    }

    // ---- awards ----

    @Test
    void awardCountsAreSummedAndDefaultToZero() {
        var none = bare(home(ResultOutcomeType.WON, ResultSide.HOME)).awards();
        assertThat(none.playerOfTheMatch()).isZero();
        assertThat(none.teamPlayerOfTheMatch()).isZero();
        var one = row(home(ResultOutcomeType.WON, ResultSide.HOME), List.of(), List.of(), List.of(),
                List.of(new AwardFact(RESULT, 1, 1))).awards();
        assertThat(one.playerOfTheMatch()).isEqualTo(1);
        assertThat(one.teamPlayerOfTheMatch()).isEqualTo(1);
    }

    // ---- build(): ordering and grouping ----

    @Test
    void buildKeepsTheHeaderOrderAndAssignsFactsToTheirOwnMatch() {
        UUID r1 = UUID.randomUUID();
        UUID r2 = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        var h1 = headerFor(r1);
        var h2 = headerFor(r2);
        var rows = PlayerMatchRowBuilder.build(
                List.of(h2, h1),
                List.of(new BattingFact(r1, 10, 10, 1, 0, DismissalType.BOWLED),
                        new BattingFact(other, 99, 99, 9, 9, DismissalType.BOWLED)),
                List.of(), List.of(new FieldingFact(r2, 4, 0, 0)), List.of(new AwardFact(r1, 1, 0)));
        assertThat(rows).extracting(PlayerMatchRowDto::resultId).containsExactly(r2, r1);
        assertThat(rows.get(0).batting().status()).isEqualTo(PlayerMatchBattingStatus.DID_NOT_BAT);
        assertThat(rows.get(0).fielding().catches()).isEqualTo(4L);
        assertThat(rows.get(1).batting().runs()).isEqualTo(10L);
        assertThat(rows.get(1).awards().playerOfTheMatch()).isEqualTo(1);
    }

    private static MatchHeader headerFor(UUID resultId) {
        return new MatchHeader(resultId, UUID.randomUUID(), DATE, 6, ResultOutcomeType.WON, ResultSide.HOME, false,
                true, false, null, null, HOME_TEAM, "Home XI", AWAY_TEAM, "Away XI", "Opp", true, true);
    }

    // ---- parity-style ----

    @Test
    void summingManyBuiltRowsReproducesTheHandComputedTotals() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        UUID d = UUID.randomUUID();
        var headers = List.of(headerFor(a), headerFor(b), headerFor(c), headerFor(d));
        var batting = List.of(
                new BattingFact(a, 50, 40, 6, 1, DismissalType.CAUGHT),
                new BattingFact(b, 0, 3, 0, 0, DismissalType.BOWLED),
                new BattingFact(b, 22, null, null, null, DismissalType.NOT_OUT),
                new BattingFact(c, 8, 9, 1, 0, DismissalType.RUN_OUT));
        var bowling = List.of(
                new BowlingFact(a, 24, 1, 30, 2, 9, 1, 0),
                new BowlingFact(c, 18, 0, 25, 1, null, null, null),
                new BowlingFact(c, 6, 1, 2, 0, 3, null, null));
        var fielding = List.of(new FieldingFact(a, 2, 0, 0), new FieldingFact(c, 0, 1, 1));
        var awards = List.of(new AwardFact(a, 1, 0), new AwardFact(c, 0, 1));

        var rows = PlayerMatchRowBuilder.build(headers, batting, bowling, fielding, awards);

        long runs = rows.stream().filter(r -> r.batting().runs() != null).mapToLong(r -> r.batting().runs()).sum();
        long innings = rows.stream().filter(r -> r.batting().inningsCount() != null)
                .mapToLong(r -> r.batting().inningsCount()).sum();
        long balls = rows.stream().filter(r -> r.batting().ballsFaced() != null)
                .mapToLong(r -> r.batting().ballsFaced()).sum();
        long wickets = rows.stream().filter(r -> r.bowling().wickets() != null)
                .mapToLong(r -> r.bowling().wickets()).sum();
        long bowlBalls = rows.stream().filter(r -> r.bowling().balls() != null)
                .mapToLong(r -> r.bowling().balls()).sum();
        long dots = rows.stream().filter(r -> r.bowling().dots() != null).mapToLong(r -> r.bowling().dots()).sum();
        long catches = rows.stream().filter(r -> r.fielding().catches() != null)
                .mapToLong(r -> r.fielding().catches()).sum();
        long potm = rows.stream().mapToLong(r -> r.awards().playerOfTheMatch()).sum();
        long teamPotm = rows.stream().mapToLong(r -> r.awards().teamPlayerOfTheMatch()).sum();

        assertThat(runs).isEqualTo(80L);
        assertThat(innings).isEqualTo(4L);
        assertThat(balls).isEqualTo(52L); // 40 + 3 + 9, the unrecorded 22* skipped
        assertThat(wickets).isEqualTo(3L);
        assertThat(bowlBalls).isEqualTo(48L);
        assertThat(dots).isEqualTo(12L);
        assertThat(catches).isEqualTo(2L);
        assertThat(potm).isEqualTo(1L);
        assertThat(teamPotm).isEqualTo(1L);
        assertThat(rows.get(3).batting().status()).isEqualTo(PlayerMatchBattingStatus.DID_NOT_BAT);
    }
}
