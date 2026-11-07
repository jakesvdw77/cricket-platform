package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.TossDecision;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
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
 * docs/specs/145 Decision 2 (as amended: a published result shows in the Player Hub by default, with a publish-time
 * control), the manager side through real HTTP against real Postgres: {@code ResultServiceImpl.setPlayerVisibility}
 * (a draft is a 409, a published result can be shown and hidden, hiding clears who and when, unpublishing clears the
 * flag), publish with and without {@code showInPlayerHub}, the two {@code player-visibility} endpoints and their club
 * and section authorisation. Not {@code @Transactional}; {@link ManagerOverviewFixtures} removes what it seeds.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class ResultPlayerVisibilityIntegrationTest {

    private static final String RESULT = "/api/v1/manage/clubs/{clubId}/matches/{matchId}/result";
    private static final String VISIBILITY = RESULT + "/player-visibility";

    @Autowired private MockMvc mockMvc;
    @Autowired private ApplicationContext context;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JdbcTemplate jdbc;

    private ManagerOverviewFixtures fixtures;
    private World w;
    private JwtRequestPostProcessor admin;
    private UUID clubId;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
        w = fixtures.world();
        admin = fixtures.clubAdmin(w);
        clubId = w.club().getId();
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    // ---- helpers ----

    private static InningsDto inn(ResultSide side, int runs, int wickets) {
        return new InningsDto(null, null, side, runs, wickets, 120, null, null, null);
    }

    private static ResultDraft homeWinByRuns() {
        return new ResultDraft(ResultOutcomeType.WON, null, ResultSide.HOME, ResultMarginType.RUNS, 50, null, null, null,
                null, ResultSide.HOME, TossDecision.BAT, null, null,
                List.of(inn(ResultSide.HOME, 200, 8), inn(ResultSide.AWAY, 150, 10)));
    }

    private Match match(Match... unused) {
        return fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(1)));
    }

    private void draft(JwtRequestPostProcessor caller, Match match) throws Exception {
        mockMvc.perform(put(RESULT, clubId, match.getId()).with(caller).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(homeWinByRuns()))).andExpect(status().isOk());
    }

    private ResultActions publish(JwtRequestPostProcessor caller, Match match, String body) throws Exception {
        var request = post(RESULT + "/publish", clubId, match.getId()).with(caller);
        if (body != null) {
            request = request.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        return mockMvc.perform(request);
    }

    private Match publishedMatch(String publishBody) throws Exception {
        Match match = match();
        draft(admin, match);
        publish(admin, match, publishBody).andExpect(status().isOk());
        return match;
    }

    private Map<String, Object> columns(Match match) {
        return jdbc.queryForMap("select status, visible_to_players, visible_to_players_at, visible_to_players_by, published_by"
                + " from match_result where match_id = ?", match.getId());
    }

    private ResultActions show(JwtRequestPostProcessor caller, UUID club, UUID matchId) throws Exception {
        return mockMvc.perform(post(VISIBILITY, club, matchId).with(caller));
    }

    private ResultActions hide(JwtRequestPostProcessor caller, UUID club, UUID matchId) throws Exception {
        return mockMvc.perform(delete(VISIBILITY, club, matchId).with(caller));
    }

    // ---- publish ----

    @Test
    void aPlainPublishShowsTheResultInThePlayerHubAndRecordsWhoAndWhen() throws Exception {
        for (String body : new String[] {null, "{\"acknowledgedWarnings\":false}", "{\"acknowledgedWarnings\":false,\"showInPlayerHub\":true}"}) {
            Match match = publishedMatch(body);
            Map<String, Object> row = columns(match);
            assertThat(row.get("status")).as("body " + body).isEqualTo("PUBLISHED");
            assertThat(row.get("visible_to_players")).as("body " + body).isEqualTo(true);
            assertThat(row.get("visible_to_players_at")).isNotNull();
            assertThat(row.get("visible_to_players_by")).isNotNull().isEqualTo(row.get("published_by"));
        }
    }

    @Test
    void publishingWithShowInPlayerHubFalseLeavesTheResultOutOfThePlayerHub() throws Exception {
        Match match = match();
        draft(admin, match);

        publish(admin, match, "{\"acknowledgedWarnings\":false,\"showInPlayerHub\":false}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.visibleToPlayers").value(false));

        Map<String, Object> row = columns(match);
        assertThat(row.get("visible_to_players")).isEqualTo(false);
        assertThat(row.get("visible_to_players_at")).isNull();
        assertThat(row.get("visible_to_players_by")).isNull();
        mockMvc.perform(get(RESULT, clubId, match.getId()).with(admin)).andExpect(jsonPath("$.visibleToPlayers").value(false));
    }

    @Test
    void aDraftIsNeverVisibleToPlayers() throws Exception {
        Match match = match();
        draft(admin, match);

        mockMvc.perform(get(RESULT, clubId, match.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.visibleToPlayers").value(false));
        assertThat(columns(match).get("visible_to_players")).isEqualTo(false);
    }

    // ---- setPlayerVisibility ----

    @Test
    void aDraftCannotBeShownOrHiddenAndNothingChanges() throws Exception {
        Match match = match();
        draft(admin, match);

        show(admin, clubId, match.getId()).andExpect(status().isConflict());
        hide(admin, clubId, match.getId()).andExpect(status().isConflict());

        Map<String, Object> row = columns(match);
        assertThat(row.get("status")).isEqualTo("DRAFT");
        assertThat(row.get("visible_to_players")).isEqualTo(false);
        assertThat(row.get("visible_to_players_at")).isNull();
        assertThat(row.get("visible_to_players_by")).isNull();
    }

    @Test
    void aMatchWithNoResultIsNotFound() throws Exception {
        Match match = match();

        show(admin, clubId, match.getId()).andExpect(status().isNotFound());
        hide(admin, clubId, match.getId()).andExpect(status().isNotFound());
        show(admin, clubId, UUID.randomUUID()).andExpect(status().isNotFound());
    }

    @Test
    void aPublishedResultCanBeHiddenAndShownAgainAndHidingClearsWhoAndWhen() throws Exception {
        Match match = publishedMatch("{\"acknowledgedWarnings\":false,\"showInPlayerHub\":false}");

        show(admin, clubId, match.getId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visibleToPlayers").value(true))
                .andExpect(jsonPath("$.status").value("PUBLISHED"));
        Map<String, Object> shown = columns(match);
        assertThat(shown.get("visible_to_players")).isEqualTo(true);
        assertThat(shown.get("visible_to_players_at")).isNotNull();
        assertThat(shown.get("visible_to_players_by")).isNotNull();
        show(admin, clubId, match.getId()).andExpect(status().isOk()); // showing again is harmless

        hide(admin, clubId, match.getId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visibleToPlayers").value(false))
                .andExpect(jsonPath("$.status").value("PUBLISHED"));
        Map<String, Object> hidden = columns(match);
        assertThat(hidden.get("visible_to_players")).isEqualTo(false);
        assertThat(hidden.get("visible_to_players_at")).isNull();
        assertThat(hidden.get("visible_to_players_by")).isNull();
        assertThat(hidden.get("status")).as("hiding is not unpublishing").isEqualTo("PUBLISHED");
        hide(admin, clubId, match.getId()).andExpect(status().isOk());
    }

    @Test
    void unpublishingClearsTheFlagAndRepublishingStartsFromThePublishChoice() throws Exception {
        Match match = publishedMatch(null);
        assertThat(columns(match).get("visible_to_players")).isEqualTo(true);

        mockMvc.perform(post(RESULT + "/unpublish", clubId, match.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.visibleToPlayers").value(false));
        Map<String, Object> row = columns(match);
        assertThat(row.get("visible_to_players")).isEqualTo(false);
        assertThat(row.get("visible_to_players_at")).isNull();
        assertThat(row.get("visible_to_players_by")).isNull();
        show(admin, clubId, match.getId()).andExpect(status().isConflict()); // a draft again

        publish(admin, match, "{\"acknowledgedWarnings\":false,\"showInPlayerHub\":false}").andExpect(status().isOk());
        assertThat(columns(match).get("visible_to_players")).isEqualTo(false);
    }

    // ---- authorisation ----

    @Test
    void aManagerOfAnotherClubIsDeniedAndNothingChanges() throws Exception {
        Match match = publishedMatch(null);
        World other = fixtures.world();
        JwtRequestPostProcessor outsider = fixtures.clubAdmin(other);

        show(outsider, clubId, match.getId()).andExpect(status().isForbidden());
        hide(outsider, clubId, match.getId()).andExpect(status().isForbidden());
        assertThat(columns(match).get("visible_to_players")).isEqualTo(true);

        // using their own club's URL for this club's match is a not found, never a change
        hide(outsider, other.club().getId(), match.getId()).andExpect(status().isNotFound());
        show(outsider, other.club().getId(), match.getId()).andExpect(status().isNotFound());
        assertThat(columns(match).get("visible_to_players")).isEqualTo(true);
    }

    @Test
    void noLoginIsA401() throws Exception {
        Match match = publishedMatch(null);

        mockMvc.perform(post(VISIBILITY, clubId, match.getId())).andExpect(status().isUnauthorized());
        mockMvc.perform(delete(VISIBILITY, clubId, match.getId())).andExpect(status().isUnauthorized());
        assertThat(columns(match).get("visible_to_players")).isEqualTo(true);
    }

    @Test
    void aSectionManagerMayChangeOnlyTheirOwnSectionsResults() throws Exception {
        Match seniors = publishedMatch(null);
        Match juniors = fixtures.match(w, w.juniorsTeam(), null, Instant.now().minus(Duration.ofDays(2)));
        draft(admin, juniors);
        publish(admin, juniors, null).andExpect(status().isOk());
        JwtRequestPostProcessor juniorsManager = fixtures.sectionManager(w.juniors());

        hide(juniorsManager, clubId, seniors.getId()).andExpect(status().isForbidden());
        show(juniorsManager, clubId, seniors.getId()).andExpect(status().isForbidden());
        assertThat(columns(seniors).get("visible_to_players")).isEqualTo(true);

        hide(juniorsManager, clubId, juniors.getId()).andExpect(status().isOk());
        assertThat(columns(juniors).get("visible_to_players")).isEqualTo(false);
        show(juniorsManager, clubId, juniors.getId()).andExpect(status().isOk());
        assertThat(columns(juniors).get("visible_to_players")).isEqualTo(true);
        assertThat(columns(juniors).get("visible_to_players_by")).isNotNull();
    }
}
