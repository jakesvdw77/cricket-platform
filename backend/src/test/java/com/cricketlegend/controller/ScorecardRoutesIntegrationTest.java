package com.cricketlegend.controller;

import static com.cricketlegend.support.ScorecardDtos.guest;
import static com.cricketlegend.support.ScorecardDtos.opposition;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
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
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * docs/specs/101, the five scorecard routes through real HTTP against real Postgres: tenancy (another club's admin,
 * another club's match), section scoping (a manager outside the match's section) and the name suggestions narrowed
 * to the caller's sections. Not {@code @Transactional}; {@link ManagerOverviewFixtures} removes what it seeds.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class ScorecardRoutesIntegrationTest {

    private static final String BASE = "/api/v1/manage/clubs/{clubId}";
    private static final String RESULT = BASE + "/matches/{matchId}/result";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    private ManagerOverviewFixtures fixtures;
    private World w;
    private World other;
    private JwtRequestPostProcessor admin;
    private Match seniorsMatch;
    private Match juniorsMatch;
    private Match foreignMatch;

    @BeforeEach
    void setUp() throws Exception {
        fixtures = new ManagerOverviewFixtures(context);
        w = fixtures.world();
        other = fixtures.world();
        admin = fixtures.clubAdmin(w);
        seniorsMatch = fixtures.match(w, w.seniors1(), null, Instant.now().minus(Duration.ofDays(2)));
        juniorsMatch = fixtures.match(w, w.juniorsTeam(), null, Instant.now().minus(Duration.ofDays(1)));
        foreignMatch = fixtures.match(other, other.seniors1(), null, Instant.now().minus(Duration.ofDays(1)));
        save(admin, w, seniorsMatch, guest(ResultSide.HOME, "g1", "Sam Senior"),
                opposition(ResultSide.AWAY, "o1", "Senior Opp"));
        save(admin, w, juniorsMatch, guest(ResultSide.HOME, "g1", "Kid Junior"),
                opposition(ResultSide.AWAY, "o1", "Junior Opp"));
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private void save(JwtRequestPostProcessor caller, World world, Match match,
            com.cricketlegend.dto.ResultPlayerDto... players) throws Exception {
        ResultDraft draft = new ResultDraft(null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, new ScorecardDto(List.of(players), null, null, null, null, null, null));
        mockMvc.perform(put(RESULT, world.club().getId(), match.getId()).with(caller)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(draft)))
                .andExpect(status().isOk());
    }

    private JsonNode body(ResultActions actions) throws Exception {
        return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private List<String> names(ResultActions actions) throws Exception {
        List<String> names = new ArrayList<>();
        body(actions.andExpect(status().isOk())).path("content").forEach(n -> names.add(n.path("displayName").asText()));
        return names;
    }

    private UUID guestRowId(Match match) throws Exception {
        JsonNode card = body(mockMvc.perform(get(RESULT + "/scorecard", w.club().getId(), match.getId()).with(admin))
                .andExpect(status().isOk()));
        return UUID.fromString(card.path("players").get(0).path("id").asText());
    }

    private ResultActions link(JwtRequestPostProcessor caller, UUID clubId, Match match, UUID resultPlayerId)
            throws Exception {
        return mockMvc.perform(post(RESULT + "/players/{rp}/link", clubId, match.getId(), resultPlayerId).with(caller)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"playerProfileId\":\"" + UUID.randomUUID() + "\"}"));
    }

    @Test
    void anotherClubsAdminIsForbiddenOnAllFiveRoutes() throws Exception {
        UUID clubId = w.club().getId();
        JwtRequestPostProcessor stranger = fixtures.clubAdmin(other);
        UUID rowId = guestRowId(seniorsMatch);

        mockMvc.perform(get(RESULT + "/scorecard/prefill", clubId, seniorsMatch.getId()).with(stranger))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(RESULT + "/scorecard", clubId, seniorsMatch.getId()).with(stranger))
                .andExpect(status().isForbidden());
        link(stranger, clubId, seniorsMatch, rowId).andExpect(status().isForbidden());
        mockMvc.perform(get(BASE + "/results/guest-names", clubId).with(stranger)).andExpect(status().isForbidden());
        mockMvc.perform(get(BASE + "/results/opposition-names", clubId).with(stranger).param("matchId",
                seniorsMatch.getId().toString())).andExpect(status().isForbidden());
    }

    @Test
    void aMatchOfAnotherClubIsNotFoundForAnAdminOfTheUrlsClub() throws Exception {
        UUID clubId = w.club().getId();

        mockMvc.perform(get(RESULT + "/scorecard/prefill", clubId, foreignMatch.getId()).with(admin))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(RESULT + "/scorecard", clubId, foreignMatch.getId()).with(admin))
                .andExpect(status().isNotFound());
        link(admin, clubId, foreignMatch, UUID.randomUUID()).andExpect(status().isNotFound());
        mockMvc.perform(get(BASE + "/results/opposition-names", clubId).with(admin)
                .param("matchId", foreignMatch.getId().toString())).andExpect(status().isNotFound());
    }

    @Test
    void aSectionManagerOutsideTheMatchsSectionIsRefused() throws Exception {
        UUID clubId = w.club().getId();
        JwtRequestPostProcessor juniors = fixtures.sectionManager(w.juniors());
        UUID rowId = guestRowId(seniorsMatch);

        mockMvc.perform(get(RESULT + "/scorecard/prefill", clubId, seniorsMatch.getId()).with(juniors))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(RESULT + "/scorecard", clubId, seniorsMatch.getId()).with(juniors))
                .andExpect(status().isForbidden());
        link(juniors, clubId, seniorsMatch, rowId).andExpect(status().isForbidden());
        mockMvc.perform(get(BASE + "/results/opposition-names", clubId).with(juniors)
                .param("matchId", seniorsMatch.getId().toString())).andExpect(status().isForbidden());
        mockMvc.perform(get(RESULT + "/scorecard", clubId, juniorsMatch.getId()).with(juniors))
                .andExpect(status().isOk());
    }

    @Test
    void aSectionManagerOnlySeesTheirSectionsGuestAndOppositionNames() throws Exception {
        UUID clubId = w.club().getId();
        JwtRequestPostProcessor juniors = fixtures.sectionManager(w.juniors());
        JwtRequestPostProcessor seniors = fixtures.sectionManager(w.seniors());

        assertThat(names(mockMvc.perform(get(BASE + "/results/guest-names", clubId).with(juniors))))
                .containsExactly("Kid Junior");
        assertThat(names(mockMvc.perform(get(BASE + "/results/guest-names", clubId).with(seniors))))
                .containsExactly("Sam Senior");
        assertThat(names(mockMvc.perform(get(BASE + "/results/guest-names", clubId).with(admin))))
                .containsExactlyInAnyOrder("Kid Junior", "Sam Senior");

        // the opposition of the same club-wide opposition name: each manager reads only their own section's names
        assertThat(names(mockMvc.perform(get(BASE + "/results/opposition-names", clubId).with(juniors)
                .param("opposition", "Occasionals")))).containsExactly("Junior Opp");
        assertThat(names(mockMvc.perform(get(BASE + "/results/opposition-names", clubId).with(seniors)
                .param("opposition", "Occasionals")))).containsExactly("Senior Opp");

        // naming a team outside the caller's sections is refused
        mockMvc.perform(get(BASE + "/results/guest-names", clubId).with(juniors)
                        .param("teamId", w.seniors1().getId().toString()))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(BASE + "/results/opposition-names", clubId).with(juniors)
                        .param("opposition", "Occasionals").param("teamId", w.seniors1().getId().toString()))
                .andExpect(status().isForbidden());
    }
}
