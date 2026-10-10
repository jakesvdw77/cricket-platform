package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

/**
 * docs/specs/094-club-structure-and-seasons.md: {@code GET /seasons/summary} and the three grouped queries behind it,
 * through real HTTP against real Postgres. Proves the per-season figures, zeros, distinct teams, active matches only,
 * the literal path winning over the {@code /seasons/{seasonId}} family, cross-club isolation and the 403s. Not
 * {@code @Transactional}; {@link ManagerOverviewFixtures} removes what it seeds.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class SeasonsSummaryIntegrationTest {

    private static final String SUMMARY = "/api/v1/manage/clubs/{clubId}/seasons/summary";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    private ManagerOverviewFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private JsonNode summary(JwtRequestPostProcessor caller, UUID clubId) throws Exception {
        String body = mockMvc.perform(get(SUMMARY, clubId).with(caller)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    private JsonNode row(JsonNode summary, Season season) {
        for (JsonNode row : summary.path("seasons")) {
            if (row.path("seasonId").asText().equals(season.getId().toString())) {
                return row;
            }
        }
        throw new AssertionError("no row for " + season.getLabel());
    }

    @Test
    void reportsLeaguesDistinctTeamsAndActiveMatchesPerSeasonWithZerosElsewhere() throws Exception {
        World w = fixtures.world();
        Season older = fixtures.season(w.club(), "2020");
        Season inactive = fixtures.season(w.club(), "2019");
        inactive.setActive(false);
        seasonRepository.save(inactive);
        Season empty = fixtures.season(w.club(), "2018");

        League first = fixtures.league(w, 11);
        League second = fixtures.league(w, 11);
        // Villagers 1 plays in both leagues (one team, two leagues); Villagers 2 only in the first
        fixtures.affiliate(first, w.seniors1(), w.season());
        fixtures.affiliate(second, w.seniors1(), w.season());
        fixtures.affiliate(first, w.seniors2(), w.season());
        fixtures.affiliate(first, w.juniorsTeam(), older);
        fixtures.affiliate(first, w.seniors1(), inactive);

        fixtures.matchIn(w, w.season(), w.seniors1(), true);
        fixtures.matchIn(w, w.season(), w.seniors2(), true);
        fixtures.matchIn(w, w.season(), w.seniors2(), false); // inactive: excluded
        fixtures.matchIn(w, older, w.juniorsTeam(), true);

        JsonNode result = summary(fixtures.clubAdmin(w), w.club().getId());

        assertThat(result.path("seasons")).hasSize(4);
        JsonNode current = row(result, w.season());
        assertThat(current.path("leagueCount").asLong()).isEqualTo(2);
        assertThat(current.path("teamsEntered").asLong()).isEqualTo(2);
        assertThat(current.path("matchCount").asLong()).isEqualTo(2);
        JsonNode olderRow = row(result, older);
        assertThat(olderRow.path("leagueCount").asLong()).isEqualTo(1);
        assertThat(olderRow.path("teamsEntered").asLong()).isEqualTo(1);
        assertThat(olderRow.path("matchCount").asLong()).isEqualTo(1);
        JsonNode inactiveRow = row(result, inactive);
        assertThat(inactiveRow.path("leagueCount").asLong()).isEqualTo(1);
        assertThat(inactiveRow.path("matchCount").asLong()).isZero();
        JsonNode emptyRow = row(result, empty);
        assertThat(emptyRow.path("leagueCount").asLong()).isZero();
        assertThat(emptyRow.path("teamsEntered").asLong()).isZero();
        assertThat(emptyRow.path("matchCount").asLong()).isZero();
    }

    @Test
    void anotherClubsSeasonsAndFiguresNeverLeakIn() throws Exception {
        World w = fixtures.world();
        World other = fixtures.world();
        Team otherTeam = other.seniors1();
        fixtures.affiliate(fixtures.league(other, 11), otherTeam, other.season());
        fixtures.matchIn(other, other.season(), otherTeam, true);
        // even a foreign team affiliated into this club's season must not be counted as one of its own
        fixtures.affiliate(fixtures.league(other, 11), otherTeam, w.season());

        JsonNode result = summary(fixtures.clubAdmin(w), w.club().getId());

        assertThat(result.path("seasons")).hasSize(1);
        JsonNode only = row(result, w.season());
        assertThat(only.path("leagueCount").asLong()).isZero();
        assertThat(only.path("teamsEntered").asLong()).isZero();
        assertThat(only.path("matchCount").asLong()).isZero();
    }

    @Test
    void aClubWithoutSeasonsReturnsAnEmptyList() throws Exception {
        String slug = "bare-" + UUID.randomUUID();
        Club bare = clubRepository.save(Club.builder().name(slug).slug(slug).status(ClubStatus.ACTIVE).build());
        try {
            assertThat(summary(platformAdmin(), bare.getId()).path("seasons")).isEmpty();
        } finally {
            clubRepository.delete(bare);
        }
    }

    @Test
    void theLiteralSummaryPathIsNotTakenForASeasonId() throws Exception {
        World w = fixtures.world();

        // a season id on the same prefix is not a GET route (only PUT/POST exist), and "summary" is not a UUID
        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/seasons/{id}", w.club().getId(), w.season().getId())
                        .with(fixtures.clubAdmin(w)))
                .andExpect(status().isMethodNotAllowed());
        assertThat(summary(fixtures.clubAdmin(w), w.club().getId()).path("seasons")).hasSize(1);
    }

    @Test
    void nonAdminsAreForbidden() throws Exception {
        World w = fixtures.world();
        World other = fixtures.world();

        mockMvc.perform(get(SUMMARY, w.club().getId()).with(fixtures.clubAdmin(other))).andExpect(status().isForbidden());
        mockMvc.perform(get(SUMMARY, w.club().getId()).with(fixtures.nobody())).andExpect(status().isForbidden());
    }
}
