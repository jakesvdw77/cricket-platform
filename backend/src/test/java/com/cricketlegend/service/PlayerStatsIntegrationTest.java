package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.AwardsViewDto;
import com.cricketlegend.dto.AwardsViewDto.AwardsCategory;
import com.cricketlegend.dto.LeaderboardFilterOptionsDto;
import com.cricketlegend.dto.LeaderboardTableDto;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardTableRow;
import com.cricketlegend.dto.PlayerStatsDto;
import com.cricketlegend.dto.PlayerStatsFilterOptionsDto;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/103-player-stats.md, "Backend integration": the counting rules, the filters and the boards against real
 * Postgres and the real services. NOT {@code @Transactional} (the services run with their own transactions, as in
 * production with {@code open-in-view=false}); {@link PlayerStatsSeed} removes everything it seeds. See that class for
 * the scenario behind each player's expected figures.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class PlayerStatsIntegrationTest {

    @Autowired
    private PlayerStatsService playerStatsService;

    @Autowired
    private LeaderboardService leaderboardService;

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
        clubId = seed.w.club().getId();
    }

    @AfterEach
    void cleanUp() {
        seed.cleanUp();
    }

    // ---- helpers ----

    private PlayerStatsDto stats(PlayerProfile player) {
        return stats(admin, player, null, null, null, null, null);
    }

    private PlayerStatsDto stats(
            Authentication caller, PlayerProfile player, UUID season, UUID league, UUID team, UUID section,
            String competition) {
        return playerStatsService.get(caller, clubId, player.getId(), season, league, team, section, competition);
    }

    private LeaderboardTableDto table(String group, String sort) {
        return table(admin, group, sort, null, null, null, null, null);
    }

    private LeaderboardTableDto table(
            Authentication caller, String group, String sort, UUID season, UUID league, UUID team, UUID section,
            String minimum) {
        return leaderboardService.table(caller, clubId, group, sort, null, season, league, team, section, minimum, 0, 100);
    }

    private static List<String> names(LeaderboardTableDto table) {
        return table.rows().stream().map(LeaderboardTableRow::firstName).toList();
    }

    private static LeaderboardTableRow row(LeaderboardTableDto table, String firstName) {
        return table.rows().stream().filter(r -> firstName.equals(r.firstName())).findFirst()
                .orElseThrow(() -> new AssertionError(firstName + " is not on the board " + names(table)));
    }

    private static BigDecimal value(LeaderboardTableRow row, String column) {
        return row.values().get(column).value();
    }

    private Authentication sectionManager(com.cricketlegend.domain.Section section) {
        return new TestingAuthenticationToken(seed.fixtures.sectionManagerSubject(section), "n/a");
    }

    // ---- what counts ----

    @Test
    void aPlayersCareerCountsOnlyPublishedPlayedResultsOfTheirOwnRegisteredRows() {
        PlayerStatsDto alice = stats(seed.alice);

        assertThat(alice.basis().matchesCounted()).isEqualTo(5);
        assertThat(alice.basis().resultsWithBattingCard()).isEqualTo(5);
        assertThat(alice.basis().resultsWithBowlingCard()).isEqualTo(1);
        assertThat(alice.scope().kind()).isEqualTo("CLUB_VERIFIED");
        var bat = alice.batting();
        assertThat(bat.innings()).isEqualTo(5);
        assertThat(bat.notOuts()).isEqualTo(1);
        assertThat(bat.dismissals()).isEqualTo(4);
        assertThat(bat.runs()).isEqualTo(187);
        assertThat(bat.highestScore().runs()).isEqualTo(100);
        assertThat(bat.highestScore().notOut()).isTrue();
        assertThat(bat.ballsFaced()).isEqualTo(156);
        assertThat(bat.fours()).isEqualTo(19);
        assertThat(bat.sixes()).isEqualTo(3);
        assertThat(bat.ducks()).isEqualTo(1);
        assertThat(bat.goldenDucks()).isEqualTo(1);
        assertThat(bat.thirtyPlus()).isEqualTo(3);
        assertThat(bat.fiftyPlus()).isEqualTo(2);
        assertThat(bat.hundredPlus()).isEqualTo(1);
        assertThat(bat.centuries()).isEqualTo(1);
        assertThat(bat.halfCenturies()).isEqualTo(1);
        assertThat(bat.average()).isEqualByComparingTo("46.75");
        assertThat(bat.strikeRate()).isEqualByComparingTo("119.87");
        var bowl = alice.bowling();
        assertThat(bowl.inningsBowled()).isEqualTo(1);
        assertThat(bowl.ballsBowled()).isEqualTo(24);
        assertThat(bowl.runsConceded()).isEqualTo(20);
        assertThat(bowl.wickets()).isEqualTo(3);
        assertThat(bowl.threeWicketHauls()).isEqualTo(1);
        assertThat(bowl.dots()).isEqualTo(10);
        assertThat(bowl.wides()).isEqualTo(2);
        assertThat(bowl.best().wickets()).isEqualTo(3);
        assertThat(bowl.best().runs()).isEqualTo(20);
        assertThat(bowl.average()).isEqualByComparingTo("6.67");
        assertThat(bowl.economy()).isEqualByComparingTo("5.00");
        assertThat(bowl.strikeRate()).isEqualByComparingTo("8.0");
        assertThat(alice.fielding().catches()).isEqualTo(2);
        assertThat(alice.fielding().dismissals()).isEqualTo(2);
        assertThat(alice.fielding().dismissalsPerMatch()).isEqualByComparingTo("0.40");
        // the free-text team award to "Opp Star" counts for nobody; Alice's own two do
        assertThat(alice.awards().playerOfTheMatch()).isEqualTo(1);
        assertThat(alice.awards().teamPlayerOfTheMatch()).isEqualTo(1);
        assertThat(alice.record().won()).isEqualTo(3);
        assertThat(alice.record().tied()).isEqualTo(1);
        assertThat(alice.record().drawn()).isEqualTo(1);
        assertThat(alice.record().lost()).isZero();
        assertThat(alice.record().internal()).isZero();
    }

    @Test
    void aDraftAForfeitAndAMatchWithNoBallBowledNeverCountButPlayWithAnUndecidedOutcomeDoes() {
        // Bob: draft 200, forfeit 99, abandoned 40 and no-result 41 with no ball bowled are all absent.
        // Counted: the published win (77), a no-result with innings balls (10), an abandoned match whose only ball is a
        // bowling entry (6 balls, 4 runs), a plain win (11 not out). Decision 17.
        PlayerStatsDto bob = stats(seed.bob);

        assertThat(bob.basis().matchesCounted()).isEqualTo(4);
        assertThat(bob.batting().innings()).isEqualTo(3);
        assertThat(bob.batting().runs()).isEqualTo(98);
        assertThat(bob.batting().highestScore().runs()).isEqualTo(77);
        assertThat(bob.bowling().inningsBowled()).isEqualTo(1);
        assertThat(bob.bowling().ballsBowled()).isEqualTo(6);
        assertThat(bob.bowling().runsConceded()).isEqualTo(4);
        assertThat(bob.bowling().wickets()).isZero();
        // a no-result or abandoned match adds to none of won, lost, tied, drawn
        assertThat(bob.record().won()).isEqualTo(2);
        assertThat(bob.record().lost() + bob.record().tied() + bob.record().drawn() + bob.record().internal()).isZero();
    }

    @Test
    void aResultUnpublishedLaterDisappearsFromThePlayerPageAndTheBoards() {
        assertThat(stats(seed.bob).batting().runs()).isEqualTo(98);
        assertThat(value(row(table("batting", "runs"), "Bob"), "runs")).isEqualByComparingTo("98");
        long countedBefore = table("batting", "runs").basis().resultsCounted();

        seed.setStatus(seed.unpublishMatch, "DRAFT");

        PlayerStatsDto bob = stats(seed.bob);
        assertThat(bob.basis().matchesCounted()).isEqualTo(3);
        assertThat(bob.batting().runs()).isEqualTo(21);
        assertThat(bob.batting().innings()).isEqualTo(2);
        assertThat(bob.record().won()).isEqualTo(1);
        LeaderboardTableDto after = table("batting", "runs");
        assertThat(value(row(after, "Bob"), "runs")).isEqualByComparingTo("21");
        assertThat(after.basis().resultsCounted()).isEqualTo(countedBefore - 1);
    }

    @Test
    void aGuestLinkedAfterPublishingCountsOnTheNextRead() {
        // before: Frank has no appearance, so he is not on any board and the guest's 77 is nobody's
        assertThat(stats(seed.frank).basis().matchesCounted()).isZero();
        assertThat(names(table("batting", "runs"))).doesNotContain("Frank");
        long runsBefore = table("batting", "runs").rows().stream()
                .mapToLong(r -> value(r, "runs").longValue()).sum();

        jdbc.update("update result_player set player_profile_id = ?, display_name = null where id = ?",
                seed.frank.getId(), seed.garyRowResultPlayer);

        PlayerStatsDto frank = stats(seed.frank);
        assertThat(frank.basis().matchesCounted()).isEqualTo(1);
        assertThat(frank.batting().runs()).isEqualTo(77);
        LeaderboardTableDto after = table("batting", "runs");
        assertThat(value(row(after, "Frank"), "runs")).isEqualByComparingTo("77");
        assertThat(after.rows().stream().mapToLong(r -> value(r, "runs").longValue()).sum()).isEqualTo(runsBefore + 77);
    }

    @Test
    void aSubstituteAnOppositionRowAndAnUnlinkedGuestNeverCountButTheRegisteredPlayerOnTheSameResultDoes() {
        // Cara's 88 as a substitute, Gary's 77 as a guest and the opposition's 99 share a result with Grace's 15.
        assertThat(stats(seed.cara).batting().runs()).isEqualTo(30);
        assertThat(stats(seed.grace).batting().runs()).isEqualTo(15);
        assertThat(stats(seed.grace).basis().matchesCounted()).isEqualTo(1);
        LeaderboardTableDto board = table("batting", "runs");
        // nobody but Alice and Bob has an innings near 77 or more: the guest, substitute and opposition scores are absent
        assertThat(board.rows().stream().filter(r -> !List.of("Alice", "Bob").contains(r.firstName()))
                .mapToLong(r -> value(r, "runs").longValue()).max()).hasValue(45);
        assertThat(names(board)).doesNotContain("Gary", "Opp");
    }

    @Test
    void aResultWithATeamListAndNoCardsCountsAMatchButNoInnings() {
        // Eve: a team list only, a win with 20 (its super-over innings of 6 runs and 2 wickets is ignored) and a
        // deactivated match with 10 (decision 21). A summary-level result has no rows and adds nothing.
        PlayerStatsDto eve = stats(seed.eve);

        assertThat(eve.basis().matchesCounted()).isEqualTo(3);
        assertThat(eve.basis().resultsWithBattingCard()).isEqualTo(2);
        assertThat(eve.batting().innings()).isEqualTo(2);
        assertThat(eve.batting().runs()).isEqualTo(30);
        assertThat(eve.batting().sixes()).isZero();
        assertThat(eve.bowling().wickets()).isZero();
        assertThat(eve.bowling().ballsBowled()).isZero();
    }

    @Test
    void aDeactivatedMatchWithAPublishedResultStillCounts() {
        PlayerStatsDto before = stats(seed.eve);
        jdbc.update("update match set active = true where club_id = ?", clubId);
        PlayerStatsDto reactivated = stats(seed.eve);

        assertThat(before.batting().runs()).isEqualTo(30);
        assertThat(reactivated.basis()).isEqualTo(before.basis());
        assertThat(reactivated.batting().runs()).isEqualTo(before.batting().runs());
        jdbc.update("update match set active = false where club_id = ?", clubId);
        assertThat(stats(seed.eve).batting().runs()).isEqualTo(30);
    }

    @Test
    void aDerbyIsOneMatchInternalWithBothSidesRowsCountingInFull() {
        PlayerStatsDto dan = stats(seed.dan);

        assertThat(dan.basis().matchesCounted()).isEqualTo(1);
        assertThat(dan.batting().innings()).isEqualTo(2);
        assertThat(dan.batting().runs()).isEqualTo(45);
        assertThat(dan.bowling().wickets()).isEqualTo(3);
        assertThat(dan.bowling().ballsBowled()).isEqualTo(18);
        assertThat(dan.record().internal()).isEqualTo(1);
        assertThat(dan.record().won() + dan.record().lost()).isZero();
        // a Team filter takes only the row on that team's side
        PlayerStatsDto home = stats(admin, seed.dan, null, null, seed.w.seniors1().getId(), null, null);
        assertThat(home.batting().runs()).isEqualTo(40);
        assertThat(home.bowling().wickets()).isEqualTo(1);
        assertThat(home.basis().matchesCounted()).isEqualTo(1);
        PlayerStatsDto away = stats(admin, seed.dan, null, null, seed.w.seniors2().getId(), null, null);
        assertThat(away.batting().runs()).isEqualTo(5);
        assertThat(away.bowling().wickets()).isEqualTo(2);
        assertThat(away.basis().matchesCounted()).isEqualTo(1);
    }

    // ---- filters ----

    @Test
    void seasonLeagueCompetitionAndTeamFiltersNarrowEveryFigure() {
        PlayerProfile a = seed.alice;
        UUID s1 = seed.s1.getId();
        UUID s2 = seed.s2.getId();
        UUID l1 = seed.l1.getId();
        UUID l2 = seed.l2.getId();

        PlayerStatsDto inS1 = stats(admin, a, s1, null, null, null, null);
        assertThat(inS1.basis().matchesCounted()).isEqualTo(4);
        assertThat(inS1.batting().runs()).isEqualTo(87);
        PlayerStatsDto inS2 = stats(admin, a, s2, null, null, null, null);
        assertThat(inS2.basis().matchesCounted()).isEqualTo(1);
        assertThat(inS2.batting().runs()).isEqualTo(100);
        assertThat(stats(admin, a, null, l1, null, null, null).batting().runs()).isEqualTo(87);
        assertThat(stats(admin, a, null, l1, null, null, null).basis().matchesCounted()).isEqualTo(3);
        PlayerStatsDto inL2 = stats(admin, a, null, l2, null, null, null);
        assertThat(inL2.basis().matchesCounted()).isEqualTo(1);
        assertThat(inL2.batting().runs()).isZero();
        PlayerStatsDto friendly = stats(admin, a, null, null, null, null, "FRIENDLY");
        assertThat(friendly.basis().matchesCounted()).isEqualTo(1);
        assertThat(friendly.batting().runs()).isEqualTo(100);
        assertThat(friendly.scope().competition()).isEqualTo("FRIENDLY");
        PlayerStatsDto league = stats(admin, a, null, null, null, null, "LEAGUE");
        assertThat(league.basis().matchesCounted()).isEqualTo(4);
        assertThat(league.batting().runs()).isEqualTo(87);
        assertThat(stats(admin, a, null, null, seed.w.seniors1().getId(), null, null).batting().runs()).isEqualTo(50);
        assertThat(stats(admin, a, null, null, seed.w.seniors2().getId(), null, null).batting().runs()).isEqualTo(100);
        assertThat(stats(admin, a, null, null, seed.gcTeam.getId(), null, null).batting().runs()).isEqualTo(30);
    }

    @Test
    void aSectionFilterIncludesItsDescendantSectionsAndNotItsSiblings() {
        PlayerProfile a = seed.alice;
        // Seniors holds seniors1 (50, 0), seniors2 (100) and, two levels down in Seniors A1, gcTeam (30)
        PlayerStatsDto seniors = stats(admin, a, null, null, null, seed.w.seniors().getId(), null);
        assertThat(seniors.basis().matchesCounted()).isEqualTo(4);
        assertThat(seniors.batting().runs()).isEqualTo(180);
        // the grandchild's game shows under its parent and itself, never under the sibling Juniors
        assertThat(stats(admin, a, null, null, null, seed.seniorsA.getId(), null).batting().runs()).isEqualTo(30);
        assertThat(stats(admin, a, null, null, null, seed.seniorsA1.getId(), null).batting().runs()).isEqualTo(30);
        PlayerStatsDto juniors = stats(admin, a, null, null, null, seed.w.juniors().getId(), null);
        assertThat(juniors.basis().matchesCounted()).isEqualTo(1);
        assertThat(juniors.batting().runs()).isEqualTo(7);
    }

    @Test
    void combinedFiltersMustAllHoldAndAnInconsistentCombinationIsEmpty() {
        PlayerProfile a = seed.alice;
        PlayerStatsDto all = stats(admin, a, seed.s1.getId(), seed.l1.getId(), seed.w.seniors1().getId(),
                seed.w.seniors().getId(), "LEAGUE");
        assertThat(all.basis().matchesCounted()).isEqualTo(1);
        assertThat(all.batting().runs()).isEqualTo(50);

        // the team lies outside the section; the season has no league match; a league and "friendly" cannot both hold
        assertThat(stats(admin, a, null, null, seed.w.juniorsTeam().getId(), seed.w.seniors().getId(), null)
                .basis().matchesCounted()).isZero();
        assertThat(stats(admin, a, null, null, seed.w.seniors1().getId(), seed.seniorsA.getId(), null)
                .basis().matchesCounted()).isZero();
        assertThat(stats(admin, a, seed.s2.getId(), seed.l1.getId(), null, null, null).basis().matchesCounted()).isZero();
        assertThat(stats(admin, a, null, seed.l1.getId(), null, null, "FRIENDLY").basis().matchesCounted()).isZero();
        LeaderboardTableDto empty = table(admin, "batting", "runs", null, null, seed.w.juniorsTeam().getId(),
                seed.w.seniors().getId(), null);
        assertThat(empty.rows()).isEmpty();
        assertThat(empty.basis().playersListed()).isZero();
        assertThat(empty.basis().resultsCounted()).isZero();
    }

    @Test
    void aPlayerWhoMovedTeamsIsOnePlayerOnASeasonBoardAndOnlyTheTeamsGamesCountUnderATeamFilter() {
        LeaderboardTableDto season = table(admin, "batting", "runs", seed.s1.getId(), seed.l1.getId(), null, null, null);
        assertThat(names(season).stream().filter("Cara"::equals)).hasSize(1);
        assertThat(value(row(season, "Cara"), "runs")).isEqualByComparingTo("30");
        assertThat(value(row(season, "Cara"), "matches")).isEqualByComparingTo("2");

        LeaderboardTableDto first = table(admin, "batting", "runs", null, null, seed.w.seniors1().getId(), null, null);
        assertThat(value(row(first, "Cara"), "runs")).isEqualByComparingTo("10");
        assertThat(value(row(first, "Cara"), "matches")).isEqualByComparingTo("1");
        LeaderboardTableDto second = table(admin, "batting", "runs", null, null, seed.w.seniors2().getId(), null, null);
        assertThat(value(row(second, "Cara"), "runs")).isEqualByComparingTo("20");
        assertThat(stats(admin, seed.cara, null, null, seed.w.seniors1().getId(), null, null).batting().runs())
                .isEqualTo(10);
    }

    @Test
    void theBoardsHonourTheSectionFilterIncludingDescendantsAndTheSiblingSection() {
        LeaderboardTableDto seniors = table(admin, "batting", "runs", null, null, null, seed.w.seniors().getId(), null);
        assertThat(value(row(seniors, "Alice"), "runs")).isEqualByComparingTo("180");
        assertThat(names(seniors)).doesNotContain("Gina", "Frank");

        LeaderboardTableDto child = table(admin, "batting", "runs", null, null, null, seed.seniorsA.getId(), null);
        assertThat(names(child)).containsExactly("Alice");
        assertThat(value(child.rows().get(0), "runs")).isEqualByComparingTo("30");

        LeaderboardTableDto juniors = table(admin, "batting", "runs", null, null, null, seed.w.juniors().getId(), null);
        assertThat(names(juniors)).containsExactly("Alice");
        assertThat(value(juniors.rows().get(0), "runs")).isEqualByComparingTo("7");
    }

    // ---- boards ----

    @Test
    void theBattingTableRanksEveryoneWithEqualRanksForTiesAndIgnoresWhatDoesNotCount() {
        LeaderboardTableDto batting = table("batting", "runs");

        // 187, 98, 45, then Cara and Eve both on 30 runs, 2 innings and a best of 20, then 15, 12, 9
        assertThat(names(batting).subList(0, 3)).containsExactly("Alice", "Bob", "Dan");
        assertThat(batting.rows().stream().map(LeaderboardTableRow::rank).toList())
                .containsExactly(1, 2, 3, 4, 4, 6, 7, 8);
        assertThat(names(batting).subList(3, 5)).containsExactlyInAnyOrder("Cara", "Eve");
        assertThat(names(batting).subList(5, 8)).containsExactly("Grace", "Erin", "Fay");
        assertThat(batting.basis().playersListed()).isEqualTo(8);
        assertThat(batting.basis().resultsCounted()).isEqualTo(16);
        assertThat(batting.scope().kind()).isEqualTo("CLUB_VERIFIED");
        assertThat(batting.minimum().applies()).isFalse();
        assertThat(batting.page().totalElements()).isEqualTo(8);
        assertThat(batting.page().hasMore()).isFalse();
        // never a player of no appearance, never another club's player
        assertThat(names(batting)).doesNotContain("Gina", "Frank", "Xavier");
        assertThat(row(batting, "Alice").teamName()).isEqualTo(seed.w.seniors1().getName());
    }

    @Test
    void theBowlingTableOrdersByTheDirectionOfEachColumnAndPutsNoDefinedFigureLastUnranked() {
        LeaderboardTableDto byWickets = table("bowling", "wickets");
        assertThat(names(byWickets)).containsExactly("Alice", "Dan", "Bob"); // 3 for 20, 3 for 23, 0
        assertThat(byWickets.rows().stream().map(LeaderboardTableRow::rank).toList()).containsExactly(1, 2, 3);
        assertThat(value(row(byWickets, "Alice"), "overs")).isEqualByComparingTo("4.00");

        LeaderboardTableDto byEconomy = table("bowling", "economy"); // lower is better: 4.00, 5.00, 7.67
        assertThat(names(byEconomy)).containsExactly("Bob", "Alice", "Dan");
        assertThat(value(row(byEconomy, "Dan"), "economy")).isEqualByComparingTo("7.67");

        LeaderboardTableDto byAverage = table("bowling", "average"); // 6.67, 7.67, and Bob has no wicket
        assertThat(names(byAverage)).containsExactly("Alice", "Dan", "Bob");
        assertThat(row(byAverage, "Bob").rank()).isNull();
        assertThat(value(row(byAverage, "Bob"), "average")).isNull();
        assertThat(byAverage.basis().playersRanked()).isEqualTo(2);

        LeaderboardTableDto byStrikeRate = table("bowling", "strikeRate"); // 6.0 (Dan), 8.0 (Alice), none (Bob)
        assertThat(names(byStrikeRate)).containsExactly("Dan", "Alice", "Bob");
        assertThat(row(byStrikeRate, "Bob").rank()).isNull();
    }

    @Test
    void dotBallsAreAColumnAndABowlerWithNoRecordedDotsShowsADashAndSortsLastUnranked() {
        LeaderboardTableDto byDots = table("bowling", "dots");

        assertThat(byDots.rows().get(0).firstName()).isEqualTo("Alice");
        assertThat(byDots.rows().get(0).rank()).isEqualTo(1);
        assertThat(value(byDots.rows().get(0), "dots")).isEqualByComparingTo("10");
        for (String name : List.of("Dan", "Bob")) {
            assertThat(value(row(byDots, name), "dots")).as(name + " dots").isNull();
            assertThat(row(byDots, name).rank()).as(name + " rank").isNull();
        }
    }

    @Test
    void aBatterNeverDismissedHasNoAverageAndIsListedLastUnranked() {
        LeaderboardTableDto byAverage = table("batting", "average");

        assertThat(names(byAverage).get(0)).isEqualTo("Bob"); // 98 / 2 dismissals = 49.00 beats Alice's 46.75
        assertThat(value(byAverage.rows().get(0), "average")).isEqualByComparingTo("49.00");
        assertThat(value(row(byAverage, "Alice"), "average")).isEqualByComparingTo("46.75");
        LeaderboardTableRow erin = row(byAverage, "Erin"); // 12 not out, never dismissed
        assertThat(erin.rank()).isNull();
        assertThat(value(erin, "average")).isNull();
        assertThat(byAverage.rows().get(byAverage.rows().size() - 1).rank()).isNull();
        assertThat(byAverage.minimum().applies()).isTrue();
        assertThat(byAverage.minimum().value()).isNull(); // no minimum by default: everyone is listed
        assertThat(byAverage.basis().playersListed()).isEqualTo(8);
    }

    @Test
    void anOptionalMinimumRemovesThePlayersBelowItAndIsIgnoredOnAColumnThatIsNotARate() {
        LeaderboardTableDto atLeastTwo = table(admin, "batting", "average", null, null, null, null, "2");

        // 3 players (Erin, Fay, Grace) have one innings
        assertThat(names(atLeastTwo)).doesNotContain("Erin", "Fay", "Grace");
        assertThat(atLeastTwo.basis().belowMinimum()).isEqualTo(3);
        assertThat(atLeastTwo.minimum().value()).isEqualTo(2);
        assertThat(table(admin, "batting", "runs", null, null, null, null, "2").rows()).hasSize(8);
    }

    @Test
    void pagingIsDoneByTheServerWithStableOrderAndAPastTheEndPageIsEmpty() {
        LeaderboardTableDto full = table("batting", "runs");
        LeaderboardTableDto first = leaderboardService.table(
                admin, clubId, "batting", "runs", null, null, null, null, null, null, 0, 3);
        LeaderboardTableDto second = leaderboardService.table(
                admin, clubId, "batting", "runs", null, null, null, null, null, null, 1, 3);
        LeaderboardTableDto beyond = leaderboardService.table(
                admin, clubId, "batting", "runs", null, null, null, null, null, null, 9, 3);

        assertThat(first.rows()).hasSize(3);
        assertThat(first.page().hasMore()).isTrue();
        assertThat(first.page().totalElements()).isEqualTo(8);
        assertThat(second.rows()).hasSize(3);
        assertThat(names(first)).isEqualTo(names(full).subList(0, 3));
        assertThat(names(second)).isEqualTo(names(full).subList(3, 6));
        assertThat(second.rows().get(0).rank()).isEqualTo(4); // the tie at 4 spans the page boundary
        assertThat(second.rows().get(1).rank()).isEqualTo(4);
        assertThat(beyond.rows()).isEmpty();
        assertThat(beyond.page().hasMore()).isFalse();
    }

    @Test
    void theFieldingTableListsEveryoneWithAMatchAndRanksTheTotal() {
        LeaderboardTableDto fielding = table("fielding", null);

        assertThat(fielding.sort().code()).isEqualTo("total");
        assertThat(fielding.rows().get(0).firstName()).isEqualTo("Alice");
        assertThat(fielding.rows().get(0).rank()).isEqualTo(1);
        assertThat(value(fielding.rows().get(0), "catches")).isEqualByComparingTo("2");
        assertThat(fielding.basis().playersListed()).isEqualTo(8);
    }

    // ---- awards ----

    @Test
    void theAwardsViewUsesTheFilterAwareDefaultMinimumsAndOmitsACategoryNobodyQualifiesFor() {
        AwardsViewDto awards = leaderboardService.awards(admin, clubId, null, null, null, null, null, null);

        // the busiest player (Alice) played 5 matches: innings clamp(ceil(5/2),1,5) = 3, overs clamp(5,2,10) = 5
        assertThat(awards.minimums().defaultInnings()).isEqualTo(3);
        assertThat(awards.minimums().defaultOvers()).isEqualTo(5);
        assertThat(awards.minimums().innings()).isEqualTo(3);
        assertThat(awards.minimums().overs()).isEqualTo(5);
        assertThat(leader(awards, "MOST_RUNS")).isEqualTo("Alice");
        assertThat(leader(awards, "HIGHEST_SCORE")).isEqualTo("Alice");
        assertThat(leader(awards, "MOST_WICKETS")).isEqualTo("Alice");
        assertThat(leader(awards, "BEST_BOWLING")).isEqualTo("Alice");
        assertThat(leader(awards, "MOST_CATCHES")).isEqualTo("Alice");
        assertThat(leader(awards, "MOST_FIELDING_DISMISSALS")).isEqualTo("Alice");
        assertThat(leader(awards, "MOST_POTM")).isEqualTo("Alice");
        // three innings are needed: only Alice (46.75) and Bob (49.00) have them, so Bob leads the average
        assertThat(leader(awards, "BATTING_AVERAGE")).isEqualTo("Bob");
        // five overs are needed and nobody has bowled that many: economy is omitted, with a reason
        assertThat(awards.categories().stream().map(c -> c.board().code())).doesNotContain("ECONOMY_RATE");
        assertThat(awards.omitted()).anySatisfy(o -> {
            assertThat(o.board().code()).isEqualTo("ECONOMY_RATE");
            assertThat(o.reason()).isNotBlank();
        });
    }

    @Test
    void anExplicitAwardsMinimumOverridesTheDefault() {
        AwardsViewDto fourInnings = leaderboardService.awards(admin, clubId, null, null, null, null, "4", null);
        assertThat(fourInnings.minimums().innings()).isEqualTo(4);
        assertThat(fourInnings.minimums().defaultInnings()).isEqualTo(3);
        assertThat(leader(fourInnings, "BATTING_AVERAGE")).isEqualTo("Alice"); // only Alice has 4 innings or more

        AwardsViewDto nobodyHasSix = leaderboardService.awards(admin, clubId, null, null, null, null, "6", null);
        assertThat(nobodyHasSix.categories().stream().map(c -> c.board().code())).doesNotContain("BATTING_AVERAGE");
        assertThat(nobodyHasSix.omitted().stream().map(o -> o.board().code())).contains("BATTING_AVERAGE");

        AwardsViewDto oneOver = leaderboardService.awards(admin, clubId, null, null, null, null, null, "1");
        assertThat(oneOver.minimums().overs()).isEqualTo(1);
        assertThat(leader(oneOver, "ECONOMY_RATE")).isEqualTo("Bob"); // 4 runs from one over beats 5.00 and 7.67
    }

    private static String leader(AwardsViewDto awards, String boardCode) {
        AwardsCategory category = awards.categories().stream().filter(c -> boardCode.equals(c.board().code()))
                .findFirst().orElseThrow(() -> new AssertionError(boardCode + " is not a shown category"));
        assertThat(category.leaders()).isNotEmpty();
        assertThat(category.leaders()).allSatisfy(l -> assertThat(l.rank()).isEqualTo(1));
        return category.leaders().get(0).firstName();
    }

    // ---- filter options ----

    @Test
    void aPlayersFilterOptionsListOnlyValuesTheyHaveCountedDataFor() {
        PlayerStatsFilterOptionsDto alice =
                playerStatsService.filterOptions(admin, clubId, seed.alice.getId());
        assertThat(alice.seasonIds()).containsExactlyInAnyOrder(seed.s1.getId(), seed.s2.getId());
        assertThat(alice.leagueIds()).containsExactlyInAnyOrder(seed.l1.getId(), seed.l2.getId());
        assertThat(alice.teamIds()).containsExactlyInAnyOrder(seed.w.seniors1().getId(), seed.w.seniors2().getId(),
                seed.gcTeam.getId(), seed.w.juniorsTeam().getId());
        assertThat(alice.sectionIds()).containsExactlyInAnyOrder(seed.w.seniors().getId(), seed.seniorsA1.getId(),
                seed.w.juniors().getId());
        assertThat(alice.competitions()).containsExactlyInAnyOrder("LEAGUE", "FRIENDLY");

        PlayerStatsFilterOptionsDto bob = playerStatsService.filterOptions(admin, clubId, seed.bob.getId());
        assertThat(bob.seasonIds()).containsExactly(seed.s1.getId());
        assertThat(bob.leagueIds()).containsExactly(seed.l1.getId());
        assertThat(bob.teamIds()).containsExactly(seed.w.seniors1().getId());
        assertThat(bob.sectionIds()).containsExactly(seed.w.seniors().getId());
        assertThat(bob.competitions()).containsExactly("LEAGUE");

        PlayerStatsFilterOptionsDto gina = playerStatsService.filterOptions(admin, clubId, seed.gina.getId());
        assertThat(gina.seasonIds()).isEmpty();
        assertThat(gina.teamIds()).isEmpty();
    }

    @Test
    void theLeaderboardFilterOptionsAreTheClubsCountedValuesNarrowedForASectionScopedManager() {
        LeaderboardFilterOptionsDto club = leaderboardService.filterOptions(admin, clubId);
        assertThat(club.seasonIds()).containsExactlyInAnyOrder(seed.s1.getId(), seed.s2.getId());
        assertThat(club.leagueIds()).containsExactlyInAnyOrder(seed.l1.getId(), seed.l2.getId());
        assertThat(club.teamIds()).containsExactlyInAnyOrder(seed.w.seniors1().getId(), seed.w.seniors2().getId(),
                seed.gcTeam.getId(), seed.w.juniorsTeam().getId());
        assertThat(club.competitions()).containsExactlyInAnyOrder("LEAGUE", "FRIENDLY");

        LeaderboardFilterOptionsDto juniors =
                leaderboardService.filterOptions(sectionManager(seed.w.juniors()), clubId);
        assertThat(juniors.teamIds()).containsExactly(seed.w.juniorsTeam().getId());
        assertThat(juniors.sectionIds()).containsExactly(seed.w.juniors().getId());
        assertThat(juniors.seasonIds()).containsExactly(seed.s1.getId());
        assertThat(juniors.leagueIds()).containsExactly(seed.l1.getId());
        assertThat(juniors.competitions()).containsExactly("LEAGUE");
    }

    // ---- section-scoped manager ----

    @Test
    void aSectionScopedManagerIsNarrowedToTheirSectionsOnBoardsAndOnThePlayerPage() {
        Authentication juniors = sectionManager(seed.w.juniors());
        Authentication seniors = sectionManager(seed.w.seniors());

        LeaderboardTableDto juniorBoard = table(juniors, "batting", "runs", null, null, null, null, null);
        assertThat(names(juniorBoard)).containsExactly("Alice");
        assertThat(value(juniorBoard.rows().get(0), "runs")).isEqualByComparingTo("7");
        assertThat(stats(juniors, seed.alice, null, null, null, null, null).batting().runs()).isEqualTo(7);

        LeaderboardTableDto seniorBoard = table(seniors, "batting", "runs", null, null, null, null, null);
        assertThat(value(row(seniorBoard, "Alice"), "runs")).isEqualByComparingTo("180");
        assertThat(stats(seniors, seed.alice, null, null, null, null, null).batting().runs()).isEqualTo(180);
        assertThat(leaderboardService.awards(juniors, clubId, null, null, null, null, null, null).basis().resultsCounted())
                .isEqualTo(1);
    }

    // ---- tenancy ----

    @Test
    void anotherClubsResultsAreNeverCountedAndTheirPlayerIsOnlyOnTheirOwnBoard() {
        UUID otherClub = seed.other.club().getId();

        assertThat(names(table("batting", "runs"))).doesNotContain("Xavier");
        assertThat(table("batting", "runs").rows().stream().mapToLong(r -> value(r, "runs").longValue()).max())
                .hasValue(187);
        LeaderboardTableDto theirs = leaderboardService.table(
                admin, otherClub, "batting", "runs", null, null, null, null, null, null, 0, 100);
        assertThat(names(theirs)).containsExactly("Xavier");
        assertThat(value(theirs.rows().get(0), "runs")).isEqualByComparingTo("500");
        assertThat(theirs.basis().resultsCounted()).isEqualTo(1);
    }
}
