package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.support.PlayerStatsSeed;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * docs/specs/103-player-stats.md, "Controller (tenancy and access)": the statistics, leaderboard and leaderboard-settings
 * routes through real HTTP against real Postgres. Not {@code @Transactional} (so a service missing its own transaction
 * would fail here); {@link PlayerStatsSeed} removes what it seeds. The figures themselves are checked in {@code
 * PlayerStatsIntegrationTest}; this class is about who may call, what is refused, and routing.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class PlayerStatsControllerIntegrationTest {

    private static final String BASE = "/api/v1/manage/clubs/{clubId}";
    private static final String SETTINGS = BASE + "/leaderboard-settings";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbc;

    private PlayerStatsSeed seed;
    private UUID clubId;
    private JwtRequestPostProcessor admin;
    private JwtRequestPostProcessor stranger;

    @BeforeEach
    void setUp() {
        seed = new PlayerStatsSeed(context);
        clubId = seed.w.club().getId();
        admin = seed.fixtures.clubAdmin(seed.w);
        stranger = seed.fixtures.clubAdmin(seed.other);
    }

    @AfterEach
    void cleanUp() {
        seed.cleanUp();
    }

    private ResultActions getAs(JwtRequestPostProcessor caller, String path, Object... params) throws Exception {
        return mockMvc.perform(get(path, clubId).with(caller).params(query(params)));
    }

    private static org.springframework.util.LinkedMultiValueMap<String, String> query(Object... pairs) {
        var map = new org.springframework.util.LinkedMultiValueMap<String, String>();
        for (int i = 0; i < pairs.length; i += 2) {
            map.add(pairs[i].toString(), pairs[i + 1].toString());
        }
        return map;
    }

    private JsonNode json(ResultActions actions) throws Exception {
        return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private String playerStatsPath(UUID playerId) {
        return BASE + "/players/" + playerId + "/stats";
    }

    private static List<String> firstNames(JsonNode table) {
        List<String> names = new ArrayList<>();
        table.path("rows").forEach(r -> names.add(r.path("firstName").asText()));
        return names;
    }

    // ---- access ----

    @Test
    void everyRouteRequiresAManagerOfTheClubAndRefusesAnotherClubsAdminAndSomeoneWithNoRole() throws Exception {
        JwtRequestPostProcessor nobody = seed.fixtures.nobody();
        List<String> paths = List.of(
                playerStatsPath(seed.alice.getId()),
                playerStatsPath(seed.alice.getId()) + "/filter-options",
                playerStatsPath(seed.alice.getId()) + "/matches",
                BASE + "/leaderboards",
                BASE + "/leaderboards/batting",
                BASE + "/leaderboards/bowling",
                BASE + "/leaderboards/fielding",
                BASE + "/leaderboards/awards",
                BASE + "/leaderboards/filter-options",
                SETTINGS);

        for (String path : paths) {
            getAs(admin, path).andExpect(status().isOk());
            getAs(stranger, path).andExpect(status().isForbidden());
            getAs(nobody, path).andExpect(status().isForbidden());
            mockMvc.perform(get(path, clubId)).andExpect(status().isUnauthorized());
        }
        mockMvc.perform(put(SETTINGS, clubId).with(stranger).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"awardCategories\":[\"MOST_RUNS\"]}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(put(SETTINGS, clubId).with(nobody).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"awardCategories\":[\"MOST_RUNS\"]}"))
                .andExpect(status().isForbidden());
    }

    // ---- 404 ----

    @Test
    void anUnknownOrOtherClubsPlayerSeasonLeagueTeamOrSectionIsNotFound() throws Exception {
        getAs(admin, playerStatsPath(UUID.randomUUID())).andExpect(status().isNotFound());
        getAs(admin, playerStatsPath(seed.xavier.getId())).andExpect(status().isNotFound());
        getAs(admin, playerStatsPath(UUID.randomUUID()) + "/filter-options").andExpect(status().isNotFound());
        getAs(admin, playerStatsPath(seed.xavier.getId()) + "/filter-options").andExpect(status().isNotFound());

        List<String[]> unknown = List.of(
                new String[] {"seasonId", seed.other.season().getId().toString()},
                new String[] {"seasonId", UUID.randomUUID().toString()},
                new String[] {"leagueId", UUID.randomUUID().toString()},
                new String[] {"teamId", seed.other.seniors1().getId().toString()},
                new String[] {"teamId", UUID.randomUUID().toString()},
                new String[] {"sectionId", seed.other.seniors().getId().toString()},
                new String[] {"sectionId", UUID.randomUUID().toString()});
        for (String[] filter : unknown) {
            getAs(admin, playerStatsPath(seed.alice.getId()), filter[0], filter[1]).andExpect(status().isNotFound());
            getAs(admin, BASE + "/leaderboards/batting", filter[0], filter[1]).andExpect(status().isNotFound());
            getAs(admin, BASE + "/leaderboards/bowling", filter[0], filter[1]).andExpect(status().isNotFound());
            getAs(admin, BASE + "/leaderboards/fielding", filter[0], filter[1]).andExpect(status().isNotFound());
            getAs(admin, BASE + "/leaderboards/awards", filter[0], filter[1]).andExpect(status().isNotFound());
        }
        getAs(admin, BASE + "/leaderboards/everything").andExpect(status().isNotFound());
        getAs(admin, BASE + "/leaderboards/MOST_RUNS").andExpect(status().isNotFound());
        getAs(admin, BASE + "/leaderboards/AWARDS").andExpect(status().isNotFound());
    }

    // ---- 400 ----

    @Test
    void badParametersAreRejectedWith400() throws Exception {
        String stats = playerStatsPath(seed.alice.getId());
        String batting = BASE + "/leaderboards/batting";

        getAs(admin, stats, "competition", "MIXED").andExpect(status().isBadRequest());
        getAs(admin, stats, "competition", "league").andExpect(status().isBadRequest());
        getAs(admin, stats, "seasonId", "not-a-uuid").andExpect(status().isBadRequest());

        getAs(admin, batting, "direction", "up").andExpect(status().isBadRequest());
        getAs(admin, batting, "sort", "bogus").andExpect(status().isBadRequest());
        getAs(admin, BASE + "/leaderboards/fielding", "sort", "runs").andExpect(status().isBadRequest());
        getAs(admin, BASE + "/leaderboards/bowling", "sort", "innings").andExpect(status().isBadRequest());
        getAs(admin, batting, "sort", "average", "minimum", "-1").andExpect(status().isBadRequest());
        getAs(admin, batting, "sort", "average", "minimum", "abc").andExpect(status().isBadRequest());
        getAs(admin, batting, "page", "-1").andExpect(status().isBadRequest());
        getAs(admin, batting, "page", "abc").andExpect(status().isBadRequest());
        getAs(admin, batting, "size", "0").andExpect(status().isBadRequest());
        getAs(admin, batting, "size", "-5").andExpect(status().isBadRequest());
        getAs(admin, BASE + "/leaderboards/awards", "minimumInnings", "-1").andExpect(status().isBadRequest());
        getAs(admin, BASE + "/leaderboards/awards", "minimumInnings", "abc").andExpect(status().isBadRequest());
        getAs(admin, BASE + "/leaderboards/awards", "minimumOvers", "-2").andExpect(status().isBadRequest());

        // the well-formed neighbours are accepted
        getAs(admin, batting, "direction", "asc").andExpect(status().isOk());
        getAs(admin, batting, "sort", "average", "minimum", "0").andExpect(status().isOk());
        getAs(admin, stats, "competition", "LEAGUE").andExpect(status().isOk());
    }

    @Test
    void thePageSizeDefaultsToTenAndIsCappedAtOneHundred() throws Exception {
        String batting = BASE + "/leaderboards/batting";

        JsonNode capped = json(getAs(admin, batting, "size", "500").andExpect(status().isOk()));
        assertThat(capped.path("page").path("size").asInt()).isEqualTo(100);
        assertThat(capped.path("rows")).hasSize(8);

        JsonNode defaults = json(getAs(admin, batting).andExpect(status().isOk()));
        assertThat(defaults.path("page").path("size").asInt()).isEqualTo(10);

        JsonNode paged = json(getAs(admin, batting, "size", "3", "page", "2").andExpect(status().isOk()));
        assertThat(paged.path("rows")).as("8 players: the third page of 3 holds the last 2").hasSize(2);
        assertThat(paged.path("page").path("number").asInt()).isEqualTo(2);
        assertThat(paged.path("page").path("totalElements").asInt()).isEqualTo(8);
        assertThat(paged.path("page").path("hasMore").asBoolean()).isFalse();
    }

    // ---- section-scoped managers ----

    @Test
    void aSectionScopedManagerIsNarrowedToTheirSectionsAndRefusedOtherSections() throws Exception {
        JwtRequestPostProcessor juniors = seed.fixtures.sectionManager(seed.w.juniors());
        JwtRequestPostProcessor seniors = seed.fixtures.sectionManager(seed.w.seniors());
        String batting = BASE + "/leaderboards/batting";

        JsonNode board = json(getAs(juniors, batting).andExpect(status().isOk()));
        assertThat(firstNames(board)).containsExactly("Alice");
        assertThat(board.path("rows").get(0).path("values").path("runs").path("value").decimalValue())
                .isEqualByComparingTo("7");
        JsonNode seniorBoard = json(getAs(seniors, batting).andExpect(status().isOk()));
        assertThat(firstNames(seniorBoard)).contains("Alice", "Bob", "Dan").doesNotContain("Gina");
        assertThat(seniorBoard.path("rows").get(0).path("values").path("runs").path("value").decimalValue())
                .isEqualByComparingTo("180");

        // a section or a team outside their sections is refused on every route that takes one
        for (String path : List.of(batting, BASE + "/leaderboards/bowling", BASE + "/leaderboards/fielding",
                BASE + "/leaderboards/awards", playerStatsPath(seed.alice.getId()))) {
            getAs(juniors, path, "sectionId", seed.w.seniors().getId().toString()).andExpect(status().isForbidden());
            getAs(juniors, path, "sectionId", seed.seniorsA.getId().toString()).andExpect(status().isForbidden());
            getAs(juniors, path, "teamId", seed.w.seniors1().getId().toString()).andExpect(status().isForbidden());
            getAs(juniors, path, "sectionId", seed.w.juniors().getId().toString()).andExpect(status().isOk());
            getAs(seniors, path, "sectionId", seed.w.juniors().getId().toString()).andExpect(status().isForbidden());
        }
        // a section inside theirs (a descendant) is allowed
        getAs(seniors, batting, "sectionId", seed.seniorsA1.getId().toString()).andExpect(status().isOk());

        // the awards view and the player page are narrowed too
        JsonNode awards = json(getAs(juniors, BASE + "/leaderboards/awards").andExpect(status().isOk()));
        assertThat(awards.path("basis").path("resultsCounted").asInt()).isEqualTo(1);
        JsonNode page = json(getAs(juniors, playerStatsPath(seed.alice.getId())).andExpect(status().isOk()));
        assertThat(page.path("batting").path("runs").asInt()).isEqualTo(7);
        assertThat(page.path("basis").path("matchesCounted").asInt()).isEqualTo(1);
        JsonNode options = json(getAs(juniors, playerStatsPath(seed.alice.getId()) + "/filter-options")
                .andExpect(status().isOk()));
        assertThat(options.path("teamIds")).hasSize(1);
        assertThat(options.path("teamIds").get(0).asText()).isEqualTo(seed.w.juniorsTeam().getId().toString());
    }

    // ---- empty and draft ----

    @Test
    void aPlayerWithNoAppearancesIs200WithZeroCountersAndDashes() throws Exception {
        JsonNode gina = json(getAs(admin, playerStatsPath(seed.gina.getId())).andExpect(status().isOk()));

        assertThat(gina.path("playerId").asText()).isEqualTo(seed.gina.getId().toString());
        assertThat(gina.path("scope").path("kind").asText()).isEqualTo("CLUB_VERIFIED");
        assertThat(gina.path("basis").path("matchesCounted").asInt()).isZero();
        assertThat(gina.path("basis").path("resultsWithBattingCard").asInt()).isZero();
        assertThat(gina.path("batting").path("innings").asInt()).isZero();
        assertThat(gina.path("batting").path("runs").asInt()).isZero();
        assertThat(gina.path("batting").path("average").isNull()).isTrue();
        assertThat(gina.path("batting").path("strikeRate").isNull()).isTrue();
        assertThat(gina.path("batting").path("highestScore").isNull()).isTrue();
        assertThat(gina.path("bowling").path("wickets").asInt()).isZero();
        assertThat(gina.path("bowling").path("economy").isNull()).isTrue();
        assertThat(gina.path("bowling").path("best").isNull()).isTrue();
        assertThat(gina.path("fielding").path("dismissals").asInt()).isZero();
        assertThat(gina.path("fielding").path("dismissalsPerMatch").isNull()).isTrue();
        assertThat(gina.path("form").path("batting")).isEmpty();
        assertThat(gina.path("form").path("bowling")).isEmpty();
        assertThat(gina.path("notCaptured").size()).isPositive();
    }

    @Test
    void theResponseNeverChangesWhenOnlyADraftChanges() throws Exception {
        String bob = playerStatsPath(seed.bob.getId());
        JsonNode pageBefore = json(getAs(admin, bob).andExpect(status().isOk()));
        JsonNode boardBefore = json(getAs(admin, BASE + "/leaderboards/batting", "size", "100").andExpect(status().isOk()));
        JsonNode awardsBefore = json(getAs(admin, BASE + "/leaderboards/awards").andExpect(status().isOk()));

        int changed = jdbc.update("update batting_entry set runs = 999, balls = 500 where result_player_id in ("
                + "select rp.id from result_player rp join match_result r on r.id = rp.match_result_id"
                + " where r.match_id = ?)", seed.draftMatch.getId());
        jdbc.update("update match_innings set runs = 999 where match_result_id in (select id from match_result"
                + " where match_id = ?)", seed.draftMatch.getId());
        assertThat(changed).as("the draft's batting row was found").isEqualTo(1);

        assertThat(json(getAs(admin, bob).andExpect(status().isOk()))).isEqualTo(pageBefore);
        assertThat(json(getAs(admin, BASE + "/leaderboards/batting", "size", "100").andExpect(status().isOk())))
                .isEqualTo(boardBefore);
        assertThat(json(getAs(admin, BASE + "/leaderboards/awards").andExpect(status().isOk()))).isEqualTo(awardsBefore);
    }

    // ---- real unpublish and link routes ----

    @Test
    void unpublishingAndLinkingAGuestThroughTheResultRoutesChangesTheNextStatsRead() throws Exception {
        String bob = playerStatsPath(seed.bob.getId());
        String frank = playerStatsPath(seed.frank.getId());
        assertThat(json(getAs(admin, bob)).path("batting").path("runs").asInt()).isEqualTo(98);
        assertThat(json(getAs(admin, frank)).path("basis").path("matchesCounted").asInt()).isZero();

        mockMvc.perform(post(BASE + "/matches/{matchId}/result/unpublish", clubId, seed.unpublishMatch.getId())
                        .with(admin))
                .andExpect(status().isOk());
        mockMvc.perform(post(BASE + "/matches/{matchId}/result/players/{rp}/link", clubId, seed.guestMatch.getId(),
                                seed.garyRowResultPlayer)
                        .with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerProfileId\":\"" + seed.frank.getId() + "\"}"))
                .andExpect(status().isOk());

        JsonNode bobAfter = json(getAs(admin, bob).andExpect(status().isOk()));
        assertThat(bobAfter.path("batting").path("runs").asInt()).isEqualTo(21);
        assertThat(bobAfter.path("basis").path("matchesCounted").asInt()).isEqualTo(3);
        JsonNode frankAfter = json(getAs(admin, frank).andExpect(status().isOk()));
        assertThat(frankAfter.path("batting").path("runs").asInt()).isEqualTo(77);
        assertThat(frankAfter.path("basis").path("matchesCounted").asInt()).isEqualTo(1);
        assertThat(firstNames(json(getAs(admin, BASE + "/leaderboards/batting", "size", "100"))))
                .contains("Frank");
    }

    // ---- routing ----

    @Test
    void theLiteralLeaderboardRoutesAreNotSwallowedByTheGroupRoute() throws Exception {
        JsonNode awards = json(getAs(admin, BASE + "/leaderboards/awards").andExpect(status().isOk()));
        assertThat(awards.has("categories")).isTrue();
        assertThat(awards.has("minimums")).isTrue();
        assertThat(awards.has("rows")).isFalse();

        JsonNode options = json(getAs(admin, BASE + "/leaderboards/filter-options").andExpect(status().isOk()));
        assertThat(options.has("seasonIds")).isTrue();
        assertThat(options.has("rows")).isFalse();

        JsonNode batting = json(getAs(admin, BASE + "/leaderboards/batting").andExpect(status().isOk()));
        assertThat(batting.path("group").asText()).isEqualTo("batting");
        assertThat(batting.path("sort").path("code").asText()).isEqualTo("runs");
        assertThat(batting.path("columns").size()).isEqualTo(12);

        JsonNode catalogue = json(getAs(admin, BASE + "/leaderboards").andExpect(status().isOk()));
        List<String> codes = new ArrayList<>();
        catalogue.path("groups").forEach(g -> codes.add(g.path("group").asText()));
        assertThat(codes).containsExactly("BATTING", "BOWLING", "FIELDING", "AWARDS");

        // the stats route and its filter-options sibling are distinct too
        assertThat(json(getAs(admin, playerStatsPath(seed.alice.getId()) + "/filter-options")).has("seasonIds")).isTrue();
        assertThat(json(getAs(admin, playerStatsPath(seed.alice.getId()))).has("batting")).isTrue();
    }

    // ---- leaderboard settings ----

    @Test
    void theSettingsDefaultToTheNineHeadlineCategoriesAndOfferTheSelectableOnes() throws Exception {
        JsonNode settings = json(getAs(admin, SETTINGS).andExpect(status().isOk()));

        List<String> chosen = new ArrayList<>();
        settings.path("awardCategories").forEach(c -> chosen.add(c.asText()));
        assertThat(chosen).containsExactly("MOST_RUNS", "HIGHEST_SCORE", "BATTING_AVERAGE", "MOST_WICKETS",
                "BEST_BOWLING", "ECONOMY_RATE", "MOST_CATCHES", "MOST_FIELDING_DISMISSALS", "MOST_POTM");
        List<String> selectable = new ArrayList<>();
        settings.path("selectableCategories").forEach(c -> selectable.add(c.asText()));
        assertThat(selectable).containsAll(chosen).contains("MOST_SIXES").doesNotContain("MOST_30S", "MOST_3W");
    }

    @Test
    void invalidSettingsAreRejectedAndLeaveTheChoiceUnchanged() throws Exception {
        for (String body : List.of(
                "{\"awardCategories\":[]}",
                "{}",
                "{\"awardCategories\":null}",
                "{\"awardCategories\":[\"MOST_30S\"]}",
                "{\"awardCategories\":[\"MOST_RUNS\",\"MOST_NOT_OUTS\"]}",
                "{\"awardCategories\":[\"NOT_A_BOARD\"]}",
                "{\"awardCategories\":[\"most_runs\"]}")) {
            mockMvc.perform(put(SETTINGS, clubId).with(admin).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        assertThat(json(getAs(admin, SETTINGS)).path("awardCategories")).hasSize(9);
    }

    @Test
    void aValidSettingsChoiceIsStoredAndDrivesTheAwardsView() throws Exception {
        mockMvc.perform(put(SETTINGS, clubId).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"awardCategories\":[\"MOST_SIXES\",\"MOST_RUNS\",\"MOST_SIXES\"]}"))
                .andExpect(status().isOk());

        // stored once each, in the catalogue's order
        JsonNode settings = json(getAs(admin, SETTINGS).andExpect(status().isOk()));
        List<String> chosen = new ArrayList<>();
        settings.path("awardCategories").forEach(c -> chosen.add(c.asText()));
        assertThat(chosen).containsExactly("MOST_RUNS", "MOST_SIXES");

        JsonNode awards = json(getAs(admin, BASE + "/leaderboards/awards").andExpect(status().isOk()));
        List<String> shown = new ArrayList<>();
        awards.path("categories").forEach(c -> shown.add(c.path("board").path("code").asText()));
        awards.path("omitted").forEach(c -> shown.add(c.path("board").path("code").asText()));
        assertThat(shown).containsExactlyInAnyOrder("MOST_RUNS", "MOST_SIXES");
        JsonNode sixes = null;
        for (JsonNode category : awards.path("categories")) {
            if ("MOST_SIXES".equals(category.path("board").path("code").asText())) {
                sixes = category;
            }
        }
        assertThat(sixes).as("Alice's 3 sixes make her the most-sixes leader").isNotNull();
        assertThat(sixes.path("leaders").get(0).path("firstName").asText()).isEqualTo("Alice");
    }

    @Test
    void anotherClubsAdminCannotReadOrChangeTheSettingsAndTheyStayPerClub() throws Exception {
        mockMvc.perform(put(SETTINGS, clubId).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"awardCategories\":[\"MOST_RUNS\"]}"))
                .andExpect(status().isOk());

        mockMvc.perform(put(SETTINGS, clubId).with(stranger).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"awardCategories\":[\"MOST_WICKETS\"]}"))
                .andExpect(status().isForbidden());
        assertThat(json(getAs(admin, SETTINGS)).path("awardCategories")).hasSize(1);
        // the other club still has the defaults
        JsonNode theirs = json(mockMvc.perform(get(SETTINGS, seed.other.club().getId()).with(stranger))
                .andExpect(status().isOk()));
        assertThat(theirs.path("awardCategories")).hasSize(9);
    }

    @Test
    void aSectionScopedManagerMayChangeTheSettingsLikeAnyClubManager() throws Exception {
        JwtRequestPostProcessor juniors = seed.fixtures.sectionManager(seed.w.juniors());

        mockMvc.perform(put(SETTINGS, clubId).with(juniors).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"awardCategories\":[\"MOST_RUNS\",\"MOST_WICKETS\"]}"))
                .andExpect(status().isOk());
        assertThat(json(getAs(admin, SETTINGS)).path("awardCategories")).hasSize(2);
    }

    @Test
    void settingsOfAnUnknownClubAre404ForAPlatformAdmin() throws Exception {
        mockMvc.perform(get(SETTINGS, UUID.randomUUID()).with(platformAdmin())).andExpect(status().isNotFound());
        mockMvc.perform(put(SETTINGS, UUID.randomUUID()).with(platformAdmin()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"awardCategories\":[\"MOST_RUNS\"]}"))
                .andExpect(status().isNotFound());
    }
}
