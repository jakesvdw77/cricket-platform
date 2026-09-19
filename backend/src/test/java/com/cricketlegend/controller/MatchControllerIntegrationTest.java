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
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
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
 * HTTP-layer integration test for MatchController — per docs/specs/029-league-management.md's
 * Test Plan, following {@code TeamControllerIntegrationTest}'s pattern exactly: a real {@code
 * CLUB_ADMIN} can reach all six endpoints for their own club, gets {@code 403} for a different
 * club and {@code 404} for a {@code leagueId}/{@code seasonId} that's real but belongs to a
 * different club, a {@code platform_admin} JWT also succeeds, both transition {@code 409}s, the
 * exactly-one-of-team-id/team-name {@code 400}, and the cross-club-allowed {@code Team} reference
 * are all proven through real HTTP — plus the paginated {@code GET /matches} is proven to actually
 * page rather than return every row (the first {@code Pageable} endpoint in this feature area).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class MatchControllerIntegrationTest {

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
    private MatchRepository matchRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Test
    void clubAdminCanReachAllSixEndpointsForTheirOwnClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/matches", club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());

        String createBody = """
                {
                    "homeTeamName": "Riverside 1st XI",
                    "awayTeamName": "Occasionals",
                    "seasonId": "%s",
                    "matchDate": "%s",
                    "venue": "Home Ground"
                }
                """.formatted(season.getId(), Instant.now().plus(7, ChronoUnit.DAYS));
        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.homeTeamName").value("Riverside 1st XI"))
                .andExpect(jsonPath("$.active").value(true))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String matchId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/matches/{matchId}", club.getId(), matchId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.venue").value("Home Ground"));

        String updateBody = """
                {
                    "homeTeamName": "Riverside 1st XI",
                    "awayTeamName": "Occasionals",
                    "seasonId": "%s",
                    "matchDate": "%s",
                    "venue": "Away Ground"
                }
                """.formatted(season.getId(), Instant.now().plus(8, ChronoUnit.DAYS));
        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/matches/{matchId}", club.getId(), matchId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.venue").value("Away Ground"));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/deactivate",
                                club.getId(),
                                matchId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/reactivate",
                                club.getId(),
                                matchId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void clubAdminGets403OnAllSixEndpointsForADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId(), "2026"));
        Match matchY = matchRepository.save(newFreeTextMatch(clubY.getId(), seasonY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/matches", clubY.getId()).with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}",
                                clubY.getId(),
                                matchY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", clubY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(matchBody(seasonY.getId())))
                .andExpect(status().isForbidden());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}",
                                clubY.getId(),
                                matchY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(matchBody(seasonY.getId())))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/deactivate",
                                clubY.getId(),
                                matchY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/reactivate",
                                clubY.getId(),
                                matchY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());
    }

    @Test
    void clubAdminGets404ForAMatchLeagueOrSeasonIdThatIsRealButBelongsToADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Season seasonX = seasonRepository.save(newSeason(clubX.getId(), "2026"));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId(), "2026"));
        League leagueY = leagueRepository.save(newLeague(clubY.getId()));
        Match matchY = matchRepository.save(newFreeTextMatch(clubY.getId(), seasonY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        // clubX is the caller's own club, but matchY belongs to clubY.
        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}",
                                clubX.getId(),
                                matchY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        // seasonId belongs to clubY, not clubX.
        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", clubX.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(matchBody(seasonY.getId())))
                .andExpect(status().isNotFound());

        // leagueId belongs to clubY, not clubX (seasonId is correctly clubX's own).
        String bodyWithForeignLeague = """
                {
                    "homeTeamName": "Riverside 1st XI",
                    "awayTeamName": "Occasionals",
                    "leagueId": "%s",
                    "seasonId": "%s",
                    "matchDate": "%s"
                }
                """.formatted(leagueY.getId(), seasonX.getId(), Instant.now().plus(1, ChronoUnit.DAYS));
        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", clubX.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bodyWithForeignLeague))
                .andExpect(status().isNotFound());
    }

    /** A real, cross-club {@code Team} reference for {@code homeTeamId}/{@code awayTeamId} is allowed. */
    @Test
    void creatingAMatchWithACrossClubTeamReferenceSucceeds() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club otherClub = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Section otherSection = sectionRepository.save(newSection(otherClub.getId(), "Men"));
        Team otherClubsTeam = teamRepository.save(newTeam(otherClub.getId(), otherSection.getId(), "1st XI"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        String body = """
                {
                    "homeTeamName": "Riverside 1st XI",
                    "awayTeamId": "%s",
                    "seasonId": "%s",
                    "matchDate": "%s"
                }
                """.formatted(otherClubsTeam.getId(), season.getId(), Instant.now().plus(1, ChronoUnit.DAYS));
        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.awayTeamId").value(otherClubsTeam.getId().toString()))
                // Match.club_id is always the acting/creating club, never derived from the away
                // team's own club.
                .andExpect(jsonPath("$.clubId").value(club.getId().toString()));
    }

    @Test
    void platformAdminSucceedsOnAllSixEndpointsForAnArbitraryClubsMatches() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/matches", club.getId()).with(platformAdmin()))
                .andExpect(status().isOk());

        String createResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(matchBody(season.getId())))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String matchId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/matches/{matchId}", club.getId(), matchId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/matches/{matchId}", club.getId(), matchId)
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(matchBody(season.getId())))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/deactivate",
                                club.getId(),
                                matchId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/reactivate",
                                club.getId(),
                                matchId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());
    }

    @Test
    void callerWithNoClubAdminGrantAndNoPlatformAdminRoleGets403() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        JwtRequestPostProcessor unknown = withSubject("unknown-sub-no-person-or-grant");

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/matches", club.getId()).with(unknown))
                .andExpect(status().isForbidden());
    }

    /** Both transition {@code 409}s, proven through the real HTTP layer. */
    @Test
    void deactivateAndReactivateReturn409WhenAlreadyInThatState() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newFreeTextMatch(club.getId(), season.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/reactivate",
                                club.getId(),
                                match.getId())
                        .with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("already active")));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/deactivate",
                                club.getId(),
                                match.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/deactivate",
                                club.getId(),
                                match.getId())
                        .with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("already inactive")));
    }

    /** Exactly-one-of-team-id/team-name per side, proven through real HTTP for both violations. */
    @Test
    void createReturns400WhenASideHasBothOrNeitherOfTeamIdAndTeamName() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        // Home side has BOTH homeTeamId and homeTeamName set.
        String bothSetBody = """
                {
                    "homeTeamId": "%s",
                    "homeTeamName": "Riverside 1st XI",
                    "awayTeamName": "Occasionals",
                    "seasonId": "%s",
                    "matchDate": "%s"
                }
                """.formatted(team.getId(), season.getId(), Instant.now().plus(1, ChronoUnit.DAYS));
        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bothSetBody))
                .andExpect(status().isBadRequest());

        // Away side has NEITHER awayTeamId nor awayTeamName set.
        String neitherSetBody = """
                {
                    "homeTeamName": "Riverside 1st XI",
                    "seasonId": "%s",
                    "matchDate": "%s"
                }
                """.formatted(season.getId(), Instant.now().plus(1, ChronoUnit.DAYS));
        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(neitherSetBody))
                .andExpect(status().isBadRequest());
    }

    /**
     * The paginated {@code GET /matches} proven to actually page — a smaller page size doesn't
     * return every row, and the second page returns the remaining, different rows, sorted by
     * {@code matchDate} descending by default.
     */
    @Test
    void listActuallyPaginatesRatherThanReturningEveryRow() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        for (int i = 0; i < 5; i++) {
            matchRepository.save(Match.builder()
                    .clubId(club.getId())
                    .homeTeamName("Riverside " + i)
                    .awayTeamName("Occasionals " + i)
                    .seasonId(season.getId())
                    .matchDate(Instant.now().plus(i, ChronoUnit.DAYS))
                    .active(true)
                    .build());
        }
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .param("page", "0")
                        .param("size", "2")
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", org.hamcrest.Matchers.hasSize(2)))
                .andExpect(jsonPath("$.totalElements").value(5))
                .andExpect(jsonPath("$.totalPages").value(3))
                // Default sort is matchDate descending — the latest match (i=4) leads page 0.
                .andExpect(jsonPath("$.content[0].homeTeamName").value("Riverside 4"))
                .andExpect(jsonPath("$.content[1].homeTeamName").value("Riverside 3"));

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .param("page", "1")
                        .param("size", "2")
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", org.hamcrest.Matchers.hasSize(2)))
                .andExpect(jsonPath("$.content[0].homeTeamName").value("Riverside 2"))
                .andExpect(jsonPath("$.content[1].homeTeamName").value("Riverside 1"));
    }

    // --- 037: upcomingOnly ---

    /**
     * {@code GET /matches?upcomingOnly=true} against real seeded past/today/future matches —
     * only today-or-later rows come back; omitting the param is unchanged from today's behaviour.
     * See docs/specs/037-match-improvements.md.
     */
    @Test
    void listWithUpcomingOnlyTrueReturnsOnlyTodayOrLaterMatches() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match pastMatch = matchRepository.save(Match.builder()
                .clubId(club.getId())
                .homeTeamName("Riverside Yesterday")
                .awayTeamName("Occasionals")
                .seasonId(season.getId())
                .matchDate(Instant.now().minus(1, ChronoUnit.DAYS))
                .active(true)
                .build());
        Match todayMatch = matchRepository.save(Match.builder()
                .clubId(club.getId())
                .homeTeamName("Riverside Today")
                .awayTeamName("Occasionals")
                .seasonId(season.getId())
                .matchDate(Instant.now().minus(5, ChronoUnit.MINUTES))
                .active(true)
                .build());
        Match futureMatch = matchRepository.save(Match.builder()
                .clubId(club.getId())
                .homeTeamName("Riverside Tomorrow")
                .awayTeamName("Occasionals")
                .seasonId(season.getId())
                .matchDate(Instant.now().plus(1, ChronoUnit.DAYS))
                .active(true)
                .build());
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .param("upcomingOnly", "true")
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[*].id", org.hamcrest.Matchers.containsInAnyOrder(
                        todayMatch.getId().toString(), futureMatch.getId().toString())));

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/matches", club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(3))
                .andExpect(jsonPath("$.content[*].id", org.hamcrest.Matchers.containsInAnyOrder(
                        pastMatch.getId().toString(),
                        todayMatch.getId().toString(),
                        futureMatch.getId().toString())));
    }

    // --- 035: section-scoped access ---

    @Test
    void sectionScopedAdminCanReachAMatchResolvingToTheirOwnSectionButNotOutsideIt() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section juniors = sectionRepository.save(newSection(club.getId(), "Juniors"));
        Section open = sectionRepository.save(newSection(club.getId(), "Open"));
        Team juniorsTeam = teamRepository.save(newTeam(club.getId(), juniors.getId(), "U15"));
        Team openTeam = teamRepository.save(newTeam(club.getId(), open.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match juniorsMatch = matchRepository.save(Match.builder().clubId(club.getId())
                .homeTeamId(juniorsTeam.getId()).awayTeamName("Occasionals").seasonId(season.getId())
                .matchDate(Instant.now().plus(7, ChronoUnit.DAYS)).active(true).build());
        Match openMatch = matchRepository.save(Match.builder().clubId(club.getId())
                .homeTeamId(openTeam.getId()).awayTeamName("Occasionals").seasonId(season.getId())
                .matchDate(Instant.now().plus(7, ChronoUnit.DAYS)).active(true).build());
        JwtRequestPostProcessor sectionAdmin = grantSectionAdmin("juniors-admin-sub", juniors.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}",
                                club.getId(),
                                juniorsMatch.getId())
                        .with(sectionAdmin))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}",
                                club.getId(),
                                openMatch.getId())
                        .with(sectionAdmin))
                .andExpect(status().isForbidden());
    }

    @Test
    void listNarrowsToASectionScopedAdminsOwnAccessibleSectionsByDefault() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section juniors = sectionRepository.save(newSection(club.getId(), "Juniors"));
        Section open = sectionRepository.save(newSection(club.getId(), "Open"));
        Team juniorsTeam = teamRepository.save(newTeam(club.getId(), juniors.getId(), "U15"));
        Team openTeam = teamRepository.save(newTeam(club.getId(), open.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(juniorsTeam.getId())
                .awayTeamName("Occasionals").seasonId(season.getId())
                .matchDate(Instant.now().plus(7, ChronoUnit.DAYS)).active(true).build());
        matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(openTeam.getId())
                .awayTeamName("Occasionals").seasonId(season.getId())
                .matchDate(Instant.now().plus(7, ChronoUnit.DAYS)).active(true).build());
        JwtRequestPostProcessor sectionAdmin = grantSectionAdmin("juniors-admin-sub", juniors.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/matches", club.getId()).with(sectionAdmin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].homeTeamId").value(juniorsTeam.getId().toString()));
    }

    @Test
    void clubScopeAdminAccessIsUnchangedByTheSectionScopedAccessChanges() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/matches", club.getId()).with(admin))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(matchBody(season.getId())))
                .andExpect(status().isCreated());
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

    private String matchBody(UUID seasonId) {
        return """
                {
                    "homeTeamName": "Riverside 1st XI",
                    "awayTeamName": "Occasionals",
                    "seasonId": "%s",
                    "matchDate": "%s",
                    "venue": "Home Ground"
                }
                """.formatted(seasonId, Instant.now().plus(7, ChronoUnit.DAYS));
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

    private League newLeague(UUID clubId) {
        return League.builder()
                .clubId(clubId)
                .name("Lakeside League")
                .source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11)
                .allowSubstitutions(false)
                .active(true)
                .build();
    }

    private Match newFreeTextMatch(UUID clubId, UUID seasonId) {
        return Match.builder()
                .clubId(clubId)
                .homeTeamName("Riverside 1st XI")
                .awayTeamName("Occasionals")
                .seasonId(seasonId)
                .matchDate(Instant.now().plus(7, ChronoUnit.DAYS))
                .active(true)
                .build();
    }
}
