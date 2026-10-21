package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.PlayerMatchListDto;
import com.cricketlegend.dto.PlayerMatchRowDto;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBattingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchBowlingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchFieldingStatus;
import com.cricketlegend.dto.PlayerMatchRowDto.PlayerMatchResult;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.support.PlayerStatsSeed;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/115-player-match-list.md, "Backend integration": the counting rules, the row contents, every filter, the
 * ordering and paging, and tenancy, against real Postgres and the real service. NOT {@code @Transactional} (the service
 * runs with its own transaction, as in production with {@code open-in-view=false}). {@link PlayerStatsSeed} removes
 * everything it seeds; {@code seedMatchList()} adds the spec 115 players, see its comment for each scenario.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class PlayerMatchListIntegrationTest {

    @Autowired
    private PlayerMatchListService matchListService;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private JdbcTemplate jdbc;

    private PlayerStatsSeed seed;
    private UUID clubId;
    private final Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

    @BeforeEach
    void setUp() {
        seed = new PlayerStatsSeed(context);
        seed.seedMatchList();
        clubId = seed.w.club().getId();
    }

    @AfterEach
    void cleanUp() {
        seed.cleanUp();
    }

    // ---- helpers ----

    private PlayerMatchListDto list(
            PlayerProfile p, UUID season, UUID league, UUID team, UUID section, String competition, String direction,
            Integer page, Integer size) {
        return list(admin, p, season, league, team, section, competition, direction, page, size);
    }

    private PlayerMatchListDto list(
            Authentication caller, PlayerProfile p, UUID season, UUID league, UUID team, UUID section,
            String competition, String direction, Integer page, Integer size) {
        return matchListService.list(
                caller, clubId, p.getId(), season, league, team, section, competition, direction, page, size);
    }

    private List<PlayerMatchRowDto> rows(PlayerProfile p) {
        return list(p, null, null, null, null, null, null, 0, 100).rows();
    }

    private PlayerMatchListDto filtered(PlayerProfile p, UUID season, UUID league, UUID team, UUID section,
            String competition) {
        return list(p, season, league, team, section, competition, null, 0, 100);
    }

    private static List<PlayerMatchResult> results(List<PlayerMatchRowDto> rows) {
        return rows.stream().map(PlayerMatchRowDto::result).toList();
    }

    private static List<UUID> matchIds(List<PlayerMatchRowDto> rows) {
        return rows.stream().map(PlayerMatchRowDto::matchId).toList();
    }

    private Authentication sectionManager(com.cricketlegend.domain.Section section) {
        return new TestingAuthenticationToken(seed.fixtures.sectionManagerSubject(section), "n/a");
    }

    private List<PlayerProfile> everyone() {
        return List.of(seed.alice, seed.bob, seed.cara, seed.dan, seed.erin, seed.eve, seed.fay, seed.grace,
                seed.frank, seed.gina, seed.hank, seed.ivy, seed.jill, seed.kim, seed.leo, seed.mona, seed.nina,
                seed.pia);
    }

    // ---- what counts ----

    @Test
    void aFullyScoredCareerListsOneRowPerMatchNewestFirstWithThePlayersOwnFigures() {
        PlayerMatchListDto page = list(seed.alice, null, null, null, null, null, null, null, null);
        List<PlayerMatchRowDto> rows = page.rows();

        assertThat(page.playerId()).isEqualTo(seed.alice.getId());
        assertThat(page.scope().kind()).isEqualTo("CLUB_VERIFIED");
        assertThat(page.page().number()).isZero();
        assertThat(page.page().size()).as("default page size").isEqualTo(20);
        assertThat(page.page().totalElements()).isEqualTo(5);
        assertThat(page.page().hasMore()).isFalse();
        // created R1..R5, so newest first is R5 (juniors), R4 (grandchild), R3 (friendly), R2 (tie), R1
        assertThat(results(rows)).containsExactly(PlayerMatchResult.WON, PlayerMatchResult.WON, PlayerMatchResult.DRAWN,
                PlayerMatchResult.TIED, PlayerMatchResult.WON);
        assertThat(rows.stream().map(r -> r.ourTeams().get(0).teamName()).toList()).containsExactly(
                seed.w.juniorsTeam().getName(), seed.gcTeam.getName(), seed.w.seniors2().getName(),
                seed.w.seniors1().getName(), seed.w.seniors1().getName());
        assertThat(rows.stream().map(PlayerMatchRowDto::competition).toList())
                .containsExactly("LEAGUE", "LEAGUE", "FRIENDLY", "LEAGUE", "LEAGUE");
        assertThat(rows.get(2).leagueId()).isNull();
        assertThat(rows.get(2).leagueName()).isNull();
        assertThat(rows.get(4).leagueId()).isEqualTo(seed.l1.getId());
        assertThat(rows.get(4).leagueName()).isEqualTo(seed.l1.getName());
        assertThat(rows).allSatisfy(r -> {
            assertThat(r.derby()).isFalse();
            assertThat(r.ballsPerOver()).isEqualTo(6);
            assertThat(r.ourTeams()).hasSize(1);
            assertThat(r.ourTeams().get(0).side()).isEqualTo("HOME");
        });
        for (int i = 1; i < rows.size(); i++) {
            assertThat(rows.get(i - 1).matchDate()).isAfter(rows.get(i).matchDate());
        }

        PlayerMatchRowDto r1 = rows.get(4);
        assertThat(r1.matchId()).isNotNull();
        assertThat(r1.resultId()).isNotNull();
        assertThat(r1.hasBattingCard()).isTrue();
        assertThat(r1.hasBowlingCard()).isTrue();
        assertThat(r1.batting().status()).isEqualTo(PlayerMatchBattingStatus.BATTED);
        assertThat(r1.batting().runs()).isEqualTo(50);
        assertThat(r1.batting().ballsFaced()).isEqualTo(40);
        assertThat(r1.batting().fours()).isEqualTo(5);
        assertThat(r1.batting().sixes()).isEqualTo(1);
        assertThat(r1.batting().inningsCount()).isEqualTo(1);
        assertThat(r1.batting().innings().get(0).howOut()).isEqualTo(DismissalType.BOWLED);
        assertThat(r1.batting().innings().get(0).notOut()).isFalse();
        assertThat(r1.bowling().status()).isEqualTo(PlayerMatchBowlingStatus.BOWLED);
        assertThat(r1.bowling().balls()).isEqualTo(24);
        assertThat(r1.bowling().runs()).isEqualTo(20);
        assertThat(r1.bowling().wickets()).isEqualTo(3);
        assertThat(r1.bowling().dots()).isEqualTo(10);
        assertThat(r1.bowling().spells().get(0).wides()).isEqualTo(2);
        assertThat(r1.fielding().status()).isEqualTo(PlayerMatchFieldingStatus.RECORDED);
        assertThat(r1.fielding().catches()).isEqualTo(2);
        // the free-text team award to "Opp Star" counts for nobody
        assertThat(r1.awards().playerOfTheMatch()).isEqualTo(1);
        assertThat(r1.awards().teamPlayerOfTheMatch()).isZero();

        PlayerMatchRowDto r2 = rows.get(3); // golden duck, team player of the match, no bowling card
        assertThat(r2.batting().runs()).isZero();
        assertThat(r2.batting().ballsFaced()).isEqualTo(1);
        assertThat(r2.awards().teamPlayerOfTheMatch()).isEqualTo(1);
        assertThat(r2.hasBowlingCard()).isFalse();
        assertThat(r2.bowling().status()).isEqualTo(PlayerMatchBowlingStatus.NO_CARD);
        assertThat(r2.bowling().spells()).isNull();
        assertThat(r2.bowling().wickets()).as("a missing card is never a zero").isNull();

        PlayerMatchRowDto r3 = rows.get(2); // 100 not out
        assertThat(r3.batting().innings().get(0).notOut()).isTrue();
        assertThat(r3.batting().innings().get(0).howOut()).isEqualTo(DismissalType.NOT_OUT);
    }

    @Test
    void aDraftAForfeitAndAMatchWithNoBallBowledNeverAppearButPlayWithAnUndecidedOutcomeDoes() {
        List<PlayerMatchRowDto> rows = rows(seed.bob);

        // draft 200, forfeit 99, abandoned 40 and no-result 41 with no ball bowled are absent
        assertThat(rows).hasSize(4);
        assertThat(matchIds(rows)).doesNotContain(seed.draftMatch.getId());
        assertThat(results(rows)).containsExactly(PlayerMatchResult.WON, PlayerMatchResult.ABANDONED,
                PlayerMatchResult.NO_RESULT, PlayerMatchResult.WON);
        PlayerMatchRowDto abandoned = rows.get(1); // its only ball is a bowling entry (6 balls, 4 runs)
        assertThat(abandoned.batting().status()).isEqualTo(PlayerMatchBattingStatus.NO_CARD);
        assertThat(abandoned.bowling().status()).isEqualTo(PlayerMatchBowlingStatus.BOWLED);
        assertThat(abandoned.bowling().balls()).isEqualTo(6);
        assertThat(abandoned.bowling().runs()).isEqualTo(4);
        assertThat(abandoned.bowling().wickets()).isZero();
        PlayerMatchRowDto noResult = rows.get(2); // innings balls bowled
        assertThat(noResult.batting().runs()).isEqualTo(10);
        assertThat(noResult.bowling().status()).isEqualTo(PlayerMatchBowlingStatus.NO_CARD);
        assertThat(rows.stream().map(r -> r.batting().runs()).filter(java.util.Objects::nonNull))
                .containsExactlyInAnyOrder(11L, 10L, 77L);
    }

    @Test
    void anAbandonedAndANoResultMatchCountOnlyWithABallBowledAndAForfeitNever() {
        List<PlayerMatchRowDto> rows = rows(seed.leo);

        // L1 no-result with innings balls, L2 abandoned with a bowling entry; the no-ball no-result (3) and forfeit (50) are not
        assertThat(rows).hasSize(2);
        assertThat(results(rows)).containsExactly(PlayerMatchResult.ABANDONED, PlayerMatchResult.NO_RESULT);
        PlayerMatchRowDto abandoned = rows.get(0);
        assertThat(abandoned.batting().status()).isEqualTo(PlayerMatchBattingStatus.NO_CARD);
        assertThat(abandoned.bowling().status()).isEqualTo(PlayerMatchBowlingStatus.BOWLED);
        assertThat(abandoned.bowling().balls()).isEqualTo(12);
        assertThat(abandoned.bowling().maidens()).isEqualTo(1);
        assertThat(abandoned.bowling().wickets()).isEqualTo(1);
        assertThat(abandoned.fielding().status()).isEqualTo(PlayerMatchFieldingStatus.RECORDED);
        PlayerMatchRowDto noResult = rows.get(1);
        assertThat(noResult.batting().status()).isEqualTo(PlayerMatchBattingStatus.BATTED);
        assertThat(noResult.batting().runs()).isEqualTo(8);
        assertThat(noResult.bowling().status()).isEqualTo(PlayerMatchBowlingStatus.NO_CARD);
        assertThat(list(seed.leo, null, null, null, null, null, null, 0, 100).page().totalElements()).isEqualTo(2);
    }

    @Test
    void aResultUnpublishedLaterDisappearsOnTheNextRead() {
        assertThat(matchIds(rows(seed.bob))).contains(seed.unpublishMatch.getId());

        seed.setStatus(seed.unpublishMatch, "DRAFT");

        PlayerMatchListDto after = list(seed.bob, null, null, null, null, null, null, 0, 100);
        assertThat(after.page().totalElements()).isEqualTo(3);
        assertThat(matchIds(after.rows())).doesNotContain(seed.unpublishMatch.getId());
    }

    @Test
    void aGuestLinkedAfterPublishingAppearsOnTheNextReadAndNeverBeforeAndTheSharedMatchHoldsOnlyRegisteredPlayers() {
        assertThat(rows(seed.frank)).isEmpty();
        assertThat(list(seed.frank, null, null, null, null, null, null, 0, 20).page().totalElements()).isZero();

        jdbc.update("update result_player set player_profile_id = ?, display_name = null where id = ?",
                seed.frank.getId(), seed.garyRowResultPlayer);

        List<PlayerMatchRowDto> frank = rows(seed.frank);
        assertThat(frank).hasSize(1);
        assertThat(frank.get(0).matchId()).isEqualTo(seed.guestMatch.getId());
        assertThat(frank.get(0).batting().runs()).isEqualTo(77);

        // the substitute (Cara 88), the opposition (99) and the unlinked guest are never a row; Grace (15) is
        assertThat(matchIds(rows(seed.cara))).doesNotContain(seed.guestMatch.getId());
        List<PlayerMatchRowDto> grace = rows(seed.grace);
        assertThat(grace).hasSize(1);
        assertThat(grace.get(0).batting().runs()).isEqualTo(15);
        long onTheSharedMatch = everyone().stream()
                .flatMap(p -> rows(p).stream())
                .filter(r -> r.matchId().equals(seed.guestMatch.getId()))
                .count();
        assertThat(onTheSharedMatch).as("Grace and (now) Frank only").isEqualTo(2);
    }

    @Test
    void aTeamListWithNoScorecardIsARowWithAllThreeBlocksNoCardAndASummaryLevelResultIsNoRow() {
        List<PlayerMatchRowDto> eve = rows(seed.eve); // created: team list only, win with a super over, deactivated

        assertThat(eve).hasSize(3);
        PlayerMatchRowDto teamList = eve.get(2);
        assertThat(teamList.result()).isEqualTo(PlayerMatchResult.WON);
        assertThat(teamList.hasBattingCard()).isFalse();
        assertThat(teamList.hasBowlingCard()).isFalse();
        assertThat(teamList.batting().status()).isEqualTo(PlayerMatchBattingStatus.NO_CARD);
        assertThat(teamList.bowling().status()).isEqualTo(PlayerMatchBowlingStatus.NO_CARD);
        assertThat(teamList.fielding().status()).isEqualTo(PlayerMatchFieldingStatus.NO_CARD);
        assertThat(teamList.batting().runs()).isNull();
        assertThat(teamList.fielding().catches()).isNull();

        // no result_player row means no player can have the summary-level result
        Set<UUID> summaryLevel = new HashSet<>(jdbc.queryForList(
                "select r.id from match_result r where r.club_id = ? and not exists"
                        + " (select 1 from result_player rp where rp.match_result_id = r.id)",
                UUID.class, clubId));
        assertThat(summaryLevel).as("the seed has a summary-level result").isNotEmpty();
        everyone().forEach(p -> assertThat(rows(p).stream().map(PlayerMatchRowDto::resultId))
                .doesNotContainAnyElementsOf(summaryLevel));
    }

    @Test
    void aSuperOverInningsIsLeftOutAndADeactivatedMatchWithAPublishedResultStillAppears() {
        List<PlayerMatchRowDto> eve = rows(seed.eve);

        PlayerMatchRowDto superOver = eve.get(1);
        assertThat(superOver.batting().inningsCount()).as("the 6-run super-over innings is not an innings").isEqualTo(1);
        assertThat(superOver.batting().runs()).isEqualTo(20);
        assertThat(superOver.batting().sixes()).isZero();
        assertThat(superOver.bowling().status()).as("the super-over bowling row is not a card")
                .isEqualTo(PlayerMatchBowlingStatus.NO_CARD);
        assertThat(superOver.hasBowlingCard()).isFalse();
        assertThat(superOver.fielding().status()).isEqualTo(PlayerMatchFieldingStatus.RECORDED);

        UUID deactivated = jdbc.queryForObject(
                "select id from match where club_id = ? and active = false", UUID.class, clubId);
        PlayerMatchRowDto row = eve.get(0);
        assertThat(row.matchId()).isEqualTo(deactivated);
        assertThat(row.batting().runs()).isEqualTo(10);
    }

    @Test
    void aBattingCardWithNoBowlingCardAndACapturedCardWithNoRowForThePlayerReadNoCardAndDidNotPart() {
        List<PlayerMatchRowDto> hank = rows(seed.hank); // H4, H3, H2, H1

        assertThat(hank).hasSize(4);
        PlayerMatchRowDto h1 = hank.get(3); // 40 off 30 on a batting card with no bowling entry anywhere
        assertThat(h1.hasBattingCard()).isTrue();
        assertThat(h1.hasBowlingCard()).isFalse();
        assertThat(h1.batting().status()).isEqualTo(PlayerMatchBattingStatus.BATTED);
        assertThat(h1.bowling().status()).isEqualTo(PlayerMatchBowlingStatus.NO_CARD);
        assertThat(h1.fielding().status()).isEqualTo(PlayerMatchFieldingStatus.RECORDED);
        assertThat(h1.fielding().catches()).isZero();
        assertThat(h1.fielding().stumpings()).isZero();
        assertThat(h1.fielding().runOuts()).isZero();

        PlayerMatchRowDto h2 = hank.get(2); // on the list; Jill batted and bowled
        assertThat(h2.hasBattingCard()).isTrue();
        assertThat(h2.hasBowlingCard()).isTrue();
        assertThat(h2.batting().status()).isEqualTo(PlayerMatchBattingStatus.DID_NOT_BAT);
        assertThat(h2.batting().runs()).isNull();
        assertThat(h2.bowling().status()).isEqualTo(PlayerMatchBowlingStatus.DID_NOT_BOWL);
        assertThat(h2.bowling().wickets()).isNull();
        assertThat(h2.fielding().status()).isEqualTo(PlayerMatchFieldingStatus.RECORDED);
        assertThat(h2.fielding().catches()).isZero();
        assertThat(rows(seed.jill).get(0).batting().runs()).isEqualTo(25);
    }

    @Test
    void theResultIsFromThePlayersSideAndTheOpponentIsTheClubTeamNameBeforeAnyFreeText() {
        List<PlayerMatchRowDto> hank = rows(seed.hank);

        PlayerMatchRowDto lost = hank.get(1); // away side of a match won by HOME
        assertThat(lost.result()).isEqualTo(PlayerMatchResult.LOST);
        assertThat(lost.ourTeams()).hasSize(1);
        assertThat(lost.ourTeams().get(0).side()).isEqualTo("AWAY");
        assertThat(lost.ourTeams().get(0).teamName()).isEqualTo(seed.w.seniors2().getName());
        assertThat(lost.opponentName()).isEqualTo("Rivals CC");
        assertThat(lost.fielding().catches()).isEqualTo(1);

        PlayerMatchRowDto tied = hank.get(0);
        assertThat(tied.result()).isEqualTo(PlayerMatchResult.TIED);
        assertThat(tied.opponentName()).as("a club team opponent, by its team name").isEqualTo("Rivals CC");
        assertThat(tied.competition()).isEqualTo("FRIENDLY");
        assertThat(tied.leagueName()).isNull();
        assertThat(tied.batting().innings().get(0).notOut()).isTrue();

        // a free-text opposing side has no team
        assertThat(rows(seed.alice).get(4).opponentName()).isEqualTo("Occasionals");
        assertThat(hank.get(3).opponentName()).isEqualTo("Occasionals");
    }

    @Test
    void aMultiInningsDrawListsEveryRegularInningsAndSpellAndSumsThem() {
        List<PlayerMatchRowDto> ivy = rows(seed.ivy);

        assertThat(ivy).hasSize(1);
        PlayerMatchRowDto row = ivy.get(0);
        assertThat(row.result()).isEqualTo(PlayerMatchResult.DRAWN);
        assertThat(row.competition()).isEqualTo("FRIENDLY");
        assertThat(row.batting().inningsCount()).isEqualTo(2);
        assertThat(row.batting().innings()).hasSize(2);
        assertThat(row.batting().innings().get(0).runs()).isEqualTo(30);
        assertThat(row.batting().innings().get(0).notOut()).isFalse();
        assertThat(row.batting().innings().get(1).runs()).isEqualTo(15);
        assertThat(row.batting().innings().get(1).notOut()).isTrue();
        assertThat(row.batting().runs()).isEqualTo(45);
        assertThat(row.batting().ballsFaced()).isEqualTo(32);
        assertThat(row.batting().fours()).isEqualTo(4);
        assertThat(row.batting().sixes()).isZero();
        assertThat(row.bowling().spells()).hasSize(2);
        assertThat(row.bowling().spells().get(0).wickets()).isEqualTo(2);
        assertThat(row.bowling().spells().get(0).wides()).isEqualTo(1);
        assertThat(row.bowling().spells().get(1).dots()).as("a blank dots column stays blank").isNull();
        assertThat(row.bowling().balls()).isEqualTo(30);
        assertThat(row.bowling().maidens()).isEqualTo(1);
        assertThat(row.bowling().runs()).isEqualTo(34);
        assertThat(row.bowling().wickets()).isEqualTo(3);
        assertThat(row.bowling().dots()).as("only the recorded dots are summed").isEqualTo(5);
        assertThat(row.fielding().catches()).isEqualTo(3);
        assertThat(row.fielding().stumpings()).isEqualTo(1);
        assertThat(row.fielding().runOuts()).isZero();
    }

    @Test
    void anInningsWithZeroBallsAndRunsHasNoBallsAndBlankFoursAndSixesStayBlankNeverZero() {
        List<PlayerMatchRowDto> kim = rows(seed.kim); // K3, K2, K1

        assertThat(kim).hasSize(3);
        PlayerMatchRowDto k1 = kim.get(2); // 22 off a recorded 0 balls
        assertThat(k1.batting().runs()).isEqualTo(22);
        assertThat(k1.batting().innings().get(0).balls()).isNull();
        assertThat(k1.batting().ballsFaced()).isNull();
        assertThat(k1.batting().fours()).isEqualTo(3);
        assertThat(k1.batting().sixes()).isZero();

        PlayerMatchRowDto k2 = kim.get(1); // fours and sixes not recorded
        assertThat(k2.batting().runs()).isEqualTo(5);
        assertThat(k2.batting().innings().get(0).balls()).isEqualTo(8);
        assertThat(k2.batting().ballsFaced()).isEqualTo(8);
        assertThat(k2.batting().innings().get(0).fours()).isNull();
        assertThat(k2.batting().fours()).isNull();
        assertThat(k2.batting().sixes()).isNull();

        PlayerMatchRowDto k3 = kim.get(0); // a DID_NOT_BAT entry is a captured card with no innings
        assertThat(k3.hasBattingCard()).isTrue();
        assertThat(k3.batting().status()).isEqualTo(PlayerMatchBattingStatus.DID_NOT_BAT);
        assertThat(k3.bowling().status()).isEqualTo(PlayerMatchBowlingStatus.NO_CARD);
    }

    @Test
    void aBowlingRowWithZeroBallsAndZeroRunsButAWicketIsBowledWithNoSpell() {
        // owner decision 2026-10-21: any non-zero stored figure is BOWLED; no spell, but the sums carry the wicket
        List<PlayerMatchRowDto> mona = rows(seed.mona); // M2, M1

        PlayerMatchRowDto m1 = mona.get(1);
        assertThat(m1.hasBowlingCard()).isTrue();
        assertThat(m1.bowling().status()).isEqualTo(PlayerMatchBowlingStatus.BOWLED);
        assertThat(m1.bowling().spells()).isEmpty();
        assertThat(m1.bowling().wickets()).isEqualTo(1);
        assertThat(m1.batting().runs()).isEqualTo(10);

        PlayerMatchRowDto m2 = mona.get(0); // a bowling-only card
        assertThat(m2.batting().status()).isEqualTo(PlayerMatchBattingStatus.NO_CARD);
        assertThat(m2.bowling().status()).isEqualTo(PlayerMatchBowlingStatus.BOWLED);
        assertThat(m2.bowling().wickets()).isEqualTo(2);
        assertThat(m2.fielding().status()).isEqualTo(PlayerMatchFieldingStatus.RECORDED);
    }

    // ---- derby ----

    @Test
    void aDerbyIsOneInternalRowWithBothSidesFiguresCombinedAndAPlayerOnOneSideSeesThatSide() {
        List<PlayerMatchRowDto> dan = rows(seed.dan);

        assertThat(dan).hasSize(1);
        PlayerMatchRowDto row = dan.get(0);
        assertThat(row.derby()).isTrue();
        assertThat(row.result()).isEqualTo(PlayerMatchResult.INTERNAL);
        assertThat(row.opponentName()).isNull();
        assertThat(row.ourTeams().stream().map(t -> t.side()).toList()).containsExactly("HOME", "AWAY");
        assertThat(row.ourTeams().stream().map(t -> t.teamName()).toList())
                .containsExactly(seed.w.seniors1().getName(), seed.w.seniors2().getName());
        assertThat(row.batting().inningsCount()).isEqualTo(2);
        assertThat(row.batting().runs()).isEqualTo(45);
        assertThat(row.batting().ballsFaced()).isEqualTo(36);
        assertThat(row.batting().fours()).isEqualTo(4);
        assertThat(row.bowling().spells()).hasSize(2);
        assertThat(row.bowling().wickets()).isEqualTo(3);
        assertThat(row.bowling().balls()).isEqualTo(18);
        assertThat(row.bowling().runs()).isEqualTo(23);

        // the Team filter takes only that side's row, and the result stays Internal
        PlayerMatchRowDto home = filtered(seed.dan, null, null, seed.w.seniors1().getId(), null, null).rows().get(0);
        assertThat(home.result()).isEqualTo(PlayerMatchResult.INTERNAL);
        assertThat(home.batting().runs()).isEqualTo(40);
        assertThat(home.bowling().wickets()).isEqualTo(1);
        assertThat(home.ourTeams()).as("only the filtered side").hasSize(1);
        assertThat(home.ourTeams().get(0).side()).isEqualTo("HOME");
        PlayerMatchRowDto away = filtered(seed.dan, null, null, seed.w.seniors2().getId(), null, null).rows().get(0);
        assertThat(away.batting().runs()).isEqualTo(5);
        assertThat(away.bowling().wickets()).isEqualTo(2);
        assertThat(away.ourTeams()).hasSize(1);
        assertThat(away.ourTeams().get(0).side()).isEqualTo("AWAY");
        assertThat(filtered(seed.dan, null, null, seed.w.seniors1().getId(), null, null).page().totalElements())
                .isEqualTo(1);

        PlayerMatchRowDto erin = rows(seed.erin).get(0); // home side only
        assertThat(erin.result()).isEqualTo(PlayerMatchResult.INTERNAL);
        assertThat(erin.ourTeams()).hasSize(1);
        assertThat(erin.ourTeams().get(0).side()).isEqualTo("HOME");
        assertThat(erin.batting().runs()).isEqualTo(12);
        assertThat(erin.batting().innings().get(0).notOut()).isTrue();
        PlayerMatchRowDto fay = rows(seed.fay).get(0); // away side only
        assertThat(fay.ourTeams()).hasSize(1);
        assertThat(fay.ourTeams().get(0).side()).isEqualTo("AWAY");
        assertThat(fay.batting().runs()).isEqualTo(9);
    }

    @Test
    void aDerbyPlayerOnBothSidesCombinesFieldingAndCountsTheTeamAwardOfEachSide() {
        PlayerMatchRowDto pia = rows(seed.pia).get(0);

        assertThat(pia.result()).isEqualTo(PlayerMatchResult.INTERNAL);
        assertThat(pia.ourTeams()).hasSize(2);
        assertThat(pia.batting().runs()).isEqualTo(50);
        assertThat(pia.batting().sixes()).isEqualTo(1);
        assertThat(pia.fielding().catches()).isEqualTo(3);
        assertThat(pia.fielding().runOuts()).isEqualTo(1);
        assertThat(pia.awards().playerOfTheMatch()).isEqualTo(1);
        assertThat(pia.awards().teamPlayerOfTheMatch()).as("one team award on each side").isEqualTo(2);

        PlayerMatchRowDto homeOnly = filtered(seed.pia, null, null, seed.w.seniors2().getId(), null, null).rows().get(0);
        assertThat(homeOnly.batting().runs()).isEqualTo(20);
        assertThat(homeOnly.fielding().catches()).isEqualTo(1);
        assertThat(homeOnly.awards().teamPlayerOfTheMatch()).isEqualTo(1);
    }

    @Test
    void aPlayerWhoMovedTeamsHasARowForEachTeamAndOnlyThatTeamsRowsUnderATeamFilter() {
        List<PlayerMatchRowDto> cara = rows(seed.cara);

        assertThat(cara).hasSize(2);
        assertThat(cara.stream().map(r -> r.ourTeams().get(0).teamName()).toList())
                .containsExactly(seed.w.seniors2().getName(), seed.w.seniors1().getName());
        PlayerMatchListDto first = filtered(seed.cara, null, null, seed.w.seniors1().getId(), null, null);
        assertThat(first.rows()).hasSize(1);
        assertThat(first.rows().get(0).batting().runs()).isEqualTo(10);
        assertThat(first.page().totalElements()).isEqualTo(1);
        assertThat(filtered(seed.cara, null, null, seed.w.seniors2().getId(), null, null).rows().get(0).batting().runs())
                .isEqualTo(20);
    }

    // ---- filters ----

    @Test
    void seasonLeagueCompetitionAndTeamFiltersNarrowTheList() {
        PlayerProfile a = seed.alice;

        assertThat(filtered(a, seed.s1.getId(), null, null, null, null).page().totalElements()).isEqualTo(4);
        PlayerMatchListDto inS2 = filtered(a, seed.s2.getId(), null, null, null, null);
        assertThat(inS2.rows()).hasSize(1);
        assertThat(inS2.rows().get(0).result()).isEqualTo(PlayerMatchResult.DRAWN);
        assertThat(inS2.scope().seasonId()).isEqualTo(seed.s2.getId());
        assertThat(filtered(a, null, seed.l1.getId(), null, null, null).page().totalElements()).isEqualTo(3);
        PlayerMatchListDto inL2 = filtered(a, null, seed.l2.getId(), null, null, null);
        assertThat(inL2.rows()).hasSize(1);
        assertThat(inL2.rows().get(0).result()).isEqualTo(PlayerMatchResult.TIED);
        PlayerMatchListDto friendly = filtered(a, null, null, null, null, "FRIENDLY");
        assertThat(friendly.rows()).hasSize(1);
        assertThat(friendly.rows().get(0).competition()).isEqualTo("FRIENDLY");
        assertThat(friendly.scope().competition()).isEqualTo("FRIENDLY");
        assertThat(filtered(a, null, null, null, null, "LEAGUE").page().totalElements()).isEqualTo(4);
        assertThat(filtered(a, null, null, seed.w.seniors1().getId(), null, null).page().totalElements()).isEqualTo(2);
        assertThat(filtered(a, null, null, seed.w.seniors2().getId(), null, null).page().totalElements()).isEqualTo(1);
        assertThat(filtered(a, null, null, seed.gcTeam.getId(), null, null).page().totalElements()).isEqualTo(1);
    }

    @Test
    void aSectionFilterIncludesDescendantSectionsAndNotSiblings() {
        PlayerProfile a = seed.alice;

        assertThat(filtered(a, null, null, null, seed.w.seniors().getId(), null).page().totalElements()).isEqualTo(4);
        // the grandchild's match shows under its parent and itself, never under the sibling Juniors
        PlayerMatchListDto parent = filtered(a, null, null, null, seed.seniorsA.getId(), null);
        assertThat(parent.rows()).hasSize(1);
        assertThat(parent.rows().get(0).ourTeams().get(0).teamName()).isEqualTo(seed.gcTeam.getName());
        assertThat(filtered(a, null, null, null, seed.seniorsA1.getId(), null).page().totalElements()).isEqualTo(1);
        PlayerMatchListDto juniors = filtered(a, null, null, null, seed.w.juniors().getId(), null);
        assertThat(juniors.rows()).hasSize(1);
        assertThat(juniors.rows().get(0).batting().runs()).isEqualTo(7);
        assertThat(juniors.scope().sectionId()).isEqualTo(seed.w.juniors().getId());
    }

    @Test
    void combinedFiltersMustAllHoldAndAnInconsistentCombinationIsAnEmptyPage() {
        PlayerProfile a = seed.alice;

        PlayerMatchListDto all = filtered(a, seed.s1.getId(), seed.l1.getId(), seed.w.seniors1().getId(),
                seed.w.seniors().getId(), "LEAGUE");
        assertThat(all.rows()).hasSize(1);
        assertThat(all.rows().get(0).batting().runs()).isEqualTo(50);
        assertThat(all.page().totalElements()).isEqualTo(1);

        for (PlayerMatchListDto empty : List.of(
                filtered(a, null, null, seed.w.juniorsTeam().getId(), seed.w.seniors().getId(), null),
                filtered(a, null, null, seed.w.seniors1().getId(), seed.seniorsA.getId(), null),
                filtered(a, seed.s2.getId(), seed.l1.getId(), null, null, null),
                filtered(a, null, seed.l1.getId(), null, null, "FRIENDLY"))) {
            assertThat(empty.rows()).isEmpty();
            assertThat(empty.page().totalElements()).isZero();
            assertThat(empty.page().hasMore()).isFalse();
        }
    }

    @Test
    void aSectionScopedManagerIsNarrowedToTheirSectionsTeams() {
        Authentication juniors = sectionManager(seed.w.juniors());
        Authentication seniors = sectionManager(seed.w.seniors());

        PlayerMatchListDto juniorList = list(juniors, seed.alice, null, null, null, null, null, null, 0, 100);
        assertThat(juniorList.rows()).hasSize(1);
        assertThat(juniorList.rows().get(0).ourTeams().get(0).teamName()).isEqualTo(seed.w.juniorsTeam().getName());
        assertThat(juniorList.page().totalElements()).isEqualTo(1);
        assertThat(list(seniors, seed.alice, null, null, null, null, null, null, 0, 100).page().totalElements())
                .isEqualTo(4);
        // no match in reach is an empty page, not an error
        PlayerMatchListDto none = list(juniors, seed.cara, null, null, null, null, null, null, 0, 100);
        assertThat(none.rows()).isEmpty();
        assertThat(none.page().totalElements()).isZero();
    }

    // ---- ordering and paging ----

    private List<UUID> ninaDescending() {
        List<UUID> sameDay = seed.ninaMatches.subList(0, 3).stream().map(Match::getId)
                .sorted(Comparator.comparing(UUID::toString).reversed()).toList();
        List<UUID> expected = new ArrayList<>();
        expected.add(seed.ninaMatches.get(4).getId()); // the latest date
        expected.addAll(sameDay); // one date: match id descending
        expected.add(seed.ninaMatches.get(3).getId()); // the earliest date
        return expected;
    }

    @Test
    void sameDateMatchesAreOrderedByMatchIdDescendingAndDirectionAscReversesBoth() {
        List<PlayerMatchRowDto> desc = list(seed.nina, null, null, null, null, null, "desc", 0, 100).rows();
        List<PlayerMatchRowDto> asc = list(seed.nina, null, null, null, null, null, "asc", 0, 100).rows();

        assertThat(matchIds(desc)).containsExactlyElementsOf(ninaDescending());
        assertThat(desc.get(1).matchDate()).isEqualTo(Instant.parse("2031-12-01T10:00:00Z"));
        assertThat(desc.get(1).matchDate()).isEqualTo(desc.get(3).matchDate());
        assertThat(desc.get(0).matchDate()).isEqualTo(Instant.parse("2032-01-01T10:00:00Z"));
        assertThat(desc.get(4).matchDate()).isEqualTo(Instant.parse("2031-11-01T10:00:00Z"));
        List<UUID> reversed = new ArrayList<>(ninaDescending());
        java.util.Collections.reverse(reversed);
        assertThat(matchIds(asc)).containsExactlyElementsOf(reversed);
        // the default is newest first
        assertThat(matchIds(list(seed.nina, null, null, null, null, null, null, 0, 100).rows()))
                .isEqualTo(matchIds(desc));
    }

    @Test
    void pagingNeverRepeatsOrSkipsARowAcrossPagesEvenWhenSeveralMatchesShareADate() {
        for (String direction : new String[] {"desc", "asc"}) {
            List<UUID> seen = new ArrayList<>();
            for (int page = 0; page < 3; page++) {
                PlayerMatchListDto p = list(seed.nina, null, null, null, null, null, direction, page, 2);
                assertThat(p.page().number()).isEqualTo(page);
                assertThat(p.page().size()).isEqualTo(2);
                assertThat(p.page().totalElements()).as("total stable on page " + page).isEqualTo(5);
                assertThat(p.page().hasMore()).as("hasMore on page " + page).isEqualTo(page < 2);
                assertThat(p.rows()).hasSize(page < 2 ? 2 : 1);
                seen.addAll(matchIds(p.rows()));
            }
            List<UUID> expected = new ArrayList<>(ninaDescending());
            if ("asc".equals(direction)) {
                java.util.Collections.reverse(expected);
            }
            assertThat(seen).as("every page, direction " + direction).containsExactlyElementsOf(expected);
        }
    }

    @Test
    void aPagePastTheEndIsEmptyWithTheTrueTotalAndTheBoundarySizesAreAccepted() {
        PlayerMatchListDto beyond = list(seed.nina, null, null, null, null, null, null, 3, 2);
        assertThat(beyond.rows()).isEmpty();
        assertThat(beyond.page().totalElements()).isEqualTo(5);
        assertThat(beyond.page().hasMore()).isFalse();
        assertThat(list(seed.nina, null, null, null, null, null, null, 9, 2).rows()).isEmpty();

        PlayerMatchListDto one = list(seed.nina, null, null, null, null, null, null, 0, 1);
        assertThat(one.rows()).hasSize(1);
        assertThat(one.page().hasMore()).isTrue();
        assertThat(list(seed.nina, null, null, null, null, null, null, 0, 100).page().size()).isEqualTo(100);
        assertThat(list(seed.nina, null, null, null, null, null, null, 0, 5).page().hasMore())
                .as("the last row exactly fills the page").isFalse();
    }

    @Test
    void aPlayerWithNoAppearanceGetsAnEmptyPageNotAnError() {
        PlayerMatchListDto gina = list(seed.gina, null, null, null, null, null, null, null, null);

        assertThat(gina.rows()).isEmpty();
        assertThat(gina.page().totalElements()).isZero();
        assertThat(gina.page().hasMore()).isFalse();
        assertThat(gina.playerId()).isEqualTo(seed.gina.getId());
    }

    @Test
    void badPagingDirectionAndCompetitionAreValidationErrors() {
        PlayerProfile a = seed.alice;
        assertThatThrownBy(() -> list(a, null, null, null, null, null, null, -1, 20))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> list(a, null, null, null, null, null, null, 0, 0))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> list(a, null, null, null, null, null, null, 0, 101))
                .as("a size above the cap is refused, not clamped").isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> list(a, null, null, null, null, null, "up", 0, 20))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> list(a, null, null, null, null, "MIXED", null, 0, 20))
                .isInstanceOf(ValidationException.class);
    }

    // ---- tenancy ----

    @Test
    void anotherClubsPlayerSeasonLeagueTeamOrSectionIsNotFoundAndTheirDataNeverAppears() {
        UUID otherLeague = seed.fixtures.league(seed.other, 11).getId();

        assertThatThrownBy(() -> list(seed.xavier, null, null, null, null, null, null, 0, 20))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> matchListService.list(admin, clubId, UUID.randomUUID(), null, null, null, null, null,
                null, 0, 20)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> filtered(seed.alice, seed.other.season().getId(), null, null, null, null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> filtered(seed.alice, null, otherLeague, null, null, null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> filtered(seed.alice, null, null, seed.other.seniors1().getId(), null, null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> filtered(seed.alice, null, null, null, seed.other.seniors().getId(), null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> filtered(seed.alice, UUID.randomUUID(), null, null, null, null))
                .isInstanceOf(NotFoundException.class);

        // Xavier's 500 exists, in his own club, and in no list of this one
        PlayerMatchListDto theirs = matchListService.list(admin, seed.other.club().getId(), seed.xavier.getId(), null,
                null, null, null, null, null, 0, 20);
        assertThat(theirs.rows()).hasSize(1);
        assertThat(theirs.rows().get(0).batting().runs()).isEqualTo(500);
        List<UUID> theirMatches = matchIds(theirs.rows());
        everyone().forEach(p -> assertThat(matchIds(rows(p))).doesNotContainAnyElementsOf(theirMatches));
        // and this club's player is not found in the other club
        assertThatThrownBy(() -> matchListService.list(admin, seed.other.club().getId(), seed.alice.getId(), null, null,
                null, null, null, null, 0, 20)).isInstanceOf(NotFoundException.class);
    }
}
