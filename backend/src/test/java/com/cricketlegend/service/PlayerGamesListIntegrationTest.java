package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Season;
import com.cricketlegend.dto.PlayerDto;
import com.cricketlegend.support.PlayerStatsSeed;
import com.cricketlegend.support.PlayerStatsSeed.Res;
import jakarta.persistence.EntityManagerFactory;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
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
 * docs/specs/088 (games columns of the Players list) with the counting rules of docs/specs/103 and 115, against real
 * Postgres and the real {@link PlayerService}: a match counts once per player, from a counted appearance on a published
 * result or, when the match has no published result, from a selection for a started active match. A deactivated match with a published result counts (103 decision 21). Every scenario has its
 * own player so the expected figure is hand-checkable. Not {@code @Transactional}; {@link PlayerStatsSeed} removes what it
 * seeds. The seed's own matches are dated 2031 (not started), so the scenarios here create their own past matches.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(AbstractIntegrationTest.class)
class PlayerGamesListIntegrationTest {

    @Autowired
    private PlayerService playerService;

    @Autowired
    private PlayerStatsService playerStatsService;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private JdbcTemplate jdbc;

    private final Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");
    private PlayerStatsSeed seed;
    private PlayerStatsSeed large;
    private UUID clubId;

    @BeforeEach
    void setUp() {
        seed = new PlayerStatsSeed(context);
        clubId = seed.w.club().getId();
    }

    @AfterEach
    void cleanUp() {
        seed.cleanUp();
        if (large != null) {
            large.cleanUp();
        }
    }

    // ---- helpers ----

    private Match past(int daysAgo) {
        return seed.fixtures.match(seed.w, seed.w.seniors1(), null, Instant.now().minus(Duration.ofDays(daysAgo)));
    }

    private Match inSeason(Match match, Season season) {
        jdbc.update("update match set season_id = ? where id = ?", season.getId(), match.getId());
        return match;
    }

    private PlayerProfile player(String name) {
        return seed.fixtures.player(seed.w, name, true);
    }

    private void select(Match match, PlayerProfile... players) {
        seed.fixtures.side(match, seed.w.seniors1(), false, players);
    }

    private Res result(Match match, PlayerProfile... onTheList) {
        Res res = seed.published(match, "WON", "HOME");
        for (PlayerProfile p : onTheList) {
            res.ours("HOME", p);
        }
        return res;
    }

    private Map<UUID, PlayerDto> list(UUID seasonId) {
        return playerService.list(admin, clubId, null, false, true, null, seasonId).stream()
                .collect(Collectors.toMap(PlayerDto::id, p -> p));
    }

    private int overall(PlayerProfile p) {
        return list(null).get(p.getId()).gamesOverall();
    }

    // ---- scenarios ----

    @Test
    void aSelectionOnlyPastMatchCountsOneAndAPublishedResultWithNoSelectionCountsOne() {
        PlayerProfile selected = player("Selected");
        PlayerProfile imported = player("Imported");
        select(past(5), selected);
        result(past(6), imported);

        assertThat(overall(selected)).isEqualTo(1);
        assertThat(overall(imported)).isEqualTo(1);
    }

    @Test
    void oneSelectedMatchPlusOneImportedResultIsTwoGames() {
        PlayerProfile anton = player("Anton");
        select(past(5), anton);
        result(past(9), anton);

        assertThat(overall(anton)).isEqualTo(2);
    }

    @Test
    void selectedAndOnThePublishedResultsTeamListCountsOnce() {
        PlayerProfile both = player("Both");
        Match match = past(4);
        select(match, both);
        result(match, both);

        assertThat(overall(both)).isEqualTo(1);
    }

    @Test
    void selectedForAMatchWithAPublishedResultButNotOnItsTeamListDoesNotCount() {
        PlayerProfile benched = player("Benched");
        PlayerProfile played = player("Played");
        Match match = past(4);
        select(match, benched, played);
        result(match, played);

        assertThat(overall(benched)).isZero();
        assertThat(overall(played)).isEqualTo(1);
    }

    @Test
    void aMatchWhoseResultIsNotPublishedCountsTheSelectionInsteadAndOnlyOnceEvenIfTheDraftListsThePlayer() {
        PlayerProfile drafted = player("Drafted");
        PlayerProfile unpublished = player("Unpublished");
        Match draftMatch = past(4);
        select(draftMatch, drafted);
        seed.result(draftMatch, "DRAFT", "WON", "HOME").ours("HOME", drafted);
        Match later = past(3);
        select(later, unpublished);
        result(later, unpublished);
        assertThat(overall(unpublished)).isEqualTo(1);
        seed.setStatus(later, "DRAFT");

        assertThat(overall(drafted)).isEqualTo(1);
        assertThat(overall(unpublished)).isEqualTo(1);
    }

    @Test
    void aDraftResultWithNoSelectionDoesNotCount() {
        PlayerProfile draftOnly = player("DraftOnly");
        seed.result(past(4), "DRAFT", "WON", "HOME").ours("HOME", draftOnly);

        assertThat(overall(draftOnly)).isZero();
    }

    @Test
    void aFutureMatchAndAnInactiveSelectionOnlyMatchNeverCountButAnInactiveMatchWithAResultDoes() {
        PlayerProfile p = player("Never");
        Match future = seed.fixtures.match(
                seed.w, seed.w.seniors1(), null, Instant.now().plus(Duration.ofDays(3)));
        Match inactive = seed.fixtures.match(
                seed.w, seed.w.seniors1(), null, Instant.now().minus(Duration.ofDays(3)), false, null);
        Match inactiveWithResult = seed.fixtures.match(
                seed.w, seed.w.seniors1(), null, Instant.now().minus(Duration.ofDays(8)), false, null);
        select(future, p);
        select(inactive, p);
        result(inactiveWithResult, p);

        // only the deactivated match with a published result counts (103 decision 21)
        assertThat(overall(p)).isEqualTo(1);
    }

    @Test
    void aMatchThatHasStartedCountsFromItsSelection() {
        PlayerProfile p = player("InProgress");
        select(seed.fixtures.match(seed.w, seed.w.seniors1(), null, Instant.now().minus(Duration.ofMinutes(30))), p);

        assertThat(overall(p)).isEqualTo(1);
    }

    @Test
    void aDerbyCountsOnceWhetherSelectedOnBothSidesOrOnBothSidesOfTheResult() {
        PlayerProfile selectedBoth = player("DerbySelected");
        PlayerProfile resultBoth = player("DerbyResult");
        Instant when = Instant.now().minus(Duration.ofDays(4));
        Match derbyA = seed.fixtures.match(seed.w, seed.w.seniors1(), seed.w.seniors2(), when);
        seed.fixtures.side(derbyA, seed.w.seniors1(), false, selectedBoth);
        seed.fixtures.side(derbyA, seed.w.seniors2(), false, selectedBoth);
        Match derbyB = seed.fixtures.match(seed.w, seed.w.seniors1(), seed.w.seniors2(), when.minus(Duration.ofDays(1)));
        Res res = seed.published(derbyB, "WON", "HOME");
        res.ours("HOME", resultBoth);
        res.ours("AWAY", resultBoth);

        assertThat(overall(selectedBoth)).isEqualTo(1);
        assertThat(overall(resultBoth)).isEqualTo(1);
    }

    @Test
    void theSeasonFilterLimitsBothTheSelectionsAndTheResults() {
        PlayerProfile p = player("TwoSeasons");
        select(past(10), p);                                   // s1, selection
        select(inSeason(past(9), seed.s2), p);                 // s2, selection
        result(inSeason(past(8), seed.s2), p);                 // s2, published result, no selection
        result(past(7), p);                                    // s1, published result
        PlayerProfile s1Only = player("SeasonOne");
        select(past(6), s1Only);

        Map<UUID, PlayerDto> thisSeasonOne = list(seed.s1.getId());
        Map<UUID, PlayerDto> thisSeasonTwo = list(seed.s2.getId());

        assertThat(thisSeasonOne.get(p.getId()).gamesOverall()).isEqualTo(4);
        assertThat(thisSeasonOne.get(p.getId()).gamesThisSeason()).isEqualTo(2);
        assertThat(thisSeasonTwo.get(p.getId()).gamesThisSeason()).isEqualTo(2);
        assertThat(thisSeasonTwo.get(p.getId()).gamesOverall()).isEqualTo(4);
        assertThat(thisSeasonOne.get(s1Only.getId()).gamesThisSeason()).isEqualTo(1);
        assertThat(thisSeasonTwo.get(s1Only.getId()).gamesThisSeason()).isZero();
        assertThat(list(null).get(p.getId()).gamesThisSeason()).isZero();
    }

    @Test
    void aSubstituteAnUnconfirmedImportGuessAndAResultThatIsNotPlayedFollowTheStatsPlayedRule() {
        PlayerProfile substitute = player("Substitute");
        PlayerProfile guessed = player("Guessed");
        PlayerProfile confirmed = player("Confirmed");
        PlayerProfile forfeited = player("Forfeited");
        PlayerProfile washedOut = player("WashedOut");

        Match subMatch = past(9);
        select(subMatch, substitute);                          // the result is the truth: a substitute is not a player
        seed.published(subMatch, "WON", "HOME").substitute("HOME", substitute);

        Match guessMatch = past(8);
        UUID guessRow = result(guessMatch, guessed).ours("HOME", confirmed);
        jdbc.update("update result_player set import_match = 'NORMALISED' where player_profile_id = ?", guessed.getId());

        Match forfeitMatch = past(7);
        select(forfeitMatch, forfeited);
        seed.published(forfeitMatch, "FORFEIT", "HOME").ours("HOME", forfeited);

        Match washMatch = past(6);
        select(washMatch, washedOut);
        Res wash = seed.published(washMatch, "ABANDONED", null);
        wash.inningsBalls(0, 0);
        wash.ours("HOME", washedOut);

        assertThat(guessRow).isNotNull();
        assertThat(overall(substitute)).isZero();
        assertThat(overall(guessed)).isZero();
        assertThat(overall(confirmed)).isEqualTo(1);
        assertThat(overall(forfeited)).isZero();
        assertThat(overall(washedOut)).isZero();

        // once the guess is confirmed (the flag cleared) the game counts
        jdbc.update("update result_player set import_match = null where player_profile_id = ?", guessed.getId());
        assertThat(overall(guessed)).isEqualTo(1);
    }

    @Test
    void anotherClubsGamesAreNeverCounted() {
        PlayerProfile mine = player("Mine");
        PlayerProfile theirs = seed.fixtures.player(seed.other, "Theirs", true);
        Match theirMatch = seed.fixtures.match(
                seed.other, seed.other.seniors1(), null, Instant.now().minus(Duration.ofDays(2)));
        seed.fixtures.side(theirMatch, seed.other.seniors1(), false, theirs);

        assertThat(list(null)).containsKey(mine.getId()).doesNotContainKey(theirs.getId());
        assertThat(list(null).get(mine.getId()).gamesOverall()).isZero();
    }

    // ---- parity with the statistics page ----

    @Test
    void forPlayersWithPublishedResultsTheListCountEqualsTheStatsPageMatchesFigure() {
        for (UUID season : new UUID[] {null, seed.s1.getId(), seed.s2.getId()}) {
            Map<UUID, PlayerDto> rows = list(season);
            for (PlayerProfile p : List.of(
                    seed.alice, seed.bob, seed.cara, seed.dan, seed.erin, seed.fay, seed.grace, seed.frank, seed.eve)) {
                long statsMatches = playerStatsService
                        .get(admin, clubId, p.getId(), season, null, null, null, null)
                        .basis().matchesCounted();
                PlayerDto row = rows.get(p.getId());
                int listed = season == null ? row.gamesOverall() : row.gamesThisSeason();
                assertThat(listed).as("%s, season %s", p.getId(), season).isEqualTo((int) statsMatches);
            }
        }
        // Eve has a deactivated match with a published result: counted on both (103 decision 21)
        assertThat(list(null).get(seed.eve.getId()).gamesOverall()).isEqualTo(3);
        // the seeded figures themselves: Alice's five, Bob's four, Dan's one derby
        Map<UUID, PlayerDto> all = list(null);
        assertThat(all.get(seed.alice.getId()).gamesOverall()).isEqualTo(5);
        assertThat(all.get(seed.bob.getId()).gamesOverall()).isEqualTo(4);
        assertThat(all.get(seed.dan.getId()).gamesOverall()).isEqualTo(1);
            }

    // ---- statement count ----

    private long statements(Supplier<Object> call) {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        assertThat(statistics.isStatisticsEnabled()).isTrue();
        statistics.clear();
        call.get();
        return statistics.getPrepareStatementCount();
    }

    @Test
    void theListIssuesTheSameNumberOfStatementsWhateverTheNumberOfPlayersAndMatches() {
        select(past(5), player("One"), player("Two"));
        large = new PlayerStatsSeed(context);
        large.addBulk(25);
        for (int i = 0; i < 10; i++) {
            large.fixtures.side(
                    large.fixtures.match(large.w, large.w.seniors1(), null, Instant.now().minus(Duration.ofDays(i + 1))),
                    large.w.seniors1(), false, large.fixtures.player(large.w, "Sel" + i, true));
        }
        UUID small = clubId;
        UUID big = large.w.club().getId();
        UUID bigSeason = large.s1.getId();

        assertThat(playerService.list(admin, big, null, false, true, null, bigSeason)).hasSizeGreaterThan(30);
        assertThat(statements(() -> playerService.list(admin, big, null, false, true, null, bigSeason)))
                .as("with a season")
                .isEqualTo(statements(() -> playerService.list(admin, small, null, false, true, null, seed.s1.getId())));
        assertThat(statements(() -> playerService.list(admin, big, null, false, true, null, null)))
                .as("without a season")
                .isEqualTo(statements(() -> playerService.list(admin, small, null, false, true, null, null)));
    }
}
