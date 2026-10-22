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
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * docs/specs/117-stats-dashboard.md, "Controller": {@code GET /teams/{teamId}/stats/dashboard} through real HTTP against
 * real Postgres. Not {@code @Transactional}. The series are checked in {@code TeamDashboardServiceIntegrationTest} and the
 * parity test; this class is about who may call, what is refused (a team outside a section-scoped manager's reach is 403),
 * the JSON on the wire (gaps as null) and that no person is named.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class TeamDashboardControllerIntegrationTest {

    private static final String BASE = "/api/v1/manage/clubs/{clubId}";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

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

    private String path(UUID teamId) {
        return BASE + "/teams/" + teamId + "/stats/dashboard";
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

    private static JsonNode byMatch(JsonNode series, UUID matchId) {
        for (JsonNode point : series) {
            if (point.path("matchId").asText().equals(matchId.toString())) {
                return point;
            }
        }
        throw new AssertionError("no point for match " + matchId);
    }

    // ---- access ----

    @Test
    void theRouteRequiresAManagerOfTheClubAndRefusesAnotherClubsAdminAndSomeoneWithNoRole() throws Exception {
        JwtRequestPostProcessor nobody = seed.fixtures.nobody();
        for (String route : List.of(path(seed.dbEagles.getId()), path(seed.dbRooks.getId()))) {
            getAs(admin, route).andExpect(status().isOk());
            getAs(admin, route, "seasonId", seed.s1.getId().toString(), "leagueId", seed.l1.getId().toString(),
                    "competition", "LEAGUE").andExpect(status().isOk());
            getAs(stranger, route).andExpect(status().isForbidden());
            getAs(nobody, route).andExpect(status().isForbidden());
            mockMvc.perform(get(route, clubId)).andExpect(status().isUnauthorized());
        }
    }

    // ---- 404 ----

    @Test
    void anUnknownOrOtherClubsTeamSeasonOrLeagueIsNotFound() throws Exception {
        getAs(admin, path(UUID.randomUUID())).andExpect(status().isNotFound());
        getAs(admin, path(seed.other.seniors1().getId())).andExpect(status().isNotFound());

        UUID otherLeague = seed.fixtures.league(seed.other, 11).getId();
        List<String[]> unknown = List.of(
                new String[] {"seasonId", seed.other.season().getId().toString()},
                new String[] {"seasonId", UUID.randomUUID().toString()},
                new String[] {"leagueId", otherLeague.toString()},
                new String[] {"leagueId", UUID.randomUUID().toString()});
        for (String[] filter : unknown) {
            getAs(admin, path(seed.dbEagles.getId()), filter[0], filter[1]).andExpect(status().isNotFound());
        }
        mockMvc.perform(get(path(seed.dbEagles.getId()), seed.other.club().getId()).with(stranger))
                .andExpect(status().isNotFound());
    }

    // ---- 400 ----

    @Test
    void badParametersAreRejectedWith400AndTheNeighboursAreAccepted() throws Exception {
        String route = path(seed.dbEagles.getId());

        getAs(admin, route, "competition", "MIXED").andExpect(status().isBadRequest());
        getAs(admin, route, "competition", "friendly").andExpect(status().isBadRequest());
        getAs(admin, route, "seasonId", "not-a-uuid").andExpect(status().isBadRequest());
        getAs(admin, route, "leagueId", "7").andExpect(status().isBadRequest());
        mockMvc.perform(get(BASE + "/teams/{t}/stats/dashboard", clubId, "not-a-uuid").with(admin))
                .andExpect(status().isBadRequest());

        getAs(admin, route, "competition", "LEAGUE").andExpect(status().isOk());
        getAs(admin, route, "competition", "FRIENDLY").andExpect(status().isOk());
        getAs(admin, route, "competition", "").andExpect(status().isOk());
    }

    // ---- JSON ----

    @Test
    void theJsonCarriesEverySeriesWithGapsAsNullAndNoPersonNamed() throws Exception {
        String raw = getAs(admin, path(seed.dbEagles.getId())).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString();
        JsonNode body = objectMapper.readTree(raw);

        for (String field : List.of("teamId", "teamName", "scope", "basis", "window", "truncated", "truncatedSince",
                "results", "resultsSummary", "runRateTrend", "netRunRateTrend", "extrasConceded", "extrasSummary",
                "dotBalls", "dotBallsSummary", "notCaptured")) {
            assertThat(body.has(field)).as(field).isTrue();
        }
        assertThat(body.path("teamId").asText()).isEqualTo(seed.dbEagles.getId().toString());
        assertThat(body.path("teamName").asText()).isEqualTo("DB Eagles");
        assertThat(body.path("scope").path("kind").asText()).isEqualTo("CLUB_VERIFIED");
        assertThat(body.path("window").path("pointLimit").asInt()).isEqualTo(30);
        assertThat(body.path("window").path("historyCap").asInt()).isEqualTo(300);
        assertThat(body.path("truncated").asBoolean()).isFalse();
        assertThat(body.path("truncatedSince").isNull()).isTrue();
        assertThat(body.path("results")).hasSize(30);
        assertThat(body.path("resultsSummary").path("played").asInt()).isEqualTo(42);
        assertThat(body.path("resultsSummary").path("wonPercent").decimalValue().scale()).isEqualTo(1);
        assertThat(body.path("netRunRateTrend").path("status").asText()).isEqualTo("NOT_ONE_COMPETITION");
        assertThat(body.path("netRunRateTrend").path("points")).isEmpty();

        // a forfeit: its letter and flag, every figure null (not 0) in the JSON
        JsonNode forfeit = byMatch(body.path("results"), seed.dbMatches.get("FORFEIT_RECEIVED").getId());
        assertThat(forfeit.path("result").asText()).isEqualTo("WON");
        assertThat(forfeit.path("forfeit").asBoolean()).isTrue();
        for (String field : List.of("ownRuns", "ownWickets", "ownBalls", "oppRuns", "oppWickets", "oppBalls", "ownRunRate",
                "oppRunRate")) {
            assertThat(forfeit.has(field)).as(field + " is present").isTrue();
            assertThat(forfeit.path(field).isNull()).as(field + " is null").isTrue();
        }
        JsonNode normal = byMatch(body.path("results"), seed.dbMatches.get("M013").getId());
        assertThat(normal.path("ownRuns").asInt()).isEqualTo(133);
        assertThat(normal.path("ownRunRate").decimalValue()).isEqualByComparingTo("6.65");
        assertThat(normal.path("matchDate").asText()).as("an ISO instant").matches("\\d{4}-\\d\\d-\\d\\dT.*");
        assertThat(normal.path("resultId").asText()).isNotBlank();
        assertThat(normal.path("derby").asBoolean()).isFalse();
        assertThat(normal.path("opponentName").asText()).isEqualTo("Occasionals");

        // extras: a blank component and a recorded zero are different in the JSON, a match with none has a null total
        JsonNode partly = byMatch(body.path("extrasConceded"), seed.dbMatches.get("M014").getId());
        assertThat(partly.path("wides").asInt()).isEqualTo(4);
        assertThat(partly.path("noBalls").isNull()).isTrue();
        assertThat(partly.path("itemised").asBoolean()).isTrue();
        assertThat(byMatch(body.path("extrasConceded"), seed.dbMatches.get("M013").getId()).path("penaltyRuns").asInt())
                .isZero();
        JsonNode none = byMatch(body.path("extrasConceded"), seed.dbMatches.get("M012").getId());
        assertThat(none.has("total")).isTrue();
        assertThat(none.path("total").isNull()).isTrue();
        JsonNode totalOnly = byMatch(body.path("extrasConceded"), seed.dbMatches.get("M015").getId());
        assertThat(totalOnly.path("notItemised").asInt()).isEqualTo(9);
        assertThat(totalOnly.path("wides").isNull()).isTrue();
        assertThat(totalOnly.path("itemised").asBoolean()).isFalse();

        // dots: not recorded for every bowler is a null in the JSON
        JsonNode blank = byMatch(body.path("dotBalls"), seed.dbMatches.get("M013").getId());
        assertThat(blank.path("ballsBowled").asInt()).isEqualTo(12);
        assertThat(blank.has("dots")).isTrue();
        assertThat(blank.path("dots").isNull()).isTrue();
        assertThat(blank.path("dotPercent").isNull()).isTrue();
        assertThat(byMatch(body.path("dotBalls"), seed.dbMatches.get("M012").getId()).path("dotPercent").decimalValue())
                .isEqualByComparingTo("25.0");
        assertThat(body.path("dotBallsSummary").path("averageDotPercent").decimalValue().scale()).isEqualTo(1);

        // no person is named: no player of the seed, no opposition batter
        for (String name : List.of("Dash", "Mate", "Dee", "Ova", "Opp ", "Alice", "Bob", "Tess")) {
            assertThat(raw).as("no \"" + name + "\" in the response").doesNotContain(name);
        }
    }

    @Test
    void aNetRunRateOfASingleCompetitionIsDrawnAsPointsAndATeamWithNothingCountedIs200() throws Exception {
        JsonNode one = json(getAs(admin, path(seed.dbEagles.getId()), "seasonId", seed.s1.getId().toString(), "leagueId",
                seed.l1.getId().toString()).andExpect(status().isOk()));
        assertThat(one.path("netRunRateTrend").path("status").asText()).isEqualTo("SHOWN");
        assertThat(one.path("netRunRateTrend").path("points")).isNotEmpty();
        assertThat(one.path("netRunRateTrend").path("points").get(0).path("value").decimalValue().scale()).isEqualTo(2);

        UUID empty = seed.fixtures.team(seed.w.club(), seed.w.juniors(), "No matches").getId();
        JsonNode none = json(getAs(admin, path(empty)).andExpect(status().isOk()));
        assertThat(none.path("teamId").asText()).isEqualTo(empty.toString());
        assertThat(none.path("results")).isEmpty();
        assertThat(none.path("runRateTrend")).isEmpty();
        assertThat(none.path("extrasConceded")).isEmpty();
        assertThat(none.path("dotBalls")).isEmpty();
        assertThat(none.path("resultsSummary").path("played").asInt()).isZero();
        assertThat(none.path("resultsSummary").path("wonPercent").isNull()).isTrue();
        assertThat(none.path("dotBallsSummary").path("averageDotPercent").isNull()).isTrue();
        assertThat(none.path("dotBallsSummary").path("direction").isNull()).isTrue();
    }

    // ---- section-scoped managers ----

    @Test
    void aTeamOutsideASectionScopedManagersReachIs403AndOneInsideIs200() throws Exception {
        JwtRequestPostProcessor juniors = seed.fixtures.sectionManager(seed.w.juniors());
        JwtRequestPostProcessor seniors = seed.fixtures.sectionManager(seed.w.seniors());
        UUID juniorsTeam = seed.w.juniorsTeam().getId();

        getAs(juniors, path(seed.dbEagles.getId())).andExpect(status().isForbidden());
        getAs(juniors, path(seed.dbRooks.getId())).andExpect(status().isForbidden());
        getAs(juniors, path(juniorsTeam)).andExpect(status().isOk());
        getAs(seniors, path(juniorsTeam)).andExpect(status().isForbidden());
        // Eagles are in Seniors A and Rooks in Seniors A1, both inside the Seniors manager's reach
        JsonNode eagles = json(getAs(seniors, path(seed.dbEagles.getId())).andExpect(status().isOk()));
        assertThat(eagles.path("resultsSummary").path("played").asInt()).as("a team's figures are never narrowed").isEqualTo(42);
        getAs(seniors, path(seed.dbRooks.getId())).andExpect(status().isOk());
    }

    // ---- routing and real unpublish ----

    @Test
    void theDashboardRouteIsDistinctFromTheTeamStatsRoute_andUnpublishingChangesTheNextRead() throws Exception {
        String stats = BASE + "/teams/" + seed.dbEagles.getId() + "/stats";
        assertThat(json(getAs(admin, stats)).has("record")).isTrue();
        assertThat(json(getAs(admin, stats)).has("results")).isFalse();
        JsonNode before = json(getAs(admin, stats + "/dashboard"));
        assertThat(before.has("results")).isTrue();
        assertThat(before.has("record")).isFalse();
        assertThat(before.path("resultsSummary").path("played").asInt()).isEqualTo(42);

        mockMvc.perform(post(BASE + "/matches/{matchId}/result/unpublish", clubId, seed.dashUnpublishMatch.getId())
                        .with(admin))
                .andExpect(status().isOk());

        JsonNode after = json(getAs(admin, stats + "/dashboard").andExpect(status().isOk()));
        assertThat(after.path("resultsSummary").path("played").asInt()).isEqualTo(41);
        assertThat(after.toString()).doesNotContain(seed.dashUnpublishMatch.getId().toString());
    }
}
