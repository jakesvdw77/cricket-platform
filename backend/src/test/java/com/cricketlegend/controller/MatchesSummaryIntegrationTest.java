package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.PlatformRoleJwtPostProcessors;
import com.cricketlegend.domain.Match;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * docs/specs/087-matches-polls-alignment.md (slice 4): the Matches counters ({@code GET /matches/summary}) and the
 * list's {@code focus} and {@code teamId} parameters, through real HTTP against real Postgres. Proves the
 * definitions (this week, teams not announced, without a poll), that each counter equals the list's
 * {@code totalElements} for the same filters, section scoping, the other-club 403 and the 400 on a bad {@code focus}.
 * Not {@code @Transactional}; {@link ManagerOverviewFixtures} removes what it seeds.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MatchesSummaryIntegrationTest {

    private static final String SUMMARY = "/api/v1/manage/clubs/{clubId}/matches/summary";
    private static final String LIST = "/api/v1/manage/clubs/{clubId}/matches";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    private ManagerOverviewFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private record Seeded(World w, World other, Set<UUID> ids) {
    }

    /**
     * Seniors matches A..G and one Juniors match H. Upcoming, active, own side: A (announced, squad poll), B (nothing),
     * C (derby, only one side announced, group poll, outside the week), G (closed squad poll). D has only another
     * club's team; E is inactive; F is in the past.
     */
    private Seeded seed() {
        World w = fixtures.world();
        World other = fixtures.world();
        Instant now = Instant.now();
        Match a = fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(2)));
        fixtures.side(a, w.seniors1(), true);
        fixtures.squadPoll(a, w.seniors1(), null);
        fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(3))); // B
        Match c = fixtures.match(w, w.seniors1(), w.seniors2(), now.plus(Duration.ofDays(10)));
        fixtures.side(c, w.seniors1(), true);
        fixtures.side(c, w.seniors2(), false);
        fixtures.linkMatch(fixtures.groupPoll(w, w.seniors(), null), c);
        fixtures.match(w, other.seniors1(), null, now.plus(Duration.ofDays(4))); // D: no own side
        fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(2)), false, null); // E: inactive
        fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(3))); // F: past
        Match g = fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(6)));
        fixtures.closeSquadPoll(fixtures.squadPoll(g, w.seniors1(), null));
        fixtures.match(w, w.juniorsTeam(), null, now.plus(Duration.ofDays(3))); // H
        return new Seeded(w, other, new HashSet<>());
    }

    private JsonNode summary(JwtRequestPostProcessor caller, UUID clubId, String... params) throws Exception {
        String body = mockMvc.perform(request(SUMMARY, clubId, caller, params))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(body);
    }

    private long listTotal(JwtRequestPostProcessor caller, UUID clubId, String... params) throws Exception {
        String body = mockMvc.perform(request(LIST, clubId, caller, params).param("size", "1"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(body).path("totalElements").asLong();
    }

    private MockHttpServletRequestBuilder request(String url, UUID clubId, JwtRequestPostProcessor caller, String... params) {
        MockHttpServletRequestBuilder request = get(url, clubId).with(caller);
        for (int i = 0; i < params.length; i += 2) {
            request = request.param(params[i], params[i + 1]);
        }
        return request;
    }

    @Test
    void countsTheDefinitionsForAClubAdmin() throws Exception {
        Seeded s = seed();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(s.w());

        JsonNode upcoming = summary(admin, s.w().club().getId());
        // A, B, C, D, E (inactive matches are listed), G, H; the past match F is not
        assertThat(upcoming.path("matchesShown").asLong()).isEqualTo(7);
        // active, upcoming, within seven days: A, B, D, G, H (C is in ten days, E inactive)
        assertThat(upcoming.path("thisWeek").asLong()).isEqualTo(5);
        // an own side not announced: B, C (Villagers 2), G, H
        assertThat(upcoming.path("teamsNotAnnounced").asLong()).isEqualTo(4);
        // own side and no poll of any kind: B and H (C has a group poll, A and G a squad poll, D has no own side)
        assertThat(upcoming.path("withoutPoll").asLong()).isEqualTo(2);

        JsonNode withPast = summary(admin, s.w().club().getId(), "includePast", "true");
        assertThat(withPast.path("matchesShown").asLong()).isEqualTo(8);
        assertThat(withPast.path("thisWeek").asLong()).isEqualTo(5);
        assertThat(withPast.path("teamsNotAnnounced").asLong()).isEqualTo(4);
    }

    @Test
    void eachCounterEqualsTheListTotalForTheSameFilters() throws Exception {
        Seeded s = seed();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(s.w());
        UUID clubId = s.w().club().getId();
        String seniors = s.w().seniors().getId().toString();
        String juniors = s.w().juniors().getId().toString();
        String team = s.w().seniors2().getId().toString();

        String[][] filters = {
            {},
            {"sectionId", seniors},
            {"sectionId", juniors},
            {"teamId", team},
            {"teamId", s.w().seniors1().getId().toString()},
            {"search", "villagers"},
            {"sectionId", seniors, "search", "villagers 2"},
        };
        for (String[] filter : filters) {
            for (boolean includePast : new boolean[] {false, true}) {
                String[] summaryParams = withExtra(filter, "includePast", String.valueOf(includePast));
                String[] listParams = withExtra(filter, "upcomingOnly", String.valueOf(!includePast));
                JsonNode counters = summary(admin, clubId, summaryParams);

                assertThat(listTotal(admin, clubId, listParams)).as("shown %s %s", String.join(",", filter), includePast)
                        .isEqualTo(counters.path("matchesShown").asLong());
                assertThat(listTotal(admin, clubId, withExtra(listParams, "focus", "this-week")))
                        .as("this-week %s %s", String.join(",", filter), includePast)
                        .isEqualTo(counters.path("thisWeek").asLong());
                assertThat(listTotal(admin, clubId, withExtra(listParams, "focus", "not-announced")))
                        .as("not-announced %s %s", String.join(",", filter), includePast)
                        .isEqualTo(counters.path("teamsNotAnnounced").asLong());
                assertThat(listTotal(admin, clubId, withExtra(listParams, "focus", "no-poll")))
                        .as("no-poll %s %s", String.join(",", filter), includePast)
                        .isEqualTo(counters.path("withoutPoll").asLong());
            }
        }
    }

    private static String[] withExtra(String[] base, String... extra) {
        String[] merged = new String[base.length + extra.length];
        System.arraycopy(base, 0, merged, 0, base.length);
        System.arraycopy(extra, 0, merged, base.length, extra.length);
        return merged;
    }

    @Test
    void aSectionManagerOnlySeesTheirOwnSectionsInTheCountersAndTheList() throws Exception {
        Seeded s = seed();
        UUID clubId = s.w().club().getId();

        JsonNode juniors = summary(fixtures.sectionManager(s.w().juniors()), clubId);
        assertThat(juniors.path("matchesShown").asLong()).isEqualTo(1);
        assertThat(juniors.path("thisWeek").asLong()).isEqualTo(1);
        assertThat(juniors.path("teamsNotAnnounced").asLong()).isEqualTo(1);
        assertThat(juniors.path("withoutPoll").asLong()).isEqualTo(1);

        JsonNode seniors = summary(fixtures.sectionManager(s.w().seniors()), clubId);
        // A, B, C, E, G: the Juniors match and the other club's team are out of scope
        assertThat(seniors.path("matchesShown").asLong()).isEqualTo(5);
        assertThat(seniors.path("teamsNotAnnounced").asLong()).isEqualTo(3);
        assertThat(seniors.path("withoutPoll").asLong()).isEqualTo(1);

        JwtRequestPostProcessor juniorsManager = fixtures.sectionManager(s.w().juniors());
        assertThat(listTotal(juniorsManager, clubId, "focus", "no-poll")).isEqualTo(1);
    }

    @Test
    void anotherClubsAdminIsForbidden() throws Exception {
        Seeded s = seed();

        mockMvc.perform(request(SUMMARY, s.w().club().getId(), fixtures.clubAdmin(s.other())))
                .andExpect(status().isForbidden());
        mockMvc.perform(request(LIST, s.w().club().getId(), fixtures.clubAdmin(s.other()), "focus", "no-poll"))
                .andExpect(status().isForbidden());
    }

    @Test
    void aPlatformAdminCanReadTheSummary() throws Exception {
        Seeded s = seed();

        mockMvc.perform(request(SUMMARY, s.w().club().getId(), PlatformRoleJwtPostProcessors.platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchesShown").value(7));
    }

    @Test
    void aBadFocusIsA400AndAMissingOneMeansNone() throws Exception {
        Seeded s = seed();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(s.w());
        UUID clubId = s.w().club().getId();

        mockMvc.perform(request(LIST, clubId, admin, "focus", "everything")).andExpect(status().isBadRequest());
        // any case and surrounding blanks are accepted
        assertThat(listTotal(admin, clubId, "upcomingOnly", "true", "focus", " No-Poll ")).isEqualTo(2);
        assertThat(listTotal(admin, clubId, "upcomingOnly", "true", "focus", "")).isEqualTo(7);
    }

    @Test
    void teamIdNarrowsTheListToMatchesWithThatTeamOnEitherSideAndFilterOptionsIgnoreItsOwnPick() throws Exception {
        Seeded s = seed();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(s.w());
        UUID clubId = s.w().club().getId();
        String seniors2 = s.w().seniors2().getId().toString();

        // only the derby C has Villagers 2
        assertThat(listTotal(admin, clubId, "teamId", seniors2)).isEqualTo(1);
        // Villagers 1 is home in every Seniors match and in C (home), A, B, E, F, G
        assertThat(listTotal(admin, clubId, "teamId", s.w().seniors1().getId().toString(), "upcomingOnly", "false"))
                .isEqualTo(6);

        String options = mockMvc.perform(request(LIST + "/filter-options", clubId, admin, "teamId", seniors2))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode json = objectMapper.readTree(options);
        // teamIds ignores the team pick: both derby teams and the others stay offered
        Set<String> teamIds = new HashSet<>();
        json.path("teamIds").forEach(node -> teamIds.add(node.asText()));
        assertThat(teamIds).contains(seniors2, s.w().seniors1().getId().toString());
        // the section array does follow the pick: Villagers 2's match is a Seniors one
        assertThat(json.path("sectionIds")).hasSize(1);
        assertThat(json.path("sectionIds").get(0).asText()).isEqualTo(s.w().seniors().getId().toString());
    }
}
