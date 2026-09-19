package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static com.cricketlegend.PlatformRoleJwtPostProcessors.withSubject;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueAffiliation;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * HTTP-layer integration test for LeagueController — per docs/specs/029-league-management.md's
 * Test Plan, following {@code TeamControllerIntegrationTest}'s pattern exactly ({@code
 * withSubject}, a real {@code Person} + {@code RoleAssignment(CLUB_ADMIN, CLUB, clubId)} row): a
 * real {@code CLUB_ADMIN} can reach every league and (nested) league-affiliation endpoint for
 * their own club, gets {@code 403} for a different club and {@code 404} for a {@code leagueId}
 * that's real but belongs to a different club, a {@code platform_admin} JWT also succeeds, both
 * transition {@code 409}s and the {@code minAge <= maxAge} {@code 400} and the affiliation
 * triple-uniqueness {@code 409} are proven through the real HTTP layer.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class LeagueControllerIntegrationTest {

    private static final String LEAGUE_BODY = """
            {
                "name": "Riverside Premier League"
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private LeagueRepository leagueRepository;

    @Autowired
    private LeagueAffiliationRepository leagueAffiliationRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Test
    void clubAdminCanReachAllFiveLeagueEndpointsForTheirOwnClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/leagues", club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/leagues", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LEAGUE_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Riverside Premier League"))
                .andExpect(jsonPath("$.source").value("INTERNAL"))
                .andExpect(jsonPath("$.maxPlayingXiSize").value(11))
                .andExpect(jsonPath("$.active").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String leagueId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        String updateBody = """
                {
                    "name": "Riverside Premier League (renamed)",
                    "maxPlayingXiSize": 12,
                    "allowSubstitutions": true,
                    "minAge": 18,
                    "maxAge": 60
                }
                """;
        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}", club.getId(), leagueId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Riverside Premier League (renamed)"))
                .andExpect(jsonPath("$.maxPlayingXiSize").value(12))
                .andExpect(jsonPath("$.allowSubstitutions").value(true));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/deactivate",
                                club.getId(),
                                leagueId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/reactivate",
                                club.getId(),
                                leagueId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void clubAdminCanReachAllThreeAffiliationEndpointsForTheirOwnClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        League league = leagueRepository.save(newLeague(club.getId(), "Premier League"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations",
                                club.getId(),
                                league.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        String affiliationBody = """
                {
                    "teamId": "%s",
                    "seasonId": "%s"
                }
                """.formatted(team.getId(), season.getId());
        String createResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations",
                                club.getId(),
                                league.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(affiliationBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.teamId").value(team.getId().toString()))
                .andExpect(jsonPath("$.seasonId").value(season.getId().toString()))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String affiliationId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations",
                                club.getId(),
                                league.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations/{affiliationId}/unaffiliate",
                                club.getId(),
                                league.getId(),
                                affiliationId)
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations",
                                club.getId(),
                                league.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void clubAdminGets403OnAllLeagueAndAffiliationEndpointsForADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        League leagueY = leagueRepository.save(newLeague(clubY.getId(), "Lakeside League"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/leagues", clubY.getId()).with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/leagues", clubY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LEAGUE_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}",
                                clubY.getId(),
                                leagueY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LEAGUE_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/deactivate",
                                clubY.getId(),
                                leagueY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations",
                                clubY.getId(),
                                leagueY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations",
                                clubY.getId(),
                                leagueY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + UUID.randomUUID() + "\", \"seasonId\": \""
                                + UUID.randomUUID() + "\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void clubAdminGets404ForALeagueIdThatIsRealButBelongsToADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        League leagueY = leagueRepository.save(newLeague(clubY.getId(), "Lakeside League"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        // clubX is the caller's own club (so @PreAuthorize passes), but leagueY belongs to
        // clubY — the service's findOrThrowForClub must 404 this, not the controller's
        // @PreAuthorize.
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}",
                                clubX.getId(),
                                leagueY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LEAGUE_BODY))
                .andExpect(status().isNotFound());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/deactivate",
                                clubX.getId(),
                                leagueY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations",
                                clubX.getId(),
                                leagueY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    /**
     * Affiliation create 404s when {@code teamId}/{@code seasonId} are real but belong to a
     * different club than the (correctly-scoped) {@code leagueId}'s own club.
     */
    @Test
    void affiliationCreateReturns404WhenTeamOrSeasonBelongsToADifferentClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club otherClub = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section otherSection = sectionRepository.save(newSection(otherClub.getId(), "Men"));
        Team otherTeam = teamRepository.save(newTeam(otherClub.getId(), otherSection.getId(), "1st XI"));
        Season otherSeason = seasonRepository.save(newSeason(otherClub.getId(), "2026"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        League league = leagueRepository.save(newLeague(club.getId(), "Premier League"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations",
                                club.getId(),
                                league.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + otherTeam.getId() + "\", \"seasonId\": \""
                                + season.getId() + "\"}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations",
                                club.getId(),
                                league.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + team.getId() + "\", \"seasonId\": \""
                                + otherSeason.getId() + "\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void platformAdminSucceedsOnAllLeagueAndAffiliationEndpointsForAnArbitraryClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/leagues", club.getId()).with(platformAdmin()))
                .andExpect(status().isOk());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/leagues", club.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LEAGUE_BODY))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String leagueId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/leagues/{leagueId}", club.getId(), leagueId)
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LEAGUE_BODY))
                .andExpect(status().isOk());

        String affiliationBody = """
                {
                    "teamId": "%s",
                    "seasonId": "%s"
                }
                """.formatted(team.getId(), season.getId());
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations",
                                club.getId(),
                                leagueId)
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(affiliationBody))
                .andExpect(status().isCreated());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/deactivate",
                                club.getId(),
                                leagueId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/reactivate",
                                club.getId(),
                                leagueId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());
    }

    @Test
    void callerWithNoClubAdminGrantAndNoPlatformAdminRoleGets403() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        JwtRequestPostProcessor unknown = withSubject("unknown-sub-no-person-or-grant");

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/leagues", club.getId()).with(unknown))
                .andExpect(status().isForbidden());
    }

    /** Both transition {@code 409}s, proven through the real HTTP layer. */
    @Test
    void deactivateAndReactivateReturn409WhenAlreadyInThatState() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        League league = leagueRepository.save(newLeague(club.getId(), "Premier League"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        // Already active — reactivate is the invalid transition first.
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/reactivate",
                                club.getId(),
                                league.getId())
                        .with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("already active")));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/deactivate",
                                club.getId(),
                                league.getId())
                        .with(admin))
                .andExpect(status().isOk());

        // Now already inactive — deactivate is the invalid transition.
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/deactivate",
                                club.getId(),
                                league.getId())
                        .with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("already inactive")));
    }

    /** The {@code minAge <= maxAge} {@code 400}, proven on both create and update through real HTTP. */
    @Test
    void createAndUpdateReturn400WhenMinAgeIsGreaterThanMaxAge() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        League league = leagueRepository.save(newLeague(club.getId(), "Premier League"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        String invalidCreateBody = """
                {
                    "name": "Invalid Age League",
                    "minAge": 40,
                    "maxAge": 18
                }
                """;
        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/leagues", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidCreateBody))
                .andExpect(status().isBadRequest());

        String invalidUpdateBody = """
                {
                    "name": "Premier League",
                    "minAge": 40,
                    "maxAge": 18
                }
                """;
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}",
                                club.getId(),
                                league.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidUpdateBody))
                .andExpect(status().isBadRequest());
    }

    /** The affiliation triple-uniqueness {@code 409}, proven through real HTTP. */
    @Test
    void affiliationCreateReturns409ForTheExactLeagueTeamSeasonTripleAlreadyExisting() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        League league = leagueRepository.save(newLeague(club.getId(), "Premier League"));
        leagueAffiliationRepository.save(LeagueAffiliation.builder()
                .leagueId(league.getId())
                .teamId(team.getId())
                .seasonId(season.getId())
                .build());
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        String affiliationBody = """
                {
                    "teamId": "%s",
                    "seasonId": "%s"
                }
                """.formatted(team.getId(), season.getId());
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations",
                                club.getId(),
                                league.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(affiliationBody))
                .andExpect(status().isConflict());
    }

    /** Unaffiliating a non-existent affiliation {@code 404}s through real HTTP. */
    @Test
    void unaffiliateReturns404WhenNoSuchAffiliationExists() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        League league = leagueRepository.save(newLeague(club.getId(), "Premier League"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/affiliations/{affiliationId}/unaffiliate",
                                club.getId(),
                                league.getId(),
                                UUID.randomUUID())
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    /**
     * Per docs/specs/035-section-scoped-access.md: League/Season/LeagueAffiliation stay
     * CLUB-scope-only — a pure SECTION-scope caller (no CLUB-scope grant at all) still gets a
     * clean 403, unchanged from before that spec.
     */
    @Test
    void aPureSectionScopedCallerWithNoClubScopeGrantStillGets403() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Juniors"));
        JwtRequestPostProcessor sectionAdmin = grantSectionAdmin("juniors-admin-sub", section.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/leagues", club.getId()).with(sectionAdmin))
                .andExpect(status().isForbidden());
    }

    private JwtRequestPostProcessor grantSectionAdmin(String keycloakUserId, UUID sectionId) {
        Person person = personRepository.save(Person.builder()
                .firstName("Jamie")
                .lastName("SectionAdmin")
                .email(keycloakUserId + "@example.com")
                .keycloakUserId(keycloakUserId)
                .build());
        roleAssignmentRepository.save(RoleAssignment.builder()
                .personId(person.getId())
                .role(RoleAssignmentRole.CLUB_ADMIN)
                .scopeType(ScopeType.SECTION)
                .scopeId(sectionId)
                .build());
        return withSubject(keycloakUserId);
    }

    private JwtRequestPostProcessor grantClubAdmin(String keycloakUserId, UUID clubId) {
        Person person = personRepository.save(Person.builder()
                .firstName("Casey")
                .lastName("Manager")
                .email(keycloakUserId + "@example.com")
                .keycloakUserId(keycloakUserId)
                .build());
        roleAssignmentRepository.save(RoleAssignment.builder()
                .personId(person.getId())
                .role(RoleAssignmentRole.CLUB_ADMIN)
                .scopeType(ScopeType.CLUB)
                .scopeId(clubId)
                .build());
        return withSubject(keycloakUserId);
    }

    private Club newClub(String name, String slug) {
        return Club.builder().name(name).slug(slug).status(ClubStatus.ACTIVE).build();
    }

    private Section newSection(UUID clubId, String name) {
        return Section.builder().clubId(clubId).name(name).active(true).build();
    }

    private Team newTeam(UUID clubId, UUID sectionId, String name) {
        return Team.builder().clubId(clubId).sectionId(sectionId).name(name).active(true).build();
    }

    private Season newSeason(UUID clubId, String label) {
        return Season.builder()
                .clubId(clubId)
                .label(label)
                .startDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 12, 31))
                .active(true)
                .build();
    }

    private League newLeague(UUID clubId, String name) {
        return League.builder()
                .clubId(clubId)
                .name(name)
                .source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11)
                .allowSubstitutions(false)
                .active(true)
                .build();
    }
}
