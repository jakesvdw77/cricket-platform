package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.support.PlayerStatsSeed;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * docs/specs/117-stats-dashboard.md, "Controller": {@code GET /players/{playerId}/stats/dashboard} through real HTTP
 * against real Postgres. Not {@code @Transactional}; {@link PlayerStatsSeed} removes what it seeds. The series are checked
 * in {@code PlayerDashboardServiceIntegrationTest} and the parity test; this class is about who may call, what is refused,
 * the JSON on the wire (nulls included) and that no other person is named.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class PlayerDashboardControllerIntegrationTest {

    private static final String BASE = "/api/v1/manage/clubs/{clubId}";

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
        seed.seedDashboard(36);
        clubId = seed.w.club().getId();
        admin = seed.fixtures.clubAdmin(seed.w);
        stranger = seed.fixtures.clubAdmin(seed.other);
    }

    @AfterEach
    void cleanUp() {
        seed.cleanUp();
    }

    private String path(UUID playerId) {
        return BASE + "/players/" + playerId + "/stats/dashboard";
    }

    private ResultActions getAs(JwtRequestPostProcessor caller, String path, Object... params) throws Exception {
        var map = new org.springframework.util.LinkedMultiValueMap<String, String>();
        for (int i = 0; i < params.length; i += 2) {
            map.add(params[i].toString(), params[i + 1].toString());
        }
        return mockMvc.perform(get(path, clubId).with(caller).params(map));
    }

    private JsonNode json(ResultActions actions) throws Exception {
        return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    // ---- access ----

    @Test
    void theRouteRequiresAManagerOfTheClubAndRefusesAnotherClubsAdminAndSomeoneWithNoRole() throws Exception {
        JwtRequestPostProcessor nobody = seed.fixtures.nobody();
        for (String route : List.of(path(seed.dash.getId()), path(seed.gina.getId()))) {
            getAs(admin, route).andExpect(status().isOk());
            getAs(admin, route, "seasonId", seed.s1.getId().toString(), "leagueId", seed.l1.getId().toString(),
                    "teamId", seed.dbEagles.getId().toString(), "sectionId", seed.seniorsA.getId().toString(),
                    "competition", "LEAGUE").andExpect(status().isOk());
            getAs(stranger, route).andExpect(status().isForbidden());
            getAs(nobody, route).andExpect(status().isForbidden());
            mockMvc.perform(get(route, clubId)).andExpect(status().isUnauthorized());
        }
    }

    // ---- 404 ----

    @Test
    void anUnknownOrOtherClubsPlayerSeasonLeagueTeamOrSectionIsNotFound() throws Exception {
        getAs(admin, path(UUID.randomUUID())).andExpect(status().isNotFound());
        getAs(admin, path(seed.xavier.getId())).andExpect(status().isNotFound());

        UUID otherLeague = seed.fixtures.league(seed.other, 11).getId();
        List<String[]> unknown = List.of(
                new String[] {"seasonId", seed.other.season().getId().toString()},
                new String[] {"seasonId", UUID.randomUUID().toString()},
                new String[] {"leagueId", otherLeague.toString()},
                new String[] {"leagueId", UUID.randomUUID().toString()},
                new String[] {"teamId", seed.other.seniors1().getId().toString()},
                new String[] {"teamId", UUID.randomUUID().toString()},
                new String[] {"sectionId", seed.other.seniors().getId().toString()},
                new String[] {"sectionId", UUID.randomUUID().toString()});
        for (String[] filter : unknown) {
            getAs(admin, path(seed.dash.getId()), filter[0], filter[1]).andExpect(status().isNotFound());
        }
        // the other club's admin cannot read this club's player through their own club id either
        mockMvc.perform(get(path(seed.dash.getId()), seed.other.club().getId()).with(stranger))
                .andExpect(status().isNotFound());
    }

    // ---- 400 ----

    @Test
    void badParametersAreRejectedWith400AndTheNeighboursAreAccepted() throws Exception {
        String route = path(seed.dash.getId());

        getAs(admin, route, "competition", "MIXED").andExpect(status().isBadRequest());
        getAs(admin, route, "competition", "league").andExpect(status().isBadRequest());
        getAs(admin, route, "seasonId", "not-a-uuid").andExpect(status().isBadRequest());
        getAs(admin, route, "leagueId", "12").andExpect(status().isBadRequest());
        getAs(admin, route, "teamId", "x").andExpect(status().isBadRequest());
        getAs(admin, route, "sectionId", "x").andExpect(status().isBadRequest());

        getAs(admin, route, "competition", "LEAGUE").andExpect(status().isOk());
        getAs(admin, route, "competition", "FRIENDLY").andExpect(status().isOk());
        getAs(admin, route, "competition", "").andExpect(status().isOk());
        mockMvc.perform(get(BASE + "/players/{p}/stats/dashboard", clubId, "not-a-uuid").with(admin))
                .andExpect(status().isBadRequest());
    }

    // ---- JSON ----

    @Test
    void theJsonCarriesEverySeriesWithGapsAsNullAndNeverANameOfAnotherPerson() throws Exception {
        String raw = getAs(admin, path(seed.dash.getId()), "teamId", seed.dbEagles.getId().toString())
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode body = objectMapper.readTree(raw);

        for (String field : List.of("playerId", "scope", "basis", "window", "truncated", "truncatedSince", "battingInnings",
                "battingSummary", "dismissals", "battingTrend", "bowlingMatches", "wicketTypes", "economySummary",
                "notCaptured")) {
            assertThat(body.has(field)).as(field).isTrue();
        }
        assertThat(body.path("playerId").asText()).isEqualTo(seed.dash.getId().toString());
        assertThat(body.path("scope").path("kind").asText()).isEqualTo("CLUB_VERIFIED");
        assertThat(body.path("scope").path("teamId").asText()).isEqualTo(seed.dbEagles.getId().toString());
        assertThat(body.path("window").path("pointLimit").asInt()).isEqualTo(30);
        assertThat(body.path("window").path("historyCap").asInt()).isEqualTo(300);
        assertThat(body.path("truncated").asBoolean()).isFalse();
        assertThat(body.path("truncatedSince").isNull()).isTrue();
        assertThat(body.path("basis").path("matchesCounted").asInt()).isEqualTo(36);
        assertThat(body.path("battingInnings")).hasSize(30);
        JsonNode first = body.path("battingInnings").get(0);
        assertThat(first.path("matchDate").asText()).as("an ISO instant").matches("\\d{4}-\\d\\d-\\d\\dT.*");
        assertThat(first.path("matchId").asText()).isNotBlank();
        assertThat(first.path("resultId").asText()).isNotBlank();
        assertThat(first.path("opponentName").asText()).isEqualTo("Occasionals");
        assertThat(first.has("balls")).isTrue();
        // i = 15 scored runs off 0 balls: the balls are null in the JSON, never 0
        JsonNode zeroBalls = null;
        for (JsonNode innings : body.path("battingInnings")) {
            if (innings.path("matchId").asText().equals(seed.dashMatches.get(14).match().getId().toString())) {
                zeroBalls = innings;
            }
        }
        assertThat(zeroBalls).isNotNull();
        assertThat(zeroBalls.has("balls")).isTrue();
        assertThat(zeroBalls.path("balls").isNull()).isTrue();
        // i = 14's zero-ball bowling row: economy is null in the JSON
        JsonNode zeroEconomy = null;
        for (JsonNode match : body.path("bowlingMatches")) {
            if (match.path("matchId").asText().equals(seed.dashMatches.get(13).match().getId().toString())) {
                zeroEconomy = match;
            }
        }
        assertThat(zeroEconomy).isNotNull();
        assertThat(zeroEconomy.has("economy")).isTrue();
        assertThat(zeroEconomy.path("economy").isNull()).isTrue();
        assertThat(zeroEconomy.path("balls").asInt()).isZero();
        assertThat(body.path("wicketTypes").path("types")).hasSize(6);
        assertThat(body.path("wicketTypes").path("types").get(0).path("type").asText()).isEqualTo("BOWLED");
        assertThat(body.path("wicketTypes").path("notItemised").has("count")).isTrue();
        assertThat(body.path("wicketTypes").path("coverage").has("wicketsTotal")).isTrue();
        assertThat(body.path("economySummary").path("overallEconomy").decimalValue().scale()).isEqualTo(2);
        assertThat(body.path("economySummary").has("direction")).isTrue();
        assertThat(body.path("notCaptured").isArray()).isTrue();

        // nobody but the subject is named: not the player's own first name, nor the opposition players' display names
        for (String name : List.of("Dash", "Mate", "Dee", "Ova", "Opp ", "Alice", "Bob", "Tess")) {
            assertThat(raw).as("no \"" + name + "\" in the response").doesNotContain(name);
        }
        // a derby names no opponent at all
        JsonNode derby = json(getAs(admin, path(seed.dee.getId())).andExpect(status().isOk()));
        assertThat(derby.path("battingInnings").get(0).path("derby").asBoolean()).isTrue();
        assertThat(derby.path("battingInnings").get(0).path("opponentName").isNull()).isTrue();
        assertThat(derby.toString()).doesNotContain("DB Rooks").doesNotContain("DB Eagles");
    }

    @Test
    void aPlayerWithNoAppearancesIs200WithEmptySeriesAndNullFigures() throws Exception {
        JsonNode gina = json(getAs(admin, path(seed.gina.getId())).andExpect(status().isOk()));

        assertThat(gina.path("playerId").asText()).isEqualTo(seed.gina.getId().toString());
        assertThat(gina.path("basis").path("matchesCounted").asInt()).isZero();
        assertThat(gina.path("battingInnings")).isEmpty();
        assertThat(gina.path("dismissals")).isEmpty();
        assertThat(gina.path("battingTrend")).isEmpty();
        assertThat(gina.path("bowlingMatches")).isEmpty();
        assertThat(gina.path("battingSummary").path("inningsTotal").asInt()).isZero();
        assertThat(gina.path("battingSummary").path("averageRuns").isNull()).isTrue();
        assertThat(gina.path("economySummary").path("overallEconomy").isNull()).isTrue();
        assertThat(gina.path("economySummary").path("direction").isNull()).isTrue();
        assertThat(gina.path("wicketTypes").path("total").asInt()).isZero();
        assertThat(gina.path("wicketTypes").path("types").get(0).path("percent").isNull()).isTrue();
        assertThat(gina.path("wicketTypes").path("notItemised").path("percent").isNull()).isTrue();
    }

    // ---- section-scoped managers ----

    @Test
    void aSectionScopedManagerIsNarrowedToTheirSectionsAndRefusedOtherSections() throws Exception {
        JwtRequestPostProcessor juniors = seed.fixtures.sectionManager(seed.w.juniors());
        JwtRequestPostProcessor seniors = seed.fixtures.sectionManager(seed.w.seniors());
        String dash = path(seed.dash.getId());

        // inside their reach: the Seniors manager sees all 38 of dash's matches (Eagles are in Seniors A, under Seniors)
        JsonNode seniorBoard = json(getAs(seniors, dash).andExpect(status().isOk()));
        assertThat(seniorBoard.path("basis").path("matchesCounted").asInt()).isEqualTo(38);
        assertThat(seniorBoard.path("battingSummary").path("inningsTotal").asInt()).isEqualTo(35);
        // outside their reach: the Juniors manager sees an empty Dashboard, not an error and not the Seniors matches
        JsonNode empty = json(getAs(juniors, dash).andExpect(status().isOk()));
        assertThat(empty.path("basis").path("matchesCounted").asInt()).isZero();
        assertThat(empty.path("battingInnings")).isEmpty();
        assertThat(empty.path("bowlingMatches")).isEmpty();
        assertThat(empty.path("wicketTypes").path("total").asInt()).isZero();
        assertThat(empty.path("economySummary").path("overallEconomy").isNull()).isTrue();

        // a section or a team outside their sections is refused
        getAs(juniors, dash, "sectionId", seed.w.seniors().getId().toString()).andExpect(status().isForbidden());
        getAs(juniors, dash, "sectionId", seed.seniorsA.getId().toString()).andExpect(status().isForbidden());
        getAs(juniors, dash, "teamId", seed.dbEagles.getId().toString()).andExpect(status().isForbidden());
        getAs(juniors, dash, "sectionId", seed.w.juniors().getId().toString()).andExpect(status().isOk());
        getAs(seniors, dash, "sectionId", seed.w.juniors().getId().toString()).andExpect(status().isForbidden());
        // a section inside theirs (a descendant) is allowed, and so is a team in it
        getAs(seniors, dash, "sectionId", seed.seniorsA1.getId().toString()).andExpect(status().isOk());
        getAs(seniors, dash, "teamId", seed.dbEagles.getId().toString()).andExpect(status().isOk());
    }

    // ---- routing and real unpublish ----

    @Test
    void theDashboardRouteIsDistinctFromTheStatsMatchesAndOptionsRoutes() throws Exception {
        String stats = BASE + "/players/" + seed.dash.getId() + "/stats";

        assertThat(json(getAs(admin, stats)).has("batting")).isTrue();
        assertThat(json(getAs(admin, stats)).has("battingInnings")).isFalse();
        JsonNode dashboard = json(getAs(admin, stats + "/dashboard"));
        assertThat(dashboard.has("battingInnings")).isTrue();
        assertThat(dashboard.has("batting")).isFalse();
        assertThat(json(getAs(admin, stats + "/matches")).has("rows")).isTrue();
        assertThat(json(getAs(admin, stats + "/filter-options")).has("seasonIds")).isTrue();
    }

    @Test
    void unpublishingAResultThroughTheRouteChangesTheNextDashboardRead_andADraftNeverDoes() throws Exception {
        String dash = path(seed.dash.getId());
        JsonNode before = json(getAs(admin, dash, "teamId", seed.dbEagles.getId().toString()).andExpect(status().isOk()));
        assertThat(before.path("basis").path("matchesCounted").asInt()).isEqualTo(36);

        // a change to a draft result leaves the response as it was
        int changed = jdbc.update("update batting_entry set runs = 999 where result_player_id in ("
                + "select rp.id from result_player rp join match_result r on r.id = rp.match_result_id"
                + " where r.match_id = ?)", seed.dashDraftMatch.getId());
        assertThat(changed).as("the draft's batting row was found").isEqualTo(1);
        assertThat(json(getAs(admin, dash, "teamId", seed.dbEagles.getId().toString()))).isEqualTo(before);

        mockMvc.perform(post(BASE + "/matches/{matchId}/result/unpublish", clubId, seed.dashUnpublishMatch.getId())
                        .with(admin))
                .andExpect(status().isOk());

        JsonNode after = json(getAs(admin, dash, "teamId", seed.dbEagles.getId().toString()).andExpect(status().isOk()));
        assertThat(after.path("basis").path("matchesCounted").asInt()).isEqualTo(35);
        assertThat(after.path("battingTrend")).hasSize(before.path("battingTrend").size() - 1);
    }
}
