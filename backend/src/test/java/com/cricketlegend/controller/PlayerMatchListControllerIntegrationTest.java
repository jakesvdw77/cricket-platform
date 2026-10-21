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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * docs/specs/115-player-match-list.md, "Controller": {@code GET /players/{playerId}/stats/matches} through real HTTP
 * against real Postgres. Not {@code @Transactional}; {@link PlayerStatsSeed} removes what it seeds. The row figures are
 * checked in {@code PlayerMatchListIntegrationTest}; this class is about who may call, what is refused, the paging
 * contract and the JSON on the wire.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class PlayerMatchListControllerIntegrationTest {

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
        seed.seedMatchList();
        clubId = seed.w.club().getId();
        admin = seed.fixtures.clubAdmin(seed.w);
        stranger = seed.fixtures.clubAdmin(seed.other);
    }

    @AfterEach
    void cleanUp() {
        seed.cleanUp();
    }

    private String path(UUID playerId) {
        return BASE + "/players/" + playerId + "/stats/matches";
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
        for (String route : List.of(path(seed.alice.getId()), path(seed.gina.getId()))) {
            getAs(admin, route).andExpect(status().isOk());
            getAs(admin, route, "seasonId", seed.s1.getId().toString(), "competition", "LEAGUE", "direction", "asc",
                    "page", "0", "size", "5").andExpect(status().isOk());
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
            getAs(admin, path(seed.alice.getId()), filter[0], filter[1]).andExpect(status().isNotFound());
        }
    }

    // ---- 400 ----

    @Test
    void badParametersAreRejectedWith400AndTheSizeIsNeverClamped() throws Exception {
        String route = path(seed.nina.getId());

        getAs(admin, route, "competition", "MIXED").andExpect(status().isBadRequest());
        getAs(admin, route, "competition", "league").andExpect(status().isBadRequest());
        getAs(admin, route, "direction", "up").andExpect(status().isBadRequest());
        getAs(admin, route, "page", "-1").andExpect(status().isBadRequest());
        getAs(admin, route, "page", "abc").andExpect(status().isBadRequest());
        getAs(admin, route, "size", "0").andExpect(status().isBadRequest());
        getAs(admin, route, "size", "-5").andExpect(status().isBadRequest());
        getAs(admin, route, "size", "101").andExpect(status().isBadRequest());
        getAs(admin, route, "size", "500").andExpect(status().isBadRequest());
        getAs(admin, route, "size", "abc").andExpect(status().isBadRequest());
        getAs(admin, route, "seasonId", "not-a-uuid").andExpect(status().isBadRequest());

        // the well-formed neighbours are accepted
        JsonNode atCap = json(getAs(admin, route, "size", "100").andExpect(status().isOk()));
        assertThat(atCap.path("page").path("size").asInt()).isEqualTo(100);
        assertThat(atCap.path("rows")).hasSize(5);
        JsonNode smallest = json(getAs(admin, route, "size", "1").andExpect(status().isOk()));
        assertThat(smallest.path("rows")).hasSize(1);
        getAs(admin, route, "direction", "asc").andExpect(status().isOk());
        getAs(admin, route, "direction", "desc").andExpect(status().isOk());
        getAs(admin, route, "competition", "FRIENDLY").andExpect(status().isOk());
        getAs(admin, route, "page", "0").andExpect(status().isOk());
    }

    // ---- paging contract and JSON ----

    @Test
    void thePageSizeDefaultsToTwentyAndThePageObjectCarriesTheTrueTotal() throws Exception {
        JsonNode defaults = json(getAs(admin, path(seed.nina.getId())).andExpect(status().isOk()));
        assertThat(defaults.path("page").path("size").asInt()).isEqualTo(20);
        assertThat(defaults.path("page").path("number").asInt()).isZero();
        assertThat(defaults.path("page").path("totalElements").asInt()).isEqualTo(5);
        assertThat(defaults.path("page").path("hasMore").asBoolean()).isFalse();

        JsonNode second = json(getAs(admin, path(seed.nina.getId()), "size", "2", "page", "1").andExpect(status().isOk()));
        assertThat(second.path("rows")).hasSize(2);
        assertThat(second.path("page").path("number").asInt()).isEqualTo(1);
        assertThat(second.path("page").path("totalElements").asInt()).isEqualTo(5);
        assertThat(second.path("page").path("hasMore").asBoolean()).isTrue();

        JsonNode beyond = json(getAs(admin, path(seed.nina.getId()), "size", "2", "page", "7").andExpect(status().isOk()));
        assertThat(beyond.path("rows")).isEmpty();
        assertThat(beyond.path("page").path("totalElements").asInt()).isEqualTo(5);
        assertThat(beyond.path("page").path("hasMore").asBoolean()).isFalse();
    }

    @Test
    void theRowJsonCarriesTheFiguresTheClientFormatsAndNoOtherPersonsName() throws Exception {
        var response = getAs(admin, path(seed.alice.getId())).andExpect(status().isOk()).andReturn().getResponse();
        JsonNode body = objectMapper.readTree(response.getContentAsString());
        assertThat(body.path("playerId").asText()).isEqualTo(seed.alice.getId().toString());
        assertThat(body.path("scope").path("kind").asText()).isEqualTo("CLUB_VERIFIED");
        assertThat(body.path("rows")).hasSize(5);

        JsonNode newest = body.path("rows").get(0);
        assertThat(newest.path("result").asText()).isEqualTo("WON");
        assertThat(newest.path("competition").asText()).isEqualTo("LEAGUE");
        assertThat(newest.path("derby").asBoolean()).isFalse();
        assertThat(newest.path("ourTeams").get(0).path("teamName").asText()).isEqualTo(seed.w.juniorsTeam().getName());
        assertThat(newest.path("matchDate").asText()).as("an ISO instant").matches("\\d{4}-\\d\\d-\\d\\dT.*");
        assertThat(newest.path("matchId").asText()).isNotBlank();
        assertThat(newest.path("resultId").asText()).isNotBlank();
        assertThat(newest.path("batting").path("status").asText()).isEqualTo("BATTED");
        assertThat(newest.path("batting").path("innings").get(0).path("howOut").asText()).isEqualTo("BOWLED");
        assertThat(newest.path("bowling").path("status").asText()).isEqualTo("NO_CARD");
        assertThat(newest.path("bowling").path("wickets").isNull()).isTrue();
        assertThat(newest.path("fielding").path("status").asText()).isEqualTo("RECORDED");
        JsonNode oldest = body.path("rows").get(4);
        assertThat(oldest.path("bowling").path("status").asText()).isEqualTo("BOWLED");
        assertThat(oldest.path("bowling").path("wickets").asInt()).isEqualTo(3);
        assertThat(oldest.path("awards").path("playerOfTheMatch").asInt()).isEqualTo(1);

        // the player's own name is on the page already; no one else's name goes out (names are team names only)
        String text = response.getContentAsString();
        assertThat(text).doesNotContain("Opp One", "Opp Star", "Opp Big Hitter", "Gary", "Alice");
    }

    @Test
    void theDerbyRowIsInternalWithNoOpponentOnTheWire() throws Exception {
        JsonNode row = json(getAs(admin, path(seed.dan.getId())).andExpect(status().isOk())).path("rows").get(0);

        assertThat(row.path("derby").asBoolean()).isTrue();
        assertThat(row.path("result").asText()).isEqualTo("INTERNAL");
        assertThat(row.path("opponentName").isNull()).isTrue();
        assertThat(row.path("ourTeams")).hasSize(2);
        assertThat(row.path("batting").path("runs").asInt()).isEqualTo(45);
    }

    // ---- section-scoped managers ----

    @Test
    void aSectionScopedManagerIsNarrowedToTheirSectionsAndRefusedOtherSections() throws Exception {
        JwtRequestPostProcessor juniors = seed.fixtures.sectionManager(seed.w.juniors());
        JwtRequestPostProcessor seniors = seed.fixtures.sectionManager(seed.w.seniors());
        String alice = path(seed.alice.getId());

        JsonNode juniorList = json(getAs(juniors, alice).andExpect(status().isOk()));
        assertThat(juniorList.path("rows")).hasSize(1);
        assertThat(juniorList.path("page").path("totalElements").asInt()).isEqualTo(1);
        assertThat(juniorList.path("rows").get(0).path("batting").path("runs").asInt()).isEqualTo(7);
        JsonNode seniorList = json(getAs(seniors, alice).andExpect(status().isOk()));
        assertThat(seniorList.path("page").path("totalElements").asInt()).isEqualTo(4);

        getAs(juniors, alice, "sectionId", seed.w.seniors().getId().toString()).andExpect(status().isForbidden());
        getAs(juniors, alice, "sectionId", seed.seniorsA.getId().toString()).andExpect(status().isForbidden());
        getAs(juniors, alice, "teamId", seed.w.seniors1().getId().toString()).andExpect(status().isForbidden());
        getAs(juniors, alice, "sectionId", seed.w.juniors().getId().toString()).andExpect(status().isOk());
        getAs(juniors, alice, "teamId", seed.w.juniorsTeam().getId().toString()).andExpect(status().isOk());
        getAs(seniors, alice, "sectionId", seed.w.juniors().getId().toString()).andExpect(status().isForbidden());
        // a section inside theirs (a descendant) is allowed
        getAs(seniors, alice, "sectionId", seed.seniorsA1.getId().toString()).andExpect(status().isOk());

        // a player with no match in their sections is an empty page, not an error
        JsonNode none = json(getAs(juniors, path(seed.cara.getId())).andExpect(status().isOk()));
        assertThat(none.path("rows")).isEmpty();
        assertThat(none.path("page").path("totalElements").asInt()).isZero();
    }

    // ---- empty and draft ----

    @Test
    void aPlayerWithNoAppearancesIs200WithAnEmptyPage() throws Exception {
        JsonNode gina = json(getAs(admin, path(seed.gina.getId())).andExpect(status().isOk()));

        assertThat(gina.path("playerId").asText()).isEqualTo(seed.gina.getId().toString());
        assertThat(gina.path("rows")).isEmpty();
        assertThat(gina.path("page").path("totalElements").asInt()).isZero();
        assertThat(gina.path("page").path("hasMore").asBoolean()).isFalse();
        assertThat(gina.path("scope").path("kind").asText()).isEqualTo("CLUB_VERIFIED");
    }

    @Test
    void theResponseNeverChangesWhenOnlyADraftChanges() throws Exception {
        String bob = path(seed.bob.getId());
        JsonNode before = json(getAs(admin, bob).andExpect(status().isOk()));
        assertThat(before.path("rows")).hasSize(4);

        int changed = jdbc.update("update batting_entry set runs = 999, balls = 500 where result_player_id in ("
                + "select rp.id from result_player rp join match_result r on r.id = rp.match_result_id"
                + " where r.match_id = ?)", seed.draftMatch.getId());
        jdbc.update("update match_innings set runs = 999 where match_result_id in (select id from match_result"
                + " where match_id = ?)", seed.draftMatch.getId());
        assertThat(changed).as("the draft's batting row was found").isEqualTo(1);

        assertThat(json(getAs(admin, bob).andExpect(status().isOk()))).isEqualTo(before);
    }

    // ---- real unpublish and link routes ----

    @Test
    void unpublishingAndLinkingAGuestThroughTheResultRoutesChangesTheNextListRead() throws Exception {
        String bob = path(seed.bob.getId());
        String frank = path(seed.frank.getId());
        assertThat(json(getAs(admin, bob)).path("page").path("totalElements").asInt()).isEqualTo(4);
        assertThat(json(getAs(admin, frank)).path("page").path("totalElements").asInt()).isZero();

        mockMvc.perform(post(BASE + "/matches/{matchId}/result/unpublish", clubId, seed.unpublishMatch.getId())
                        .with(admin))
                .andExpect(status().isOk());
        mockMvc.perform(post(BASE + "/matches/{matchId}/result/players/{rp}/link", clubId, seed.guestMatch.getId(),
                                seed.garyRowResultPlayer)
                        .with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerProfileId\":\"" + seed.frank.getId() + "\"}"))
                .andExpect(status().isOk());

        assertThat(json(getAs(admin, bob)).path("page").path("totalElements").asInt()).isEqualTo(3);
        JsonNode frankAfter = json(getAs(admin, frank).andExpect(status().isOk()));
        assertThat(frankAfter.path("rows")).hasSize(1);
        assertThat(frankAfter.path("rows").get(0).path("batting").path("runs").asInt()).isEqualTo(77);
    }

    // ---- routing ----

    @Test
    void theMatchesRouteIsDistinctFromThePlayerStatsRoute() throws Exception {
        String stats = BASE + "/players/" + seed.alice.getId() + "/stats";

        assertThat(json(getAs(admin, stats)).has("batting")).isTrue();
        assertThat(json(getAs(admin, stats)).has("rows")).isFalse();
        JsonNode list = json(getAs(admin, stats + "/matches"));
        assertThat(list.has("rows")).isTrue();
        assertThat(list.has("batting")).isFalse();
        assertThat(json(getAs(admin, stats + "/filter-options")).has("seasonIds")).isTrue();
    }
}
