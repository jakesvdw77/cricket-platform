package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static com.cricketlegend.PlatformRoleJwtPostProcessors.withSubject;
import static org.assertj.core.api.Assertions.assertThat;
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
import com.cricketlegend.domain.LeagueTeam;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.LeagueTeamRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.jayway.jsonpath.JsonPath;
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
 * HTTP-layer integration test for LeagueTeamController (docs/specs/070-league-teams.md): a real
 * {@code CLUB_ADMIN}, another club's admin (403), the {@code platform_admin} superset, the
 * 400/404/409 cases, copy result shape, remove outcomes, name/logo propagation to matches, and
 * match create/update with league-team sides through real HTTP.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class LeagueTeamControllerIntegrationTest {

    private static final String BASE =
            "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/league-teams";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private LeagueRepository leagueRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private LeagueTeamRepository leagueTeamRepository;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    private Club club;
    private League league;
    private Season season;
    private JwtRequestPostProcessor admin;

    private void seed() {
        club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        league = leagueRepository.save(newLeague(club.getId(), "Premier League"));
        season = seasonRepository.save(newSeason(club.getId(), "2026"));
        admin = grantClubAdmin("club-admin-sub", club.getId());
    }

    private String createBody(String name) {
        return """
                {"name": "%s", "abbreviation": "RCC", "logoUrl": "/media/rcc.png"}
                """.formatted(name);
    }

    private String createViaHttp(String name) throws Exception {
        String response = mockMvc.perform(post(BASE, club.getId(), league.getId(), season.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(name)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(response, "$.id");
    }

    // --- create / list ---

    @Test
    void createReturns201WithTheTrimmedNameAndListReturnsItSortedByName() throws Exception {
        seed();

        mockMvc.perform(post(BASE, club.getId(), league.getId(), season.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"  Riverside CC \", \"abbreviation\": \"RCC\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Riverside CC"))
                .andExpect(jsonPath("$.abbreviation").value("RCC"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.referencedByMatchCount").value(0))
                .andExpect(jsonPath("$.leagueId").value(league.getId().toString()))
                .andExpect(jsonPath("$.seasonId").value(season.getId().toString()));
        createViaHttp("Aardvark CC");

        mockMvc.perform(get(BASE, club.getId(), league.getId(), season.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].name").value("Aardvark CC"))
                .andExpect(jsonPath("$[1].name").value("Riverside CC"));
    }

    @Test
    void createWithABlankNameReturns400() throws Exception {
        seed();

        mockMvc.perform(post(BASE, club.getId(), league.getId(), season.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createWithADuplicateNameDifferingOnlyByCaseReturns409() throws Exception {
        seed();
        createViaHttp("Riverside CC");

        mockMvc.perform(post(BASE, club.getId(), league.getId(), season.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("riverside cc")))
                .andExpect(status().isConflict());
    }

    @Test
    void listWithActiveOnlyDropsInactiveTeams() throws Exception {
        seed();
        String id = createViaHttp("Riverside CC");
        createViaHttp("Hillside CC");
        mockMvc.perform(post(BASE + "/{id}/deactivate", club.getId(), league.getId(), season.getId(), id).with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(get(BASE, club.getId(), league.getId(), season.getId()).with(admin))
                .andExpect(jsonPath("$.length()").value(2));
        mockMvc.perform(get(BASE + "?activeOnly=true", club.getId(), league.getId(), season.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Hillside CC"));
    }

    // --- access ---

    @Test
    void anotherClubsAdminIsForbiddenFromReadingOrWritingThisClubsLeagueTeams() throws Exception {
        seed();
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        JwtRequestPostProcessor otherAdmin = grantClubAdmin("other-admin-sub", clubY.getId());

        mockMvc.perform(get(BASE, club.getId(), league.getId(), season.getId()).with(otherAdmin))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(BASE, club.getId(), league.getId(), season.getId())
                        .with(otherAdmin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("X")))
                .andExpect(status().isForbidden());
    }

    @Test
    void ownClubAdminUsingAnotherClubsLeagueOrSeasonIdGets404() throws Exception {
        seed();
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        League leagueY = leagueRepository.save(newLeague(clubY.getId(), "Y League"));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId(), "2026"));

        mockMvc.perform(get(BASE, club.getId(), leagueY.getId(), season.getId()).with(admin))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(BASE, club.getId(), league.getId(), seasonY.getId()).with(admin))
                .andExpect(status().isNotFound());
    }

    @Test
    void aLeagueTeamIdOfAnotherSeasonReturns404() throws Exception {
        seed();
        Season otherSeason = seasonRepository.save(newSeason(club.getId(), "2027"));
        LeagueTeam elsewhere = leagueTeamRepository.save(LeagueTeam.builder().leagueId(league.getId())
                .seasonId(otherSeason.getId()).name("Elsewhere").active(true).build());

        mockMvc.perform(put(BASE + "/{id}", club.getId(), league.getId(), season.getId(), elsewhere.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("Renamed")))
                .andExpect(status().isNotFound());
    }

    @Test
    void platformAdminHasSupersetAccess() throws Exception {
        seed();

        mockMvc.perform(post(BASE, club.getId(), league.getId(), season.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("Riverside CC")))
                .andExpect(status().isCreated());
        mockMvc.perform(get(BASE, club.getId(), league.getId(), season.getId()).with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    // --- update / propagation ---

    @Test
    void updateRenamesAndPropagatesToMatchesThroughRealHttp() throws Exception {
        seed();
        String id = createViaHttp("Riversde CC");
        String matchResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(matchBody(null, "Riverside 1st XI", id, league.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.awayLeagueTeamId").value(id))
                .andExpect(jsonPath("$.awayTeamName").value("Riversde CC"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String matchId = JsonPath.read(matchResponse, "$.id");

        mockMvc.perform(put(BASE + "/{id}", club.getId(), league.getId(), season.getId(), id)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Riverside CC\", \"abbreviation\": \"RCC\", \"logoUrl\": \"/media/new.png\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Riverside CC"))
                .andExpect(jsonPath("$.referencedByMatchCount").value(1));

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/matches/{matchId}", club.getId(), matchId).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.awayTeamName").value("Riverside CC"))
                .andExpect(jsonPath("$.awayTeamLogoUrl").value("/media/new.png"));
    }

    @Test
    void updateWithADuplicateNameReturns409() throws Exception {
        seed();
        createViaHttp("Riverside CC");
        String id = createViaHttp("Hillside CC");

        mockMvc.perform(put(BASE + "/{id}", club.getId(), league.getId(), season.getId(), id)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("RIVERSIDE CC")))
                .andExpect(status().isConflict());
    }

    // --- deactivate / reactivate / remove ---

    @Test
    void deactivateAndReactivateReturn409WhenAlreadyInThatState() throws Exception {
        seed();
        String id = createViaHttp("Riverside CC");

        mockMvc.perform(post(BASE + "/{id}/reactivate", club.getId(), league.getId(), season.getId(), id).with(admin))
                .andExpect(status().isConflict());
        mockMvc.perform(post(BASE + "/{id}/deactivate", club.getId(), league.getId(), season.getId(), id).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
        mockMvc.perform(post(BASE + "/{id}/deactivate", club.getId(), league.getId(), season.getId(), id).with(admin))
                .andExpect(status().isConflict());
        mockMvc.perform(post(BASE + "/{id}/reactivate", club.getId(), league.getId(), season.getId(), id).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void removeDeletesAnUnreferencedTeam() throws Exception {
        seed();
        String id = createViaHttp("Riverside CC");

        mockMvc.perform(post(BASE + "/{id}/remove", club.getId(), league.getId(), season.getId(), id).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("DELETED"))
                .andExpect(jsonPath("$.leagueTeam").doesNotExist());
        assertThat(leagueTeamRepository.findById(UUID.fromString(id))).isEmpty();
    }

    @Test
    void removeDeactivatesATeamThatAMatchReferences() throws Exception {
        seed();
        String id = createViaHttp("Riverside CC");
        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(matchBody(id, null, null, league.getId())))
                .andExpect(status().isCreated());

        mockMvc.perform(post(BASE + "/{id}/remove", club.getId(), league.getId(), season.getId(), id).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("DEACTIVATED"))
                .andExpect(jsonPath("$.leagueTeam.active").value(false))
                .andExpect(jsonPath("$.leagueTeam.referencedByMatchCount").value(1));
        assertThat(leagueTeamRepository.findById(UUID.fromString(id))).isPresent();
    }

    // --- copy ---

    @Test
    void copyCreatesNewRowsSkipsDuplicatesAndReportsBoth() throws Exception {
        seed();
        Season lastSeason = seasonRepository.save(newSeason(club.getId(), "2025"));
        LeagueTeam riverside = leagueTeamRepository.save(LeagueTeam.builder().leagueId(league.getId())
                .seasonId(lastSeason.getId()).name("Riverside CC").abbreviation("RCC").logoUrl("/media/r.png")
                .active(false).build());
        LeagueTeam hillside = leagueTeamRepository.save(LeagueTeam.builder().leagueId(league.getId())
                .seasonId(lastSeason.getId()).name("Hillside CC").active(true).build());
        leagueTeamRepository.save(LeagueTeam.builder().leagueId(league.getId()).seasonId(lastSeason.getId())
                .name("Unticked CC").active(true).build());
        createViaHttp("hillside cc");

        mockMvc.perform(post(BASE + "/copy", club.getId(), league.getId(), season.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"sourceLeagueId": "%s", "sourceSeasonId": "%s", "leagueTeamIds": ["%s", "%s"]}
                                """.formatted(league.getId(), lastSeason.getId(), riverside.getId(), hillside.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.created.length()").value(1))
                .andExpect(jsonPath("$.created[0].name").value("Riverside CC"))
                .andExpect(jsonPath("$.created[0].abbreviation").value("RCC"))
                .andExpect(jsonPath("$.created[0].logoUrl").value("/media/r.png"))
                .andExpect(jsonPath("$.created[0].active").value(true))
                .andExpect(jsonPath("$.created[0].seasonId").value(season.getId().toString()))
                .andExpect(jsonPath("$.skipped.length()").value(1))
                .andExpect(jsonPath("$.skipped[0].name").value("Hillside CC"))
                .andExpect(jsonPath("$.skipped[0].reason").value("DUPLICATE_NAME"));

        mockMvc.perform(get(BASE, club.getId(), league.getId(), season.getId()).with(admin))
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void copyWithEmptyIdsReturns400() throws Exception {
        seed();

        mockMvc.perform(post(BASE + "/copy", club.getId(), league.getId(), season.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"sourceLeagueId": "%s", "sourceSeasonId": "%s", "leagueTeamIds": []}
                                """.formatted(league.getId(), season.getId())))
                .andExpect(status().isBadRequest());
    }

    @Test
    void copyWithAnIdOutsideTheStatedSourceReturns400() throws Exception {
        seed();
        Season lastSeason = seasonRepository.save(newSeason(club.getId(), "2025"));
        LeagueTeam inCurrentSeason = leagueTeamRepository.save(LeagueTeam.builder().leagueId(league.getId())
                .seasonId(season.getId()).name("Riverside CC").active(true).build());

        mockMvc.perform(post(BASE + "/copy", club.getId(), league.getId(), season.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"sourceLeagueId": "%s", "sourceSeasonId": "%s", "leagueTeamIds": ["%s"]}
                                """.formatted(league.getId(), lastSeason.getId(), inCurrentSeason.getId())))
                .andExpect(status().isBadRequest());
    }

    @Test
    void copyFromAnotherClubsLeagueReturns404() throws Exception {
        seed();
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        League leagueY = leagueRepository.save(newLeague(clubY.getId(), "Y League"));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId(), "2026"));
        LeagueTeam foreign = leagueTeamRepository.save(LeagueTeam.builder().leagueId(leagueY.getId())
                .seasonId(seasonY.getId()).name("Foreign CC").active(true).build());

        mockMvc.perform(post(BASE + "/copy", club.getId(), league.getId(), season.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"sourceLeagueId": "%s", "sourceSeasonId": "%s", "leagueTeamIds": ["%s"]}
                                """.formatted(leagueY.getId(), seasonY.getId(), foreign.getId())))
                .andExpect(status().isNotFound());
    }

    // --- matches with league-team sides ---

    @Test
    void matchCreateWithALeagueTeamSideStoresReferenceNameAndLogoAndIgnoresClientValues() throws Exception {
        seed();
        String id = createViaHttp("Riverside CC");

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"homeTeamName": "Our XI", "awayTeamName": "Typed", "awayTeamLogoUrl": "/media/typed.png",
                                 "awayLeagueTeamId": "%s", "leagueId": "%s", "seasonId": "%s", "matchDate": "%s"}
                                """.formatted(id, league.getId(), season.getId(), Instant.now().plus(7, ChronoUnit.DAYS))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.awayLeagueTeamId").value(id))
                .andExpect(jsonPath("$.homeLeagueTeamId").doesNotExist())
                .andExpect(jsonPath("$.awayTeamName").value("Riverside CC"))
                .andExpect(jsonPath("$.awayTeamLogoUrl").value("/media/rcc.png"));
    }

    @Test
    void matchCreateWithALeagueTeamButNoLeagueReturns400() throws Exception {
        seed();
        String id = createViaHttp("Riverside CC");

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(matchBody(id, "Our XI", null, null)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void matchCreateWithAnotherClubsLeagueTeamReturns404() throws Exception {
        seed();
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        League leagueY = leagueRepository.save(newLeague(clubY.getId(), "Y League"));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId(), "2026"));
        LeagueTeam foreign = leagueTeamRepository.save(LeagueTeam.builder().leagueId(leagueY.getId())
                .seasonId(seasonY.getId()).name("Foreign CC").active(true).build());

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(matchBody(foreign.getId().toString(), "Our XI", null, league.getId())))
                .andExpect(status().isNotFound());
    }

    @Test
    void matchUpdateKeepsAnInactiveLeagueTeamAlreadyOnTheMatchButRejectsNewlySelectingOne() throws Exception {
        seed();
        String id = createViaHttp("Riverside CC");
        String otherId = createViaHttp("Hillside CC");
        String matchResponse = mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(matchBody(id, "Our XI", null, league.getId())))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String matchId = JsonPath.read(matchResponse, "$.id");
        mockMvc.perform(post(BASE + "/{id}/deactivate", club.getId(), league.getId(), season.getId(), id).with(admin))
                .andExpect(status().isOk());
        mockMvc.perform(post(BASE + "/{id}/deactivate", club.getId(), league.getId(), season.getId(), otherId)
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/matches/{matchId}", club.getId(), matchId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(matchBody(id, "Our XI", null, league.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.homeLeagueTeamId").value(id));
        mockMvc.perform(put("/api/v1/manage/clubs/{clubId}/matches/{matchId}", club.getId(), matchId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(matchBody(otherId, "Our XI", null, league.getId())))
                .andExpect(status().isBadRequest());

        Match stored = matchRepository.findById(UUID.fromString(matchId)).orElseThrow();
        assertThat(stored.getHomeLeagueTeamId()).hasToString(id);
    }

    @Test
    void matchWithTheSameLeagueTeamOnBothSidesReturns400() throws Exception {
        seed();
        String id = createViaHttp("Riverside CC");

        mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/matches", club.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(matchBody(id, null, id, league.getId())))
                .andExpect(status().isBadRequest());
    }

    /** A match body whose home side is a league team when {@code homeLeagueTeamId} is set, else free text. */
    private String matchBody(
            String homeLeagueTeamId, String homeName, String awayLeagueTeamId, UUID leagueId) {
        StringBuilder json = new StringBuilder("{");
        if (homeName != null) {
            json.append("\"homeTeamName\": \"").append(homeName).append("\", ");
        }
        if (homeLeagueTeamId != null) {
            json.append("\"homeLeagueTeamId\": \"").append(homeLeagueTeamId).append("\", ");
        }
        if (awayLeagueTeamId != null) {
            json.append("\"awayLeagueTeamId\": \"").append(awayLeagueTeamId).append("\", ");
        } else {
            json.append("\"awayTeamName\": \"Occasionals\", ");
        }
        if (leagueId != null) {
            json.append("\"leagueId\": \"").append(leagueId).append("\", ");
        }
        json.append("\"seasonId\": \"").append(season.getId()).append("\", ");
        json.append("\"matchDate\": \"").append(Instant.now().plus(7, ChronoUnit.DAYS)).append("\"}");
        return json.toString();
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

    private League newLeague(UUID clubId, String name) {
        return League.builder()
                .clubId(clubId)
                .name(name)
                .source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11)
                .active(true)
                .build();
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
}
