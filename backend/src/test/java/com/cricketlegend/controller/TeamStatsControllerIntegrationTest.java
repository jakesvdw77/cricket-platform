package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * docs/specs/116-team-stats.md, "Controller": the three team statistics routes through real HTTP against real Postgres.
 * Not {@code @Transactional}. The figures are checked in {@code TeamStatsIntegrationTest}; this class is about who may call,
 * what is refused, paging limits and routing.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class TeamStatsControllerIntegrationTest {

    private static final String BASE = "/api/v1/manage/clubs/{clubId}";
    private static final String TABLE = BASE + "/team-stats";
    private static final String OPTIONS = BASE + "/team-stats/filter-options";

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
        seed.seedTeamStats();
        clubId = seed.w.club().getId();
        admin = seed.fixtures.clubAdmin(seed.w);
        stranger = seed.fixtures.clubAdmin(seed.other);
    }

    @AfterEach
    void cleanUp() {
        seed.cleanUp();
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

    private String pagePath(UUID teamId) {
        return BASE + "/teams/" + teamId + "/stats";
    }

    private static List<String> teamNames(JsonNode table) {
        List<String> names = new ArrayList<>();
        table.path("rows").forEach(r -> names.add(r.path("teamName").asText()));
        return names;
    }

    // ---- access ----

    @Test
    void everyRouteRequiresAManagerOfTheClubAndRefusesAnotherClubsAdminAndSomeoneWithNoRole() throws Exception {
        JwtRequestPostProcessor nobody = seed.fixtures.nobody();
        for (String path : List.of(TABLE, OPTIONS, pagePath(seed.tsHawks.getId()))) {
            getAs(admin, path).andExpect(status().isOk());
            getAs(stranger, path).andExpect(status().isForbidden());
            getAs(nobody, path).andExpect(status().isForbidden());
            mockMvc.perform(get(path, clubId)).andExpect(status().isUnauthorized());
        }
    }

    // ---- 404 ----

    @Test
    void anUnknownOrOtherClubsTeamSeasonLeagueOrSectionIsNotFound() throws Exception {
        getAs(admin, pagePath(UUID.randomUUID())).andExpect(status().isNotFound());
        getAs(admin, pagePath(seed.other.seniors1().getId())).andExpect(status().isNotFound());
        getAs(admin, pagePath(seed.tsRivals.getId())).andExpect(status().isNotFound());

        List<String[]> unknown = List.of(
                new String[] {"seasonId", seed.other.season().getId().toString()},
                new String[] {"seasonId", UUID.randomUUID().toString()},
                new String[] {"leagueId", UUID.randomUUID().toString()});
        for (String[] filter : unknown) {
            getAs(admin, TABLE, filter[0], filter[1]).andExpect(status().isNotFound());
            getAs(admin, pagePath(seed.tsHawks.getId()), filter[0], filter[1]).andExpect(status().isNotFound());
        }
        getAs(admin, TABLE, "sectionId", seed.other.seniors().getId().toString()).andExpect(status().isNotFound());
        getAs(admin, TABLE, "sectionId", UUID.randomUUID().toString()).andExpect(status().isNotFound());
    }

    // ---- 400 ----

    @Test
    void badParametersAreRejectedWith400AndThePageSizeIsNeverClamped() throws Exception {
        String page = pagePath(seed.tsHawks.getId());

        getAs(admin, TABLE, "competition", "MIXED").andExpect(status().isBadRequest());
        getAs(admin, TABLE, "competition", "league").andExpect(status().isBadRequest());
        getAs(admin, page, "competition", "MIXED").andExpect(status().isBadRequest());
        getAs(admin, TABLE, "sort", "bogus").andExpect(status().isBadRequest());
        getAs(admin, TABLE, "sort", "lowTotal").andExpect(status().isBadRequest());
        getAs(admin, TABLE, "direction", "up").andExpect(status().isBadRequest());
        getAs(admin, TABLE, "sort", "runRate", "minimum", "-1").andExpect(status().isBadRequest());
        getAs(admin, TABLE, "sort", "runRate", "minimum", "abc").andExpect(status().isBadRequest());
        getAs(admin, TABLE, "page", "-1").andExpect(status().isBadRequest());
        getAs(admin, TABLE, "page", "abc").andExpect(status().isBadRequest());
        getAs(admin, TABLE, "size", "0").andExpect(status().isBadRequest());
        getAs(admin, TABLE, "size", "101").andExpect(status().isBadRequest());
        getAs(admin, TABLE, "size", "500").andExpect(status().isBadRequest());
        getAs(admin, TABLE, "seasonId", "not-a-uuid").andExpect(status().isBadRequest());

        // the well-formed neighbours are accepted
        getAs(admin, TABLE, "size", "100").andExpect(status().isOk());
        getAs(admin, TABLE, "size", "1").andExpect(status().isOk());
        getAs(admin, TABLE, "direction", "asc").andExpect(status().isOk());
        getAs(admin, TABLE, "sort", "runRate", "minimum", "0").andExpect(status().isOk());
        getAs(admin, TABLE, "sort", "won", "minimum", "5").andExpect(status().isOk());
        getAs(admin, TABLE, "competition", "FRIENDLY").andExpect(status().isOk());
    }

    @Test
    void thePageSizeDefaultsToTwentyFiveAndPagingSlicesTheRanking() throws Exception {
        JsonNode defaults = json(getAs(admin, TABLE).andExpect(status().isOk()));
        assertThat(defaults.path("page").path("size").asInt()).isEqualTo(25);
        assertThat(defaults.path("sort").path("code").asText()).isEqualTo("won");
        assertThat(defaults.path("columns").size()).isEqualTo(15);
        int total = defaults.path("page").path("totalElements").asInt();
        assertThat(total).isGreaterThanOrEqualTo(5);

        JsonNode full = json(getAs(admin, TABLE, "size", "100").andExpect(status().isOk()));
        assertThat(full.path("page").path("size").asInt()).isEqualTo(100);
        assertThat(full.path("rows")).hasSize(total);

        JsonNode first = json(getAs(admin, TABLE, "size", "2", "page", "0").andExpect(status().isOk()));
        JsonNode second = json(getAs(admin, TABLE, "size", "2", "page", "1").andExpect(status().isOk()));
        assertThat(first.path("rows")).hasSize(2);
        assertThat(first.path("page").path("hasMore").asBoolean()).isTrue();
        assertThat(teamNames(first)).isEqualTo(teamNames(full).subList(0, 2));
        assertThat(teamNames(second)).isEqualTo(teamNames(full).subList(2, 4));
        JsonNode past = json(getAs(admin, TABLE, "size", "2", "page", "500").andExpect(status().isOk()));
        assertThat(past.path("rows")).isEmpty();
    }

    // ---- section-scoped managers ----

    @Test
    void aSectionScopedManagerIsNarrowedToTheirSectionsAndRefusedOtherSections() throws Exception {
        JwtRequestPostProcessor juniors = seed.fixtures.sectionManager(seed.w.juniors());
        JwtRequestPostProcessor seniors = seed.fixtures.sectionManager(seed.w.seniors());

        List<String> junior = teamNames(json(getAs(juniors, TABLE).andExpect(status().isOk())));
        assertThat(junior).contains("TS Swifts").doesNotContain("TS Hawks", "TS Kites", "TS Owls", "TS Doves");
        List<String> senior = teamNames(json(getAs(seniors, TABLE).andExpect(status().isOk())));
        assertThat(senior).contains("TS Hawks", "TS Kites", "TS Owls").doesNotContain("TS Swifts");

        getAs(juniors, TABLE, "sectionId", seed.w.seniors().getId().toString()).andExpect(status().isForbidden());
        getAs(juniors, TABLE, "sectionId", seed.seniorsA.getId().toString()).andExpect(status().isForbidden());
        getAs(juniors, TABLE, "sectionId", seed.w.juniors().getId().toString()).andExpect(status().isOk());
        getAs(seniors, TABLE, "sectionId", seed.w.juniors().getId().toString()).andExpect(status().isForbidden());
        getAs(seniors, TABLE, "sectionId", seed.seniorsA1.getId().toString()).andExpect(status().isOk());

        getAs(juniors, pagePath(seed.tsHawks.getId())).andExpect(status().isForbidden());
        getAs(juniors, pagePath(seed.tsKites.getId())).andExpect(status().isForbidden());
        getAs(juniors, pagePath(seed.tsSwifts.getId())).andExpect(status().isOk());
        getAs(seniors, pagePath(seed.tsHawks.getId())).andExpect(status().isOk());
        getAs(seniors, pagePath(seed.tsSwifts.getId())).andExpect(status().isForbidden());

        JsonNode options = json(getAs(juniors, OPTIONS).andExpect(status().isOk()));
        List<String> sections = new ArrayList<>();
        options.path("sectionIds").forEach(n -> sections.add(n.asText()));
        assertThat(sections).containsExactly(seed.w.juniors().getId().toString());
    }

    // ---- empty and draft ----

    @Test
    void aTeamWithNoResultIs200WithZeroCounters() throws Exception {
        JsonNode wrens = json(getAs(admin, pagePath(seed.tsWrens.getId())).andExpect(status().isOk()));

        assertThat(wrens.path("teamId").asText()).isEqualTo(seed.tsWrens.getId().toString());
        assertThat(wrens.path("scope").path("kind").asText()).isEqualTo("CLUB_VERIFIED");
        assertThat(wrens.path("basis").path("resultsCounted").asInt()).isZero();
        assertThat(wrens.path("record").path("played").asInt()).isZero();
        assertThat(wrens.path("record").path("winPercent").isNull()).isTrue();
        assertThat(wrens.path("batting").path("runRate").isNull()).isTrue();
        assertThat(wrens.path("batting").path("highestTotal").isNull()).isTrue();
        assertThat(wrens.path("bowling").path("economy").isNull()).isTrue();
        assertThat(wrens.path("form")).isEmpty();
        assertThat(wrens.path("netRunRate").path("status").asText()).isEqualTo("NO_USABLE_RESULTS");
        assertThat(wrens.path("notCaptured").size()).isPositive();
    }

    @Test
    void theResponsesNeverChangeWhenOnlyADraftChanges() throws Exception {
        String hawks = pagePath(seed.tsHawks.getId());
        JsonNode pageBefore = json(getAs(admin, hawks).andExpect(status().isOk()));
        JsonNode tableBefore = json(getAs(admin, TABLE, "size", "100").andExpect(status().isOk()));
        JsonNode optionsBefore = json(getAs(admin, OPTIONS).andExpect(status().isOk()));

        var match = seed.match(seed.tsHawks, null, seed.s1, seed.l1, true);
        var draft = seed.result(match, "DRAFT", "WON", "HOME");
        draft.set(1, "HOME", 999, 0, 120, false);
        draft.decide("REGULAR", "RUNS", 99, 120, 6);

        assertThat(json(getAs(admin, hawks).andExpect(status().isOk()))).isEqualTo(pageBefore);
        assertThat(json(getAs(admin, TABLE, "size", "100").andExpect(status().isOk()))).isEqualTo(tableBefore);
        assertThat(json(getAs(admin, OPTIONS).andExpect(status().isOk()))).isEqualTo(optionsBefore);
    }

    // ---- real unpublish route ----

    @Test
    void unpublishingThroughTheResultRouteChangesTheNextTeamStatsRead() throws Exception {
        String hawks = pagePath(seed.tsHawks.getId());
        assertThat(json(getAs(admin, hawks)).path("record").path("played").asInt()).isEqualTo(16);

        mockMvc.perform(post(BASE + "/matches/{matchId}/result/unpublish", clubId, seed.tsMatches.get("H1").getId())
                        .with(admin))
                .andExpect(status().isOk());

        JsonNode after = json(getAs(admin, hawks).andExpect(status().isOk()));
        assertThat(after.path("record").path("played").asInt()).isEqualTo(15);
        assertThat(after.path("record").path("won").asInt()).isEqualTo(10);
        JsonNode table = json(getAs(admin, TABLE, "size", "100"));
        for (JsonNode row : table.path("rows")) {
            if (seed.tsHawks.getId().toString().equals(row.path("teamId").asText())) {
                assertThat(row.path("values").path("played").path("value").asInt()).isEqualTo(15);
            }
        }
    }

    // ---- routing ----

    @Test
    void theLiteralFilterOptionsRouteIsNotSwallowedAndTheThreeRoutesAreDistinct() throws Exception {
        JsonNode options = json(getAs(admin, OPTIONS).andExpect(status().isOk()));
        assertThat(options.has("seasonIds")).isTrue();
        assertThat(options.has("competitions")).isTrue();
        assertThat(options.has("rows")).isFalse();

        JsonNode table = json(getAs(admin, TABLE).andExpect(status().isOk()));
        assertThat(table.has("rows")).isTrue();
        assertThat(table.has("seasonIds")).isFalse();

        JsonNode page = json(getAs(admin, pagePath(seed.tsHawks.getId())).andExpect(status().isOk()));
        assertThat(page.has("record")).isTrue();
        assertThat(page.has("rows")).isFalse();
    }
}
