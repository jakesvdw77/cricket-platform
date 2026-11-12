package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.PlayerStatsDto;
import com.cricketlegend.service.PlayerStatsService;
import com.cricketlegend.service.support.StatsScope;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;

/**
 * docs/specs/145 Test Plan, the Player Hub results routes ({@code /results}, {@code /results/summary}, {@code
 * /results/filters}, {@code /results/{matchId}}) through real HTTP against real Postgres: the access matrix, only
 * published results a manager switched on (Decisions 2 and 8), parity with the stats services (rows equal {@code
 * basis.matchesCounted}, tiles equal the 103 figures), the exact JSON keys of each DTO and that no result or profile id
 * leaks. Not transactional (the seed commits); see {@link AbstractHubStatsIntegrationTest}, which switches every seeded
 * result on whatever its status, so these tests prove the status gate and the flag gate separately.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MePlayersResultsIntegrationTest extends AbstractHubStatsIntegrationTest {

    @Autowired private PlayerStatsService playerStatsService;

    private Person bea;
    private String bobKey;

    @BeforeEach
    void fixture() {
        seedHubFixture(true);
        bea = newAccount("Bea", "Parent");
        bobKey = hold(bea, seed.bob).getId().toString();
    }

    // ---- helpers ----

    private JsonNode read(String k, String path, Person who) throws Exception {
        return json(mockMvc.perform(get(BASE + path, k).with(as(who))).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString());
    }

    private JsonNode read(String path) throws Exception {
        return read(key, path, parent);
    }

    private int statusOf(String url, Person who) throws Exception {
        return mockMvc.perform(get(url).with(as(who))).andReturn().getResponse().getStatus();
    }

    private static List<String> matchIds(JsonNode rows) {
        List<String> ids = new ArrayList<>();
        rows.forEach(r -> ids.add(r.get("matchId").asText()));
        return ids;
    }

    private List<String> listedMatchIds(String k, Person who) throws Exception {
        return matchIds(read(k, "/results?size=100", who).get("rows"));
    }

    /** The match of the one result in which this player's batting row scored exactly this. */
    private String matchOfBatterScore(UUID profileId, int runs) {
        List<UUID> ids = jdbc.queryForList("select distinct mr.match_id from batting_entry be"
                + " join match_innings mi on mi.id = be.match_innings_id"
                + " join match_result mr on mr.id = mi.match_result_id"
                + " join result_player rp on rp.id = be.result_player_id"
                + " where rp.player_profile_id = ? and be.runs = ?", UUID.class, profileId, runs);
        assertThat(ids).as("the result in which the player scored " + runs).hasSize(1);
        return ids.get(0).toString();
    }

    private void setFlag(String matchId, boolean visible) {
        assertThat(jdbc.update("update match_result set visible_to_players = ? where match_id = ?", visible,
                UUID.fromString(matchId))).isEqualTo(1);
    }

    private boolean flagOf(UUID matchId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "select visible_to_players from match_result where match_id = ?", Boolean.class, matchId));
    }

    private static Set<String> set(String... names) {
        return new TreeSet<>(List.of(names));
    }

    /** One of Alice's matches: the one she was player of the match in (batting, bowling, fielding and an award). */
    private String aliceBigMatch() throws Exception {
        for (JsonNode row : read("/results?size=100").get("rows")) {
            if (row.at("/awards/playerOfTheMatch").asInt() == 1) {
                return row.get("matchId").asText();
            }
        }
        throw new AssertionError("Alice has no player of the match result");
    }

    // ---- access matrix ----

    private List<String> routes(String k, String matchId) {
        return List.of(
                "/api/v1/me/players/" + k + "/results",
                "/api/v1/me/players/" + k + "/results/summary",
                "/api/v1/me/players/" + k + "/results/filters",
                "/api/v1/me/players/" + k + "/results/" + matchId);
    }

    private void expectEverywhere(String k, Person who, int expected) throws Exception {
        String match = aliceMatchId();
        for (String url : routes(k, match)) {
            int actual = statusOf(url, who);
            if (actual != expected) {
                throw new AssertionError(url + " answered " + actual + ", expected " + expected);
            }
        }
    }

    private String aliceMatchId;

    private String aliceMatchId() throws Exception {
        if (aliceMatchId == null) {
            aliceMatchId = aliceBigMatch();
        }
        return aliceMatchId;
    }

    @Test
    void theHeldPlayerReadsEveryRoute() throws Exception {
        expectEverywhere(key, parent, 200);
    }

    @Test
    void noLoginIsA401OnEveryRoute() throws Exception {
        for (String url : routes(key, aliceMatchId())) {
            mockMvc.perform(get(url)).andExpect(status().isUnauthorized());
        }
    }

    @Test
    void aKeyThatIsNotHeldMalformedOrFromAnotherAccountIs404OnEveryRoute() throws Exception {
        aliceMatchId(); // resolved while the real key still works
        Person stranger = newAccount("Sue", "Stranger");
        expectEverywhere(key, stranger, 404); // someone else's link id
        expectEverywhere("nonsense", parent, 404);
        expectEverywhere(UUID.randomUUID().toString(), parent, 404);
        expectEverywhere("self:" + UUID.randomUUID(), parent, 404);
        expectEverywhere("self:" + seed.alice.getId(), parent, 404);
        expectEverywhere(key, track(clubAdmin(seed.w.club())), 404); // a club manager holds no link to the player
    }

    @Test
    void aPlayerWhoHasDroppedOutOrARevokedLinkIs404() throws Exception {
        aliceMatchId();
        jdbc.update("update player_profile set active = false where id = ?", seed.alice.getId());
        expectEverywhere(key, parent, 404);
        jdbc.update("update player_profile set active = true where id = ?", seed.alice.getId());
        expectEverywhere(key, parent, 200);
        jdbc.update("update player_profile set verification_status = 'REJECTED' where id = ?", seed.alice.getId());
        expectEverywhere(key, parent, 404);
        jdbc.update("update player_profile set verification_status = 'VERIFIED' where id = ?", seed.alice.getId());
        jdbc.update("update person_link set status = 'REVOKED' where id = ?", link.getId());
        expectEverywhere(key, parent, 404);
    }

    @Test
    void aSuspendedCallerIs403OnEveryRoute() throws Exception {
        aliceMatchId();
        parent.setStatus(PersonStatus.SUSPENDED);
        personRepository.save(parent);
        expectEverywhere(key, parent, 403);
    }

    @Test
    void anotherClubsSeasonLeagueOrTeamIs404OnTheListAndTheSummary() throws Exception {
        UUID foreignSeason = seed.other.season().getId();
        UUID foreignTeam = seed.other.seniors1().getId();
        UUID foreignLeague = seed.fixtures.league(seed.other, 11).getId();
        for (String param : List.of("seasonId=" + foreignSeason, "leagueId=" + foreignLeague, "teamId=" + foreignTeam)) {
            for (String path : List.of("/results?", "/results/summary?")) {
                mockMvc.perform(get(BASE + path + param, key).with(as(parent))).andExpect(status().isNotFound());
            }
        }
    }

    @Test
    void anotherClubsMatchAndAnUnknownMatchAreNotFound() throws Exception {
        UUID foreign = jdbc.queryForObject(
                "select match_id from match_result where club_id = ?", UUID.class, seed.other.club().getId());
        mockMvc.perform(get(BASE + "/results/" + foreign, key).with(as(parent))).andExpect(status().isNotFound());
        mockMvc.perform(get(BASE + "/results/" + UUID.randomUUID(), key).with(as(parent))).andExpect(status().isNotFound());
        mockMvc.perform(get(BASE + "/results/not-a-uuid", key).with(as(parent))).andExpect(status().isBadRequest());
    }

    @Test
    void aMatchOfThisClubThatThePlayerDidNotPlayIsNotFound() throws Exception {
        // Bob's counted win is a result of the same club that Alice has no appearance in
        String bobsMatch = listedMatchIds(bobKey, bea).get(0);
        assertThat(listedMatchIds(key, parent)).doesNotContain(bobsMatch);
        mockMvc.perform(get(BASE + "/results/" + bobsMatch, key).with(as(parent))).andExpect(status().isNotFound());
        mockMvc.perform(get(BASE + "/results/" + bobsMatch, bobKey).with(as(bea))).andExpect(status().isOk());
    }

    @Test
    void aBadCompetitionIs400() throws Exception {
        for (String path : List.of("/results?competition=CUP", "/results/summary?competition=CUP")) {
            mockMvc.perform(get(BASE + path, key).with(as(parent))).andExpect(status().isBadRequest());
        }
        for (String path : List.of("/results?competition=LEAGUE", "/results?competition=FRIENDLY",
                "/results/summary?competition=LEAGUE", "/results/summary?competition=")) {
            mockMvc.perform(get(BASE + path, key).with(as(parent))).andExpect(status().isOk());
        }
    }

    @Test
    void aBadPageOrSizeIs400() throws Exception {
        for (String path : List.of("/results?page=-1", "/results?size=0", "/results?size=101")) {
            mockMvc.perform(get(BASE + path, key).with(as(parent))).andExpect(status().isBadRequest());
        }
    }

    // ---- only published results a manager switched on ----

    @Test
    void aPublishedResultSwitchedOffIsAbsentFromTheListTheSummaryTheFiltersAndTheResultPage() throws Exception {
        assertThat(read("/results?size=100").at("/page/totalElements").asLong()).isEqualTo(5);
        String hundred = matchOfBatterScore(seed.alice.getId(), 100); // her only result of the second season, a friendly
        assertThat(listedMatchIds(key, parent)).contains(hundred);
        mockMvc.perform(get(BASE + "/results/" + hundred, key).with(as(parent))).andExpect(status().isOk());
        assertThat(read("/results/filters").get("seasons").size()).isEqualTo(2);
        assertThat(read("/results/filters").get("combos").size()).isEqualTo(5);
        assertThat(read("/results/summary").get("runs").asLong()).isEqualTo(187);

        setFlag(hundred, false);

        JsonNode list = read("/results?size=100");
        assertThat(list.at("/page/totalElements").asLong()).isEqualTo(4);
        assertThat(matchIds(list.get("rows"))).doesNotContain(hundred).hasSize(4);
        JsonNode summary = read("/results/summary");
        assertThat(summary.get("matches").asLong()).isEqualTo(4);
        assertThat(summary.get("runs").asLong()).isEqualTo(87); // 187 less the 100 not out
        assertThat(summary.at("/highestScore/runs").asLong()).isEqualTo(50);
        assertThat(matchIds(summary.get("lastFive"))).doesNotContain(hundred).hasSize(4);
        JsonNode filters = read("/results/filters");
        assertThat(filters.get("seasons").size()).isEqualTo(1); // the second season had only that result
        assertThat(filters.get("combos").size()).isEqualTo(4);
        mockMvc.perform(get(BASE + "/results/" + hundred, key).with(as(parent))).andExpect(status().isNotFound());
        // the same result is just as gone when asked for under the hidden season
        mockMvc.perform(get(BASE + "/results?seasonId=" + seed.s2.getId(), key).with(as(parent))).andExpect(status().isOk());
        assertThat(read("/results?seasonId=" + seed.s2.getId()).get("rows").size()).isZero();

        setFlag(hundred, true);
        assertThat(read("/results?size=100").at("/page/totalElements").asLong()).isEqualTo(5);
    }

    @Test
    void aPlayerWithEveryResultSwitchedOffHasEmptyReadsNotAnError() throws Exception {
        String aliceMatch = aliceMatchId(); // resolved while results are still shown
        jdbc.update("update match_result set visible_to_players = false where club_id = ?", seed.w.club().getId());

        JsonNode list = read("/results");
        assertThat(list.get("rows").size()).isZero();
        assertThat(list.at("/page/totalElements").asLong()).isZero();
        JsonNode summary = read("/results/summary");
        assertThat(summary.get("matches").asLong()).isZero();
        assertThat(summary.get("runs").asLong()).isZero();
        assertThat(summary.get("lastFive").size()).isZero();
        assertThat(summary.get("highestScore").isNull()).isTrue();
        assertThat(summary.get("bestBowling").isNull()).isTrue();
        JsonNode filters = read("/results/filters");
        assertThat(filters.get("seasons").size()).isZero();
        assertThat(filters.get("teams").size()).isZero();
        assertThat(filters.get("leagues").size()).isZero();
        assertThat(filters.get("combos").size()).isZero();
        assertThat(filters.get("currentSeasonId").isNull()).isTrue();
        mockMvc.perform(get(BASE + "/results/" + aliceMatch, key).with(as(parent))).andExpect(status().isNotFound());
    }

    @Test
    void aDraftAndAnUnpublishedResultAreAbsentEvenWithTheFlagStillOn() throws Exception {
        // flagEveryResult switched every seeded result on, the Bob draft and the not yet unpublished one included
        String draft = seed.draftMatch.getId().toString();
        String toUnpublish = seed.unpublishMatch.getId().toString();
        assertThat(flagOf(seed.draftMatch.getId())).isTrue();
        assertThat(listedMatchIds(bobKey, bea)).doesNotContain(draft).contains(toUnpublish);
        mockMvc.perform(get(BASE + "/results/" + draft, bobKey).with(as(bea))).andExpect(status().isNotFound());
        mockMvc.perform(get(BASE + "/results/" + toUnpublish, bobKey).with(as(bea))).andExpect(status().isOk());

        seed.setStatus(seed.unpublishMatch, "DRAFT"); // status only: the flag is still true

        assertThat(listedMatchIds(bobKey, bea)).doesNotContain(draft, toUnpublish);
        assertThat(read(bobKey, "/results/summary", bea).get("runs").asLong()).isEqualTo(21);
        mockMvc.perform(get(BASE + "/results/" + toUnpublish, bobKey).with(as(bea))).andExpect(status().isNotFound());
        // and a draft of Alice's is a 404 even though it is flagged
        String aliceMatch = aliceMatchId();
        jdbc.update("update match_result set status = 'DRAFT' where match_id = ?", UUID.fromString(aliceMatch));
        mockMvc.perform(get(BASE + "/results/" + aliceMatch, key).with(as(parent))).andExpect(status().isNotFound());
        assertThat(listedMatchIds(key, parent)).doesNotContain(aliceMatch).hasSize(4);
    }

    @Test
    void unpublishingThroughTheManagerEndpointClearsTheFlagAndRemovesTheResultFromTheHub() throws Exception {
        UUID match = seed.unpublishMatch.getId();
        assertThat(listedMatchIds(bobKey, bea)).contains(match.toString());
        JwtRequestPostProcessor admin = seed.fixtures.clubAdmin(seed.w);

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/matches/{m}/result/unpublish", seed.w.club().getId(), match).with(admin))
                .andExpect(status().isOk());

        assertThat(flagOf(match)).isFalse();
        assertThat(jdbc.queryForObject("select visible_to_players_at is null and visible_to_players_by is null"
                + " from match_result where match_id = ?", Boolean.class, match)).isTrue();
        assertThat(listedMatchIds(bobKey, bea)).doesNotContain(match.toString());
        mockMvc.perform(get(BASE + "/results/" + match, bobKey).with(as(bea))).andExpect(status().isNotFound());
        assertThat(read(bobKey, "/results/summary", bea).get("runs").asLong()).isEqualTo(21);
    }

    @Test
    void switchingAResultOnThroughTheManagerEndpointPutsItBackInTheHub() throws Exception {
        String hundred = matchOfBatterScore(seed.alice.getId(), 100);
        setFlag(hundred, false);
        assertThat(listedMatchIds(key, parent)).doesNotContain(hundred);
        JwtRequestPostProcessor admin = seed.fixtures.clubAdmin(seed.w);

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/matches/{m}/result/player-visibility", seed.w.club().getId(),
                        UUID.fromString(hundred)).with(admin)).andExpect(status().isOk());

        assertThat(listedMatchIds(key, parent)).contains(hundred);
        mockMvc.perform(get(BASE + "/results/" + hundred, key).with(as(parent))).andExpect(status().isOk());
    }

    // ---- parity with the stats services ----

    private record Scope(UUID season, UUID league, UUID team, StatsScope.Competition competition) {
        String query() {
            List<String> parts = new ArrayList<>();
            if (season != null) {
                parts.add("seasonId=" + season);
            }
            if (league != null) {
                parts.add("leagueId=" + league);
            }
            if (team != null) {
                parts.add("teamId=" + team);
            }
            if (competition != null) {
                parts.add("competition=" + competition);
            }
            return String.join("&", parts);
        }
    }

    private List<Scope> scopes() {
        return List.of(
                new Scope(null, null, null, null),
                new Scope(seed.s1.getId(), null, null, null),
                new Scope(seed.s2.getId(), null, null, null),
                new Scope(null, seed.l1.getId(), null, null),
                new Scope(null, null, seed.w.seniors1().getId(), null),
                new Scope(null, null, null, StatsScope.Competition.LEAGUE),
                new Scope(null, null, null, StatsScope.Competition.FRIENDLY),
                new Scope(seed.s1.getId(), seed.l1.getId(), seed.w.seniors1().getId(), StatsScope.Competition.LEAGUE));
    }

    private void assertParity(String k, Person who, PlayerProfile player) throws Exception {
        for (Scope s : scopes()) {
            String q = s.query();
            JsonNode list = read(k, "/results?size=100" + (q.isEmpty() ? "" : "&" + q), who);
            JsonNode summary = read(k, "/results/summary" + (q.isEmpty() ? "" : "?" + q), who);
            PlayerStatsDto stats = playerStatsService.getForHeldPlayer(
                    seed.w.club().getId(), player.getId(), s.season(), s.league(), s.team(), s.competition());
            String label = player.getId() + " " + q;

            assertThat(list.at("/page/totalElements").asLong()).as("rows " + label).isEqualTo(stats.basis().matchesCounted());
            assertThat((long) list.get("rows").size()).as("page " + label).isEqualTo(stats.basis().matchesCounted());
            assertThat(summary.get("matches").asLong()).as("matches " + label).isEqualTo(stats.basis().matchesCounted());
            assertThat(summary.get("won").asLong()).as("won " + label).isEqualTo(stats.record().won());
            assertThat(summary.get("lost").asLong()).as("lost " + label).isEqualTo(stats.record().lost());
            assertThat(summary.get("tied").asLong()).as("tied " + label).isEqualTo(stats.record().tied());
            assertThat(summary.get("drawn").asLong()).as("drawn " + label).isEqualTo(stats.record().drawn());
            assertThat(summary.get("internal").asLong()).as("internal " + label).isEqualTo(stats.record().internal());
            assertThat(summary.get("runs").asLong()).as("runs " + label).isEqualTo(stats.batting().runs());
            assertThat(summary.get("wickets").asLong()).as("wickets " + label).isEqualTo(stats.bowling().wickets());
            assertThat(summary.get("catches").asLong()).as("catches " + label).isEqualTo(stats.fielding().catches());
            assertThat(summary.get("playerOfTheMatch").asLong()).as("potm " + label).isEqualTo(stats.awards().playerOfTheMatch());
            assertThat(summary.get("lastFive").size()).as("last five " + label)
                    .isEqualTo((int) Math.min(5, stats.basis().matchesCounted()));
            // the rows add up to the tiles (spec 115 parity, again through the Hub)
            long runs = 0;
            long wickets = 0;
            long catches = 0;
            for (JsonNode row : list.get("rows")) {
                runs += row.at("/batting/runs").asLong(0);
                wickets += row.at("/bowling/wickets").asLong(0);
                catches += row.at("/fielding/catches").asLong(0);
            }
            assertThat(runs).as("sum of runs " + label).isEqualTo(summary.get("runs").asLong());
            assertThat(wickets).as("sum of wickets " + label).isEqualTo(summary.get("wickets").asLong());
            assertThat(catches).as("sum of catches " + label).isEqualTo(summary.get("catches").asLong());
            // the scope is echoed
            assertThat(list.at("/scope/seasonId").asText("")).isEqualTo(s.season() == null ? "" : s.season().toString());
        }
    }

    @Test
    void theRowsEqualMatchesCountedAndTheTilesEqualTheStatsFiguresForEveryScope() throws Exception {
        assertParity(key, parent, seed.alice);
    }

    @Test
    void parityHoldsAfterAResultIsSwitchedOffAndForEveryKindOfPlayerInTheSeed() throws Exception {
        setFlag(matchOfBatterScore(seed.alice.getId(), 30), false);
        assertParity(key, parent, seed.alice);
        assertParity(bobKey, bea, seed.bob); // already held in the fixture
        for (PlayerProfile p : List.of(seed.cara, seed.dan, seed.eve, seed.hank, seed.ivy, seed.jill, seed.kim,
                seed.leo, seed.mona, seed.nina, seed.pia)) {
            Person holder = newAccount("Holder", p.getId().toString().substring(0, 8));
            assertParity(hold(holder, p).getId().toString(), holder, p);
        }
    }

    @Test
    void whenEveryResultIsSwitchedOnTheTilesEqualTheManagerFiguresAndSwitchingOneOffLowersThem() throws Exception {
        org.springframework.security.core.Authentication admin =
                new org.springframework.security.authentication.TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");
        PlayerStatsDto manager = playerStatsService.get(admin, seed.w.club().getId(), seed.alice.getId(), null, null, null, null, null);
        JsonNode summary = read("/results/summary");
        assertThat(summary.get("matches").asLong()).isEqualTo(manager.basis().matchesCounted());
        assertThat(summary.get("runs").asLong()).isEqualTo(manager.batting().runs()).isEqualTo(187);
        assertThat(summary.get("wickets").asLong()).isEqualTo(manager.bowling().wickets());

        setFlag(matchOfBatterScore(seed.alice.getId(), 50), false);
        PlayerStatsDto managerAfter = playerStatsService.get(admin, seed.w.club().getId(), seed.alice.getId(), null, null, null, null, null);
        assertThat(managerAfter.batting().runs()).as("managers still count it").isEqualTo(187);
        assertThat(read("/results/summary").get("runs").asLong()).isEqualTo(137);
    }

    @Test
    void theListIsNewestFirstAndPagesWithoutLosingOrRepeatingRows() throws Exception {
        JsonNode all = read("/results?size=100");
        List<String> dates = new ArrayList<>();
        all.get("rows").forEach(r -> dates.add(r.get("matchDate").asText()));
        assertThat(dates).isSortedAccordingTo(java.util.Comparator.reverseOrder());

        List<String> paged = new ArrayList<>();
        for (int page = 0; page < 3; page++) {
            JsonNode p = read("/results?size=2&page=" + page);
            paged.addAll(matchIds(p.get("rows")));
            assertThat(p.at("/page/hasMore").asBoolean()).isEqualTo(page < 2);
        }
        assertThat(paged).containsExactlyElementsOf(matchIds(all.get("rows")));
    }

    // ---- exact JSON keys ----

    private static final Set<String> ROW_KEYS = set("matchId", "matchDate", "ourTeams", "opponentName", "derby", "leagueId",
            "leagueName", "competition", "result", "homeName", "awayName", "homeScore", "awayScore", "resultLine",
            "ballsPerOver", "hasBattingCard", "hasBowlingCard", "batting", "bowling", "fielding", "awards");

    private void assertRowShape(JsonNode row) {
        assertThat(keys(row)).isEqualTo(ROW_KEYS);
        assertThat(keys(row.at("/ourTeams/0"))).isEqualTo(set("side", "teamId", "teamName"));
        assertThat(keys(row.get("batting"))).isEqualTo(set("status", "innings", "inningsCount", "runs", "ballsFaced", "fours", "sixes"));
        assertThat(keys(row.get("bowling"))).isEqualTo(set("status", "spells", "balls", "maidens", "runs", "wickets", "dots"));
        assertThat(keys(row.get("fielding"))).isEqualTo(set("status", "catches", "stumpings", "runOuts"));
        assertThat(keys(row.get("awards"))).isEqualTo(set("playerOfTheMatch", "teamPlayerOfTheMatch"));
    }

    @Test
    void theListHasExactlyTheDocumentedKeys() throws Exception {
        JsonNode list = read("/results?size=100");
        assertThat(keys(list)).isEqualTo(set("scope", "page", "rows"));
        assertThat(keys(list.get("scope"))).isEqualTo(set("seasonId", "teamId", "leagueId"));
        assertThat(keys(list.get("page"))).isEqualTo(set("number", "size", "totalElements", "hasMore"));
        for (JsonNode row : list.get("rows")) {
            assertRowShape(row);
        }
        JsonNode big = null;
        for (JsonNode row : list.get("rows")) {
            if (row.at("/awards/playerOfTheMatch").asInt() == 1) {
                big = row;
            }
        }
        assertThat(big).isNotNull();
        assertThat(keys(big.at("/batting/innings/0"))).isEqualTo(set("runs", "balls", "notOut", "howOut", "fours", "sixes"));
        assertThat(keys(big.at("/bowling/spells/0"))).isEqualTo(set("balls", "maidens", "runs", "wickets", "dots", "wides", "noBalls"));
        // words of the match header: both sides named, scores and the result line present for a captured result
        assertThat(big.get("homeName").asText()).isNotBlank();
        assertThat(big.get("awayName").asText()).isNotBlank();
        assertThat(big.get("resultLine").isNull()).isFalse();
    }

    @Test
    void theSummaryHasExactlyTheDocumentedKeys() throws Exception {
        JsonNode summary = read("/results/summary");
        assertThat(keys(summary)).isEqualTo(set("scope", "matches", "won", "lost", "tied", "drawn", "internal", "runs",
                "wickets", "catches", "playerOfTheMatch", "highestScore", "bestBowling", "lastFive"));
        assertThat(keys(summary.get("scope"))).isEqualTo(set("seasonId", "teamId", "leagueId"));
        assertThat(keys(summary.get("highestScore"))).isEqualTo(set("runs", "notOut"));
        assertThat(keys(summary.get("bestBowling"))).isEqualTo(set("wickets", "runs"));
        assertThat(summary.get("lastFive").size()).isEqualTo(5);
        for (JsonNode row : summary.get("lastFive")) {
            assertRowShape(row);
        }
    }

    @Test
    void theFiltersHaveExactlyTheDocumentedKeysIncludingTheCombos() throws Exception {
        JsonNode filters = read("/results/filters");
        assertThat(keys(filters)).isEqualTo(set("currentSeasonId", "seasons", "teams", "leagues", "combos"));
        assertThat(keys(filters.at("/seasons/0"))).isEqualTo(set("id", "name"));
        assertThat(keys(filters.at("/teams/0"))).isEqualTo(set("id", "name"));
        assertThat(keys(filters.at("/leagues/0"))).isEqualTo(set("id", "name"));
        assertThat(filters.get("combos").size()).isEqualTo(5);
        for (JsonNode combo : filters.get("combos")) {
            assertThat(keys(combo)).isEqualTo(set("seasonId", "leagueId", "teamId"));
        }
        assertThat(filters.get("seasons").size()).isEqualTo(2);
        assertThat(filters.get("currentSeasonId").isTextual()).isTrue();
        // a friendly is a combo with a null league
        boolean friendly = false;
        for (JsonNode combo : filters.get("combos")) {
            friendly |= combo.get("leagueId").isNull();
        }
        assertThat(friendly).isTrue();
    }

    @Test
    void theResultPageHasExactlyTheDocumentedKeysAndShowsEveryNameInFull() throws Exception {
        // a junior: the Hub scorecard shows names in full, the junior initials rule does not apply (Decision 7)
        jdbc.update("update person set date_of_birth = current_date - interval '12 years' where id = ?", seed.alice.getPersonId());
        String first = jdbc.queryForObject("select first_name from person where id = ?", String.class, seed.alice.getPersonId());
        String last = jdbc.queryForObject("select last_name from person where id = ?", String.class, seed.alice.getPersonId());

        JsonNode page = read("/results/" + aliceMatchId());

        assertThat(keys(page)).isEqualTo(set("mine", "venue", "innings", "awards"));
        assertRowShape(page.get("mine"));
        assertThat(page.at("/mine/matchId").asText()).isEqualTo(aliceMatchId());
        assertThat(page.get("innings").size()).isGreaterThanOrEqualTo(1);
        JsonNode innings = page.at("/innings/0");
        assertThat(keys(innings)).isEqualTo(set("sequence", "battingSide", "battingTeamName", "runs", "wickets", "overs",
                "extras", "wides", "noBalls", "byes", "legByes", "penaltyRuns", "batting", "didNotBat", "bowling"));
        assertThat(keys(innings.at("/batting/0"))).isEqualTo(set(
                "name", "mine", "position", "howOut", "bowler", "fielder", "runs", "balls", "fours", "sixes"));
        List<JsonNode> bowlers = new ArrayList<>();
        page.get("innings").forEach(i -> i.get("bowling").forEach(bowlers::add));
        assertThat(bowlers).isNotEmpty();
        assertThat(keys(bowlers.get(0))).isEqualTo(set(
                "name", "mine", "overs", "maidens", "runs", "wickets", "wides", "noBalls", "dots"));
        assertThat(page.get("awards").size()).isGreaterThanOrEqualTo(1);
        assertThat(keys(page.at("/awards/0"))).isEqualTo(set("type", "side", "playerName"));

        // Alice, a 12 year old here, is named in full and flagged as the held player; nobody is reduced to initials
        String full = first + " " + last;
        List<String> mineNames = new ArrayList<>();
        page.get("innings").forEach(i -> {
            i.get("batting").forEach(b -> {
                if (b.get("mine").asBoolean()) {
                    mineNames.add(b.get("name").asText());
                }
            });
            i.get("bowling").forEach(b -> {
                if (b.get("mine").asBoolean()) {
                    mineNames.add(b.get("name").asText());
                }
            });
        });
        assertThat(mineNames).isNotEmpty().allMatch(full::equals);
        assertThat(allTextValues(page)).contains(full);
        List<String> awardNames = new ArrayList<>();
        page.get("awards").forEach(a -> awardNames.add(a.get("playerName").asText()));
        assertThat(awardNames).contains(full);
        // the other side's players are named too, never as initials alone
        page.get("innings").forEach(i -> i.get("batting").forEach(b -> {
            assertThat(b.get("name").asText()).doesNotMatch("^[A-Z]\\.?( [A-Z]\\.?)*$");
            assertThat(b.get("name").asText()).contains(" ");
        }));
    }

    @Test
    void noResultIdProfileIdOrOtherInternalIdLeavesAnyPayload() throws Exception {
        List<JsonNode> payloads = new ArrayList<>();
        payloads.add(read("/results?size=100"));
        payloads.add(read("/results/summary"));
        payloads.add(read("/results/filters"));
        for (JsonNode row : read("/results?size=100").get("rows")) {
            payloads.add(read("/results/" + row.get("matchId").asText()));
        }
        Set<String> internal = internalIds();
        // the match ids, team ids, league ids and season ids are the ids the Hub does carry
        Set<String> allowedIds = new TreeSet<>();
        allowedIds.addAll(jdbc.queryForList("select id::text from match where club_id = ?", String.class, seed.w.club().getId()));
        allowedIds.addAll(jdbc.queryForList("select id::text from team where club_id = ?", String.class, seed.w.club().getId()));
        allowedIds.addAll(jdbc.queryForList("select id::text from league where club_id = ?", String.class, seed.w.club().getId()));
        allowedIds.addAll(jdbc.queryForList("select id::text from season where club_id = ?", String.class, seed.w.club().getId()));
        internal.removeAll(allowedIds);
        Set<String> forbiddenFields = set("resultId", "id", "playerId", "playerProfileId", "profileId", "personId", "clubId",
                "resultPlayerId", "entryId", "linkId", "accountPersonId", "email", "phone", "dateOfBirth", "medical");
        // "id" is an option id in the filters (a season, team or league id) and nowhere else
        Set<String> forbiddenOutsideFilters = set("id");
        for (int i = 0; i < payloads.size(); i++) {
            JsonNode payload = payloads.get(i);
            Set<String> fields = allFieldNames(payload);
            for (String bad : forbiddenFields) {
                if (bad.equals("id") && i == 2) {
                    continue;
                }
                assertThat(fields).as("payload " + i + " must not carry " + bad).doesNotContain(bad);
            }
            assertThat(allTextValues(payload)).as("payload " + i + " must carry no internal id")
                    .doesNotContainAnyElementsOf(internal);
        }
        assertThat(forbiddenOutsideFilters).containsExactly("id");
        assertThat(internal).as("the scan has ids to look for").isNotEmpty();
    }
}
