package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultMarginType;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * docs/specs/100-match-results-core.md, through real HTTP against real Postgres: capture, upsert replace, the publish
 * gate, one result per match, the awaiting list, the Results list filters and paging, the counters (including a match
 * between two of the club's own sides), {@code resultStatus} on the Matches list and filter, tenancy and section
 * narrowing. Not {@code @Transactional}; {@link ManagerOverviewFixtures} removes what it seeds, results included.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class ResultsIntegrationTest {

    private static final String BASE = "/api/v1/manage/clubs/{clubId}";
    private static final String RESULTS = BASE + "/results";
    private static final String RESULT = BASE + "/matches/{matchId}/result";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbc;

    private ManagerOverviewFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    // ---- drafts ----

    private static InningsDto inn(ResultSide side, int runs, int wickets) {
        return new InningsDto(null, null, side, runs, wickets, 120, null, null, null);
    }

    private static ResultDraft homeWinByRuns() {
        return new ResultDraft(ResultOutcomeType.WON, null, ResultSide.HOME, ResultMarginType.RUNS, 50, null, null, null,
                null, ResultSide.HOME, com.cricketlegend.domain.TossDecision.BAT, null, null,
                List.of(inn(ResultSide.HOME, 200, 8), inn(ResultSide.AWAY, 150, 10)));
    }

    private static ResultDraft awayWinByWickets() {
        return new ResultDraft(ResultOutcomeType.WON, null, ResultSide.AWAY, ResultMarginType.WICKETS, 7, null, null,
                null, null, null, null, null, null, List.of(inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 151, 3)));
    }

    private static ResultDraft tie() {
        return new ResultDraft(ResultOutcomeType.TIE, null, null, null, null, null, null, null, null, null, null, null,
                null, List.of(inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 150, 8)));
    }

    private static ResultDraft forfeitWonByHome() {
        return new ResultDraft(ResultOutcomeType.FORFEIT, null, ResultSide.HOME, null, null, null, null, null, null,
                null, null, null, null, null);
    }

    private static ResultDraft superOverTie() {
        return new ResultDraft(ResultOutcomeType.WON, ResultDecidedBy.SUPER_OVER, ResultSide.AWAY, null, null, null,
                null, null, null, null, null, null, null,
                List.of(inn(ResultSide.HOME, 150, 10), inn(ResultSide.AWAY, 150, 9),
                        new InningsDto(3, InningsKind.SUPER_OVER, ResultSide.HOME, 8, 1, 6, null, null, null),
                        new InningsDto(4, InningsKind.SUPER_OVER, ResultSide.AWAY, 12, 0, 6, null, null, null)));
    }

    // ---- request helpers ----

    private MockHttpServletRequestBuilder with(MockHttpServletRequestBuilder b, JwtRequestPostProcessor caller, String... params) {
        MockHttpServletRequestBuilder request = b.with(caller);
        for (int i = 0; i < params.length; i += 2) {
            request = request.param(params[i], params[i + 1]);
        }
        return request;
    }

    private JsonNode json(org.springframework.test.web.servlet.ResultActions actions) throws Exception {
        return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private org.springframework.test.web.servlet.ResultActions putResult(
            JwtRequestPostProcessor caller, UUID clubId, UUID matchId, ResultDraft draft) throws Exception {
        return mockMvc.perform(put(RESULT, clubId, matchId).with(caller).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(draft)));
    }

    private org.springframework.test.web.servlet.ResultActions publish(
            JwtRequestPostProcessor caller, UUID clubId, UUID matchId, boolean acknowledge) throws Exception {
        return mockMvc.perform(post(RESULT + "/publish", clubId, matchId).with(caller)
                .contentType(MediaType.APPLICATION_JSON).content("{\"acknowledgedWarnings\":" + acknowledge + "}"));
    }

    private void capture(JwtRequestPostProcessor admin, UUID clubId, Match match, ResultDraft draft, boolean publish)
            throws Exception {
        putResult(admin, clubId, match.getId(), draft).andExpect(status().isOk());
        if (publish) {
            publish(admin, clubId, match.getId(), false).andExpect(status().isOk());
        }
    }

    private JsonNode page(JwtRequestPostProcessor caller, String url, UUID clubId, String... params) throws Exception {
        return json(mockMvc.perform(with(get(url, clubId), caller, params)).andExpect(status().isOk()));
    }

    private long total(JwtRequestPostProcessor caller, String url, UUID clubId, String... params) throws Exception {
        String[] withSize = new String[params.length + 2];
        System.arraycopy(params, 0, withSize, 0, params.length);
        withSize[params.length] = "size";
        withSize[params.length + 1] = "1";
        return page(caller, url, clubId, withSize).path("totalElements").asLong();
    }

    private List<String> ids(JsonNode page, String idPath) {
        List<String> ids = new ArrayList<>();
        page.path("content").forEach(n -> ids.add(n.at(idPath).asText()));
        return ids;
    }

    // ---- the seeded club ----

    private record Seed(World w, World other, Match m1, Match m2, Match m3, Match m4, Match m5, Match m6, Match m7,
            Match m8, Match m9, Match m10, JwtRequestPostProcessor admin) {
    }

    /**
     * m1 won by us (published), m2 a derby of two own sides won by the home side (published), m3 lost (published),
     * m4 tied (published), m5 a Juniors forfeit win (published), m6 a draft, m7 awaiting, m8 inactive, m9 upcoming,
     * m10 a Juniors match awaiting. Days are counted back from now so the order is m1 oldest.
     */
    private Seed seed() throws Exception {
        World w = fixtures.world();
        World other = fixtures.world();
        Instant now = Instant.now();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        UUID clubId = w.club().getId();
        Match m1 = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(10)));
        Match m2 = fixtures.match(w, w.seniors1(), w.seniors2(), now.minus(Duration.ofDays(9)));
        Match m3 = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(8)));
        Match m4 = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(7)));
        Match m5 = fixtures.match(w, w.juniorsTeam(), null, now.minus(Duration.ofDays(6)));
        Match m6 = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(5)));
        Match m7 = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(4)));
        Match m8 = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(3)), false, null);
        Match m9 = fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(3)));
        Match m10 = fixtures.match(w, w.juniorsTeam(), null, now.minus(Duration.ofDays(2)));
        capture(admin, clubId, m1, homeWinByRuns(), true);
        capture(admin, clubId, m2, homeWinByRuns(), true);
        capture(admin, clubId, m3, awayWinByWickets(), true);
        capture(admin, clubId, m4, tie(), true);
        capture(admin, clubId, m5, forfeitWonByHome(), true);
        capture(admin, clubId, m6, homeWinByRuns(), false);
        // another club's published result must never appear
        Match foreign = fixtures.match(other, other.seniors1(), null, now.minus(Duration.ofDays(5)));
        capture(fixtures.clubAdmin(other), other.club().getId(), foreign, homeWinByRuns(), true);
        return new Seed(w, other, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, admin);
    }

    // ---- capture, upsert, publish gate ----

    @Test
    void aSavedDraftIsManualAndReadsBackWithItsInningsInOrder() throws Exception {
        World w = fixtures.world();
        Match match = fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(1)));
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);

        putResult(admin, w.club().getId(), match.getId(), homeWinByRuns())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.source").value("MANUAL"))
                .andExpect(jsonPath("$.externalId").doesNotExist())
                .andExpect(jsonPath("$.innings.length()").value(2))
                .andExpect(jsonPath("$.innings[0].oversDisplay").value("20.0"));

        mockMvc.perform(get(RESULT, w.club().getId(), match.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcomeType").value("WON"))
                .andExpect(jsonPath("$.innings[0].sequence").value(1))
                .andExpect(jsonPath("$.innings[1].sequence").value(2));
    }

    @Test
    void resavingReplacesTheInningsAndNeverCreatesASecondResult() throws Exception {
        World w = fixtures.world();
        Match match = fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(1)));
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        UUID clubId = w.club().getId();

        putResult(admin, clubId, match.getId(), homeWinByRuns()).andExpect(status().isOk());
        putResult(admin, clubId, match.getId(), superOverTie()).andExpect(status().isOk())
                .andExpect(jsonPath("$.innings.length()").value(4));
        putResult(admin, clubId, match.getId(), tie()).andExpect(status().isOk())
                .andExpect(jsonPath("$.innings.length()").value(2));

        assertThat(jdbc.queryForObject(
                        "select count(*) from match_result where match_id = ?", Integer.class, match.getId()))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject(
                        "select count(*) from match_innings where match_result_id in"
                                + " (select id from match_result where match_id = ?)",
                        Integer.class, match.getId()))
                .isEqualTo(2);
    }

    @Test
    void superOversArePersistedInSequenceOrderWhateverOrderTheyAreSent() throws Exception {
        World w = fixtures.world();
        Match match = fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(1)));
        ResultDraft shuffled = new ResultDraft(ResultOutcomeType.WON, ResultDecidedBy.SUPER_OVER, ResultSide.AWAY, null,
                null, null, null, null, null, null, null, null, null,
                List.of(new InningsDto(4, null, ResultSide.AWAY, 12, 0, 6, null, null, null),
                        new InningsDto(2, null, ResultSide.AWAY, 150, 9, 120, null, null, null),
                        new InningsDto(3, null, ResultSide.HOME, 8, 1, 6, null, null, null),
                        new InningsDto(1, null, ResultSide.HOME, 150, 10, 120, null, null, null)));

        putResult(fixtures.clubAdmin(w), w.club().getId(), match.getId(), shuffled)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.innings[0].sequence").value(1))
                .andExpect(jsonPath("$.innings[1].sequence").value(2))
                .andExpect(jsonPath("$.innings[2].sequence").value(3))
                .andExpect(jsonPath("$.innings[2].kind").value("SUPER_OVER"))
                .andExpect(jsonPath("$.innings[3].sequence").value(4))
                .andExpect(jsonPath("$.innings[3].kind").value("SUPER_OVER"));
    }

    @Test
    void aStructurallyInvalidDraftIs400WithPlainEnglishErrorsAndNothingIsSaved() throws Exception {
        World w = fixtures.world();
        Match match = fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(1)));
        ResultDraft bad = new ResultDraft(ResultOutcomeType.WON, null, ResultSide.HOME, ResultMarginType.WICKETS, 12,
                null, null, null, null, null, null, null, null, null);

        putResult(fixtures.clubAdmin(w), w.club().getId(), match.getId(), bad)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0]").value("A win by wickets cannot be by more than 10 wickets."));
        assertThat(jdbc.queryForObject("select count(*) from match_result where match_id = ?", Integer.class,
                match.getId())).isZero();
    }

    @Test
    void publishIsRefusedForAnInvalidResultWithErrors() throws Exception {
        World w = fixtures.world();
        Match match = fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(1)));
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        ResultDraft incomplete = new ResultDraft(ResultOutcomeType.WON, null, null, null, null, null, null, null, null,
                null, null, null, null, null);
        putResult(admin, w.club().getId(), match.getId(), incomplete).andExpect(status().isOk());

        publish(admin, w.club().getId(), match.getId(), true)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@ == 'Choose which side won.')]").exists());
        mockMvc.perform(get(RESULT, w.club().getId(), match.getId()).with(admin))
                .andExpect(jsonPath("$.status").value("DRAFT"));
    }

    @Test
    void warningsNeedAcknowledgementThenPublishMarksTheMatchCompleted() throws Exception {
        World w = fixtures.world();
        Match match = fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(1)));
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        UUID clubId = w.club().getId();
        ResultDraft contradictory = new ResultDraft(ResultOutcomeType.WON, null, ResultSide.HOME, ResultMarginType.RUNS,
                40, null, null, null, null, null, null, null, null,
                List.of(inn(ResultSide.HOME, 200, 8), inn(ResultSide.AWAY, 150, 10)));
        putResult(admin, clubId, match.getId(), contradictory).andExpect(status().isOk());

        publish(admin, clubId, match.getId(), false)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.warnings[0]").value("The scores differ by 50 runs, but the margin is 40 runs."));
        assertThat(resultStatusOf(admin, clubId, match)).isEqualTo("DRAFT");

        publish(admin, clubId, match.getId(), true)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.publishedAt").exists());
        assertThat(resultStatusOf(admin, clubId, match)).isEqualTo("PUBLISHED");
    }

    @Test
    void aPublishedResultCannotBeEditedOrDeletedUntilUnpublished() throws Exception {
        World w = fixtures.world();
        Match match = fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(1)));
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        UUID clubId = w.club().getId();
        capture(admin, clubId, match, homeWinByRuns(), true);

        putResult(admin, clubId, match.getId(), tie()).andExpect(status().isConflict());
        mockMvc.perform(delete(RESULT, clubId, match.getId()).with(admin)).andExpect(status().isConflict());
        publish(admin, clubId, match.getId(), true).andExpect(status().isConflict());

        mockMvc.perform(post(RESULT + "/unpublish", clubId, match.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.publishedAt").doesNotExist());
        assertThat(resultStatusOf(admin, clubId, match)).isEqualTo("DRAFT");
        putResult(admin, clubId, match.getId(), tie()).andExpect(status().isOk());
        mockMvc.perform(delete(RESULT, clubId, match.getId()).with(admin)).andExpect(status().isNoContent());
        mockMvc.perform(get(RESULT, clubId, match.getId()).with(admin)).andExpect(status().isNotFound());
        assertThat(resultStatusOf(admin, clubId, match)).isEqualTo("NONE");
    }

    @Test
    void unpublishingADraftIsAConflict() throws Exception {
        World w = fixtures.world();
        Match match = fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(1)));
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        capture(admin, w.club().getId(), match, homeWinByRuns(), false);

        mockMvc.perform(post(RESULT + "/unpublish", w.club().getId(), match.getId()).with(admin))
                .andExpect(status().isConflict());
    }

    @Test
    void aFutureDatedMatchCanHaveAResultButAnInactiveOneCannot() throws Exception {
        World w = fixtures.world();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        Match future = fixtures.match(w, w.seniors1(), null, Instant.now().plus(Duration.ofDays(20)));
        Match inactive = fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(2)), false, null);

        putResult(admin, w.club().getId(), future.getId(), homeWinByRuns()).andExpect(status().isOk());
        putResult(admin, w.club().getId(), inactive.getId(), homeWinByRuns()).andExpect(status().isConflict());
    }

    @Test
    void validateIsADryRunThatWritesNothing() throws Exception {
        World w = fixtures.world();
        Match match = fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(1)));

        mockMvc.perform(post(RESULT + "/validate", w.club().getId(), match.getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(homeWinByRuns())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canPublish").value(true))
                .andExpect(jsonPath("$.errors.length()").value(0));
        assertThat(jdbc.queryForObject("select count(*) from match_result where match_id = ?", Integer.class,
                match.getId())).isZero();
    }

    // ---- resultStatus on the Matches list, filter and counters ----

    private String resultStatusOf(JwtRequestPostProcessor admin, UUID clubId, Match match) throws Exception {
        JsonNode list = page(admin, BASE + "/matches", clubId, "size", "100");
        for (JsonNode n : list.path("content")) {
            if (n.path("id").asText().equals(match.getId().toString())) {
                return n.path("resultStatus").asText();
            }
        }
        throw new AssertionError("match not in list");
    }

    @Test
    void theMatchesListCarriesResultStatusAndFiltersOnIt() throws Exception {
        Seed s = seed();
        UUID clubId = s.w().club().getId();
        String matches = BASE + "/matches";

        assertThat(resultStatusOf(s.admin(), clubId, s.m1())).isEqualTo("PUBLISHED");
        assertThat(resultStatusOf(s.admin(), clubId, s.m6())).isEqualTo("DRAFT");
        assertThat(resultStatusOf(s.admin(), clubId, s.m7())).isEqualTo("NONE");

        assertThat(total(s.admin(), matches, clubId, "resultStatus", "PUBLISHED")).isEqualTo(5);
        assertThat(total(s.admin(), matches, clubId, "resultStatus", "DRAFT")).isEqualTo(1);
        assertThat(total(s.admin(), matches, clubId, "resultStatus", "NONE")).isEqualTo(4);
        assertThat(total(s.admin(), matches, clubId)).isEqualTo(10);

        JsonNode summary = page(s.admin(), matches + "/summary", clubId, "includePast", "true", "resultStatus", "DRAFT");
        assertThat(summary.path("matchesShown").asLong()).isEqualTo(1);
    }

    // ---- awaiting ----

    @Test
    void awaitingListsOnlyActiveResultlessMatchesUpToTodayNewestFirst() throws Exception {
        Seed s = seed();
        UUID clubId = s.w().club().getId();

        JsonNode awaiting = page(s.admin(), RESULTS + "/awaiting", clubId);

        // m10 (-2d) then m7 (-4d); not m8 (inactive), not m9 (upcoming), not those with a draft or published result
        assertThat(ids(awaiting, "/id")).containsExactly(s.m10().getId().toString(), s.m7().getId().toString());
        assertThat(awaiting.path("totalElements").asLong()).isEqualTo(2);
    }

    @Test
    void awaitingWithIncludeUpcomingAddsFutureMatchesButStillExcludesInactiveOnes() throws Exception {
        Seed s = seed();
        JsonNode awaiting = page(s.admin(), RESULTS + "/awaiting", s.w().club().getId(), "includeUpcoming", "true");

        assertThat(ids(awaiting, "/id")).containsExactlyInAnyOrder(
                s.m10().getId().toString(), s.m7().getId().toString(), s.m9().getId().toString());
    }

    @Test
    void awaitingHonoursTheSectionAndTeamFilters() throws Exception {
        Seed s = seed();
        UUID clubId = s.w().club().getId();

        assertThat(ids(page(s.admin(), RESULTS + "/awaiting", clubId, "sectionId", s.w().juniors().getId().toString()),
                "/id")).containsExactly(s.m10().getId().toString());
        assertThat(ids(page(s.admin(), RESULTS + "/awaiting", clubId, "teamId", s.w().seniors1().getId().toString()),
                "/id")).containsExactly(s.m7().getId().toString());
    }

    @Test
    void capturingAMatchTakesItOffTheAwaitingList() throws Exception {
        Seed s = seed();
        UUID clubId = s.w().club().getId();

        putResult(s.admin(), clubId, s.m7().getId(), tie()).andExpect(status().isOk());

        assertThat(ids(page(s.admin(), RESULTS + "/awaiting", clubId), "/id"))
                .containsExactly(s.m10().getId().toString());
    }

    // ---- results list ----

    @Test
    void theResultsListHoldsOnlyMatchesWithAResultNewestFirstAndNeverAnotherClubs() throws Exception {
        Seed s = seed();
        JsonNode list = page(s.admin(), RESULTS, s.w().club().getId());

        assertThat(ids(list, "/match/id")).containsExactly(
                s.m6().getId().toString(), s.m5().getId().toString(), s.m4().getId().toString(),
                s.m3().getId().toString(), s.m2().getId().toString(), s.m1().getId().toString());
        assertThat(list.path("content").get(0).at("/result/status").asText()).isEqualTo("DRAFT");
        assertThat(list.path("content").get(0).at("/result/innings").size()).isEqualTo(2);
        assertThat(list.path("totalElements").asLong()).isEqualTo(6);
    }

    @Test
    void theResultsListPagesAndSorts() throws Exception {
        Seed s = seed();
        UUID clubId = s.w().club().getId();

        JsonNode second = page(s.admin(), RESULTS, clubId, "size", "2", "page", "1");
        assertThat(ids(second, "/match/id")).containsExactly(s.m4().getId().toString(), s.m3().getId().toString());
        assertThat(second.path("totalElements").asLong()).isEqualTo(6);
        assertThat(second.path("totalPages").asLong()).isEqualTo(3);

        JsonNode oldestFirst = page(s.admin(), RESULTS, clubId, "size", "2", "sort", "matchDate,asc");
        assertThat(ids(oldestFirst, "/match/id")).containsExactly(s.m1().getId().toString(), s.m2().getId().toString());
    }

    @Test
    void theResultsListFiltersByStatusOutcomeFocusSectionTeamSearchAndDates() throws Exception {
        Seed s = seed();
        UUID clubId = s.w().club().getId();
        JwtRequestPostProcessor a = s.admin();

        assertThat(total(a, RESULTS, clubId, "status", "PUBLISHED")).isEqualTo(5);
        assertThat(ids(page(a, RESULTS, clubId, "status", "DRAFT"), "/match/id")).containsExactly(s.m6().getId().toString());
        assertThat(total(a, RESULTS, clubId, "outcome", "TIE")).isEqualTo(1);
        assertThat(total(a, RESULTS, clubId, "outcome", "TIE", "status", "DRAFT")).isZero();
        assertThat(total(a, RESULTS, clubId, "outcome", "WON", "outcome", "FORFEIT")).isEqualTo(5);

        assertThat(total(a, RESULTS, clubId, "focus", "played")).isEqualTo(5);
        assertThat(total(a, RESULTS, clubId, "focus", "won")).isEqualTo(3);
        assertThat(total(a, RESULTS, clubId, "focus", "lost")).isEqualTo(2);
        assertThat(total(a, RESULTS, clubId, "focus", "tied-or-none")).isEqualTo(1);
        assertThat(total(a, RESULTS, clubId, "focus", "drafts")).isEqualTo(1);

        assertThat(ids(page(a, RESULTS, clubId, "sectionId", s.w().juniors().getId().toString()), "/match/id"))
                .containsExactly(s.m5().getId().toString());
        assertThat(ids(page(a, RESULTS, clubId, "teamId", s.w().seniors2().getId().toString()), "/match/id"))
                .containsExactly(s.m2().getId().toString());
        assertThat(ids(page(a, RESULTS, clubId, "search", "u15"), "/match/id")).containsExactly(s.m5().getId().toString());

        LocalDate today = LocalDate.now();
        JsonNode window = page(a, RESULTS, clubId, "from", today.minusDays(6).toString(), "to", today.minusDays(5).toString());
        assertThat(ids(window, "/match/id")).containsExactly(s.m6().getId().toString(), s.m5().getId().toString());
    }

    @Test
    void aBadFocusIs400() throws Exception {
        Seed s = seed();
        mockMvc.perform(with(get(RESULTS, s.w().club().getId()), s.admin(), "focus", "everything"))
                .andExpect(status().isBadRequest());
    }

    // ---- summary ----

    @Test
    void summaryCountsPlayedWonLostTiedDraftsAndAwaiting() throws Exception {
        Seed s = seed();
        JsonNode counters = page(s.admin(), RESULTS + "/summary", s.w().club().getId());

        assertThat(counters.path("played").asLong()).isEqualTo(5);
        // won: m1, the derby m2 (home side won), the m5 forfeit; lost: the derby m2 (away side lost), m3
        assertThat(counters.path("won").asLong()).isEqualTo(3);
        assertThat(counters.path("lost").asLong()).isEqualTo(2);
        assertThat(counters.path("tiedOrNone").asLong()).isEqualTo(1);
        assertThat(counters.path("drafts").asLong()).isEqualTo(1);
        assertThat(counters.path("awaiting").asLong()).isEqualTo(2);
    }

    @Test
    void aDerbyBetweenTwoOwnSidesIsOneWinAndOneLossForTheClubButOnlyOneForEachTeam() throws Exception {
        World w = fixtures.world();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        UUID clubId = w.club().getId();
        Match derby = fixtures.match(w, w.seniors1(), w.seniors2(), Instant.now().minus(Duration.ofDays(2)));
        capture(admin, clubId, derby, homeWinByRuns(), true);

        JsonNode club = page(admin, RESULTS + "/summary", clubId);
        assertThat(club.path("won").asLong()).isEqualTo(1);
        assertThat(club.path("lost").asLong()).isEqualTo(1);

        JsonNode winner = page(admin, RESULTS + "/summary", clubId, "teamId", w.seniors1().getId().toString());
        assertThat(winner.path("won").asLong()).isEqualTo(1);
        assertThat(winner.path("lost").asLong()).isZero();
        JsonNode loser = page(admin, RESULTS + "/summary", clubId, "teamId", w.seniors2().getId().toString());
        assertThat(loser.path("won").asLong()).isZero();
        assertThat(loser.path("lost").asLong()).isEqualTo(1);
    }

    @Test
    void aTeamThatBattedAwayAndWonCountsAsAWin() throws Exception {
        World w = fixtures.world();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        UUID clubId = w.club().getId();
        // an outside side at home against Villagers 1 away; the away side wins
        Match away = matchWithOutsideHome(w, w.seniors1());
        capture(admin, clubId, away, awayWinByWickets(), true);

        JsonNode counters = page(admin, RESULTS + "/summary", clubId);
        assertThat(counters.path("won").asLong()).isEqualTo(1);
        assertThat(counters.path("lost").asLong()).isZero();
    }

    private Match matchWithOutsideHome(World w, com.cricketlegend.domain.Team awayTeam) {
        Match m = context.getBean(com.cricketlegend.repository.MatchRepository.class).save(Match.builder()
                .clubId(w.club().getId()).homeTeamName("Outsiders").awayTeamId(awayTeam.getId())
                .seasonId(w.season().getId()).matchDate(Instant.now().minus(Duration.ofDays(1))).venue("Ground")
                .active(true).build());
        return m;
    }

    @Test
    void eachCounterEqualsTheListTotalForTheSameFilters() throws Exception {
        Seed s = seed();
        UUID clubId = s.w().club().getId();
        JwtRequestPostProcessor a = s.admin();
        String[][] filters = {
            {},
            {"sectionId", s.w().seniors().getId().toString()},
            {"sectionId", s.w().juniors().getId().toString()},
            {"teamId", s.w().seniors1().getId().toString()},
            {"teamId", s.w().seniors2().getId().toString()},
            {"search", "villagers"},
        };
        for (String[] filter : filters) {
            JsonNode counters = page(a, RESULTS + "/summary", clubId, filter);
            String label = String.join(",", filter);
            assertThat(total(a, RESULTS, clubId, plus(filter, "focus", "played"))).as("played %s", label)
                    .isEqualTo(counters.path("played").asLong());
            assertThat(total(a, RESULTS, clubId, plus(filter, "focus", "won"))).as("won %s", label)
                    .isEqualTo(counters.path("won").asLong());
            assertThat(total(a, RESULTS, clubId, plus(filter, "focus", "lost"))).as("lost %s", label)
                    .isEqualTo(counters.path("lost").asLong());
            assertThat(total(a, RESULTS, clubId, plus(filter, "focus", "tied-or-none"))).as("tied %s", label)
                    .isEqualTo(counters.path("tiedOrNone").asLong());
            assertThat(total(a, RESULTS, clubId, plus(filter, "focus", "drafts"))).as("drafts %s", label)
                    .isEqualTo(counters.path("drafts").asLong());
            assertThat(total(a, RESULTS + "/awaiting", clubId, filter)).as("awaiting %s", label)
                    .isEqualTo(counters.path("awaiting").asLong());
        }
    }

    private static String[] plus(String[] base, String... extra) {
        String[] merged = new String[base.length + extra.length];
        System.arraycopy(base, 0, merged, 0, base.length);
        System.arraycopy(extra, 0, merged, base.length, extra.length);
        return merged;
    }

    // ---- tenancy and section narrowing ----

    @Test
    void anotherClubsAdminIsForbiddenEverywhere() throws Exception {
        Seed s = seed();
        UUID clubId = s.w().club().getId();
        JwtRequestPostProcessor stranger = fixtures.clubAdmin(s.other());

        mockMvc.perform(get(RESULTS, clubId).with(stranger)).andExpect(status().isForbidden());
        mockMvc.perform(get(RESULTS + "/summary", clubId).with(stranger)).andExpect(status().isForbidden());
        mockMvc.perform(get(RESULTS + "/awaiting", clubId).with(stranger)).andExpect(status().isForbidden());
        mockMvc.perform(get(RESULT, clubId, s.m1().getId()).with(stranger)).andExpect(status().isForbidden());
        putResult(stranger, clubId, s.m7().getId(), tie()).andExpect(status().isForbidden());
    }

    @Test
    void aMatchOfAnotherClubIsNotFoundEvenForAnAdminOfTheUrlsClub() throws Exception {
        Seed s = seed();
        UUID clubId = s.w().club().getId();
        UUID foreignMatch = jdbc.queryForObject(
                "select match_id from match_result where club_id = ?", UUID.class, s.other().club().getId());

        mockMvc.perform(get(RESULT, clubId, foreignMatch).with(s.admin())).andExpect(status().isNotFound());
        putResult(s.admin(), clubId, foreignMatch, tie()).andExpect(status().isNotFound());
        mockMvc.perform(delete(RESULT, clubId, foreignMatch).with(s.admin())).andExpect(status().isNotFound());
        assertThat(ids(page(s.admin(), RESULTS, clubId), "/match/id")).doesNotContain(foreignMatch.toString());
    }

    @Test
    void aSectionManagerOnlySeesAndTouchesTheirOwnSectionsResults() throws Exception {
        Seed s = seed();
        UUID clubId = s.w().club().getId();
        JwtRequestPostProcessor juniors = fixtures.sectionManager(s.w().juniors());

        assertThat(ids(page(juniors, RESULTS, clubId), "/match/id")).containsExactly(s.m5().getId().toString());
        JsonNode counters = page(juniors, RESULTS + "/summary", clubId);
        assertThat(counters.path("played").asLong()).isEqualTo(1);
        assertThat(counters.path("won").asLong()).isEqualTo(1);
        assertThat(counters.path("lost").asLong()).isZero();
        assertThat(counters.path("drafts").asLong()).isZero();
        assertThat(counters.path("awaiting").asLong()).isEqualTo(1);
        assertThat(ids(page(juniors, RESULTS + "/awaiting", clubId), "/id")).containsExactly(s.m10().getId().toString());

        // a Seniors match is out of reach for read, capture, publish and delete
        mockMvc.perform(get(RESULT, clubId, s.m1().getId()).with(juniors)).andExpect(status().isForbidden());
        putResult(juniors, clubId, s.m7().getId(), tie()).andExpect(status().isForbidden());
        publish(juniors, clubId, s.m6().getId(), true).andExpect(status().isForbidden());
        mockMvc.perform(delete(RESULT, clubId, s.m6().getId()).with(juniors)).andExpect(status().isForbidden());

        // but their own section works
        putResult(juniors, clubId, s.m10().getId(), homeWinByRuns()).andExpect(status().isOk());
    }

    @Test
    void anExplicitSectionTheCallerCannotAdministerIsRefused() throws Exception {
        Seed s = seed();
        JwtRequestPostProcessor juniors = fixtures.sectionManager(s.w().juniors());

        mockMvc.perform(with(get(RESULTS, s.w().club().getId()), juniors, "sectionId", s.w().seniors().getId().toString()))
                .andExpect(status().isForbidden());
    }

    @Test
    void filterOptionsAreScopedToTheCallersSections() throws Exception {
        Seed s = seed();
        JsonNode options = page(fixtures.sectionManager(s.w().juniors()), RESULTS + "/filter-options", s.w().club().getId());
        List<String> sectionIds = new ArrayList<>();
        options.path("sectionIds").forEach(n -> sectionIds.add(n.asText()));
        assertThat(sectionIds).doesNotContain(s.w().seniors().getId().toString());
    }
}
