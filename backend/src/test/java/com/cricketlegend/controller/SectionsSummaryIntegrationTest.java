package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerVerificationStatus;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeagueAffiliationRepository.SectionLeagueRef;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
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

/**
 * docs/specs/094-club-structure-and-seasons.md: {@code GET /sections/summary} and the repository query behind its
 * {@code leagues}, through real HTTP against real Postgres. Proves own versus subtree figures, the distinct player
 * count, the leagues scoped to a season, the foreign-season 404, cross-club isolation and the 403s. Not
 * {@code @Transactional}; {@link ManagerOverviewFixtures} removes what it seeds.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class SectionsSummaryIntegrationTest {

    private static final String SUMMARY = "/api/v1/manage/clubs/{clubId}/sections/summary";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PlayerProfileRepository playerProfileRepository;

    @Autowired
    private LeagueAffiliationRepository leagueAffiliationRepository;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private TeamRepository teamRepository;

    private ManagerOverviewFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private JsonNode summary(JwtRequestPostProcessor caller, UUID clubId, String... params) throws Exception {
        var request = get(SUMMARY, clubId).with(caller);
        for (int i = 0; i < params.length; i += 2) {
            request = request.param(params[i], params[i + 1]);
        }
        String body = mockMvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    private JsonNode row(JsonNode summary, Section section) {
        for (JsonNode row : summary.path("sections")) {
            if (row.path("sectionId").asText().equals(section.getId().toString())) {
                return row;
            }
        }
        throw new AssertionError("no row for " + section.getName());
    }

    @Test
    void reportsOwnAndSubtreeFiguresTotalsAndLeagues() throws Exception {
        World w = fixtures.world();
        Section u15 = fixtures.childSection(w.club(), w.juniors(), "U15");
        Team u15Team = fixtures.team(w.club(), u15, "U15 B");
        Team retired = fixtures.team(w.club(), u15, "U15 Old");
        retired.setActive(false);
        teamRepository.save(retired);

        PlayerProfile both = fixtures.player(w, "Both", true);
        fixtures.tag(w.juniors(), both);
        fixtures.tag(u15, both);
        PlayerProfile child = fixtures.player(w, "Child", true);
        fixtures.tag(u15, child);
        fixtures.player(w, "Untagged", true);
        PlayerProfile suspended = fixtures.player(w, "Suspended", false);
        fixtures.tag(u15, suspended);
        PlayerProfile rejected = fixtures.player(w, "Rejected", true);
        rejected.setVerificationStatus(PlayerVerificationStatus.REJECTED);
        playerProfileRepository.save(rejected);

        League league = fixtures.league(w, 11);
        fixtures.affiliate(league, w.juniorsTeam(), w.season());
        fixtures.affiliate(league, u15Team, w.season());
        Season otherSeason = seasonRepository.save(Season.builder()
                .clubId(w.club().getId()).label("2030").startDate(LocalDate.of(2030, 1, 1))
                .endDate(LocalDate.of(2030, 12, 31)).active(true).build());
        League olderLeague = fixtures.league(w, 11);
        fixtures.affiliate(olderLeague, w.seniors1(), otherSeason);

        JsonNode result = summary(fixtures.clubAdmin(w), w.club().getId(), "seasonId", w.season().getId().toString());

        // 3 sections (Seniors, Juniors, U15); active teams: 3 + U15 B; players: Both, Child, Untagged
        assertThat(result.path("totals").path("sections").asLong()).isEqualTo(3);
        assertThat(result.path("totals").path("teams").asLong()).isEqualTo(4);
        assertThat(result.path("totals").path("players").asLong()).isEqualTo(3);

        JsonNode juniorsRow = row(result, w.juniors());
        assertThat(juniorsRow.path("teamCount").asLong()).isEqualTo(1);
        assertThat(juniorsRow.path("playerCount").asLong()).isEqualTo(1);
        assertThat(juniorsRow.path("subtreeTeamCount").asLong()).isEqualTo(3);
        assertThat(juniorsRow.path("subtreePlayerCount").asLong()).isEqualTo(2); // Both counted once, Child; not suspended
        assertThat(juniorsRow.path("leagues")).hasSize(1);
        assertThat(juniorsRow.path("leagues").get(0).path("id").asText()).isEqualTo(league.getId().toString());

        JsonNode u15Row = row(result, u15);
        assertThat(u15Row.path("teamCount").asLong()).isEqualTo(2);
        assertThat(u15Row.path("activeTeamCount").asLong()).isEqualTo(1);
        assertThat(u15Row.path("playerCount").asLong()).isEqualTo(2);
        assertThat(u15Row.path("subtreePlayerCount").asLong()).isEqualTo(2);
        assertThat(u15Row.path("leagues")).hasSize(1);

        // the other season holds only the Seniors team's league
        JsonNode older = summary(fixtures.clubAdmin(w), w.club().getId(), "seasonId", otherSeason.getId().toString());
        assertThat(row(older, w.seniors()).path("leagues")).hasSize(1);
        assertThat(row(older, w.juniors()).path("leagues")).isEmpty();
    }

    @Test
    void theRepositoryQueryReturnsDistinctLeaguesPerSectionForTheClubAndSeasonOnly() {
        World w = fixtures.world();
        World other = fixtures.world();
        League league = fixtures.league(w, 11);
        fixtures.affiliate(league, w.seniors1(), w.season());
        fixtures.affiliate(league, w.seniors2(), w.season()); // same league, same section: one row
        fixtures.affiliate(league, w.juniorsTeam(), w.season());
        fixtures.affiliate(fixtures.league(other, 11), other.seniors1(), other.season());

        List<SectionLeagueRef> refs = leagueAffiliationRepository.findSectionLeagueRefs(w.club().getId(), w.season().getId());

        assertThat(refs).hasSize(2);
        assertThat(refs).extracting(SectionLeagueRef::getSectionId)
                .containsExactlyInAnyOrder(w.seniors().getId(), w.juniors().getId());
        assertThat(refs).extracting(SectionLeagueRef::getLeagueId).containsOnly(league.getId());
        assertThat(refs).extracting(SectionLeagueRef::getLeagueName).containsOnly(league.getName());
        assertThat(leagueAffiliationRepository.findSectionLeagueRefs(w.club().getId(), other.season().getId())).isEmpty();
    }

    @Test
    void defaultsToTheCurrentSeasonAndAnEmptyClubReturnsEmptyArrays() throws Exception {
        World w = fixtures.world();
        League league = fixtures.league(w, 11);
        fixtures.affiliate(league, w.seniors1(), w.season());

        // the world's only season is the current one (nothing contains today, so the latest created is current)
        JsonNode defaulted = summary(fixtures.clubAdmin(w), w.club().getId());
        assertThat(row(defaulted, w.seniors()).path("leagues")).hasSize(1);

        String slug = "bare-" + UUID.randomUUID();
        Club bare = clubRepository.save(Club.builder().name(slug).slug(slug).status(ClubStatus.ACTIVE).build());
        try {
            JsonNode empty = summary(platformAdmin(), bare.getId());
            assertThat(empty.path("sections")).isEmpty();
            assertThat(empty.path("totals").path("sections").asLong()).isZero();
            assertThat(empty.path("totals").path("teams").asLong()).isZero();
            assertThat(empty.path("totals").path("players").asLong()).isZero();
        } finally {
            clubRepository.delete(bare);
        }
    }

    @Test
    void aSeasonOfAnotherClubIsNotFound() throws Exception {
        World w = fixtures.world();
        World other = fixtures.world();

        mockMvc.perform(get(SUMMARY, w.club().getId()).with(fixtures.clubAdmin(w))
                        .param("seasonId", other.season().getId().toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    void anotherClubsFiguresNeverLeakIn() throws Exception {
        World w = fixtures.world();
        World other = fixtures.world();
        fixtures.tag(other.seniors(), fixtures.player(other, "Elsewhere", true));

        JsonNode result = summary(fixtures.clubAdmin(w), w.club().getId());

        assertThat(result.path("sections")).hasSize(2);
        assertThat(result.path("totals").path("players").asLong()).isZero();
        assertThat(result.path("totals").path("teams").asLong()).isEqualTo(3);
    }

    @Test
    void nonAdminsAreForbidden() throws Exception {
        World w = fixtures.world();
        World other = fixtures.world();

        mockMvc.perform(get(SUMMARY, w.club().getId()).with(fixtures.clubAdmin(other))).andExpect(status().isForbidden());
        mockMvc.perform(get(SUMMARY, w.club().getId()).with(fixtures.sectionManager(w.seniors())))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(SUMMARY, w.club().getId()).with(fixtures.nobody())).andExpect(status().isForbidden());
    }
}
