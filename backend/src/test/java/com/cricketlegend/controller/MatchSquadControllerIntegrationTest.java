package com.cricketlegend.controller;

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
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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
 * HTTP-layer integration test for MatchSquadController — per
 * docs/specs/063-section-availability-and-flexible-squads.md's Test Plan (Integration row): a real
 * {@code CLUB_ADMIN} round-trip through {@code get}/{@code add}/{@code remove}/jersey-number
 * update, section-scoped access (a caller without access to this team's own section gets {@code
 * 403}), cross-club {@code matchId}/{@code teamId} isolation ({@code 404}), and — the real, live
 * version of the Part C hard-block proof — two real HTTP {@code add} requests for the same player
 * against two different real matches sharing the same bracket, the second one asserted as a real
 * {@code 409} naming the conflicting team/match in the error body. Mirrors {@code
 * SectionAvailabilityRoundControllerIntegrationTest}'s own comprehensive-scenario style (a few
 * full round-trip tests through real HTTP, not one assertion per method).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class MatchSquadControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private SectionRepository sectionRepository;

    @Autowired
    private SeasonRepository seasonRepository;

    @Autowired
    private TeamRepository teamRepository;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private PlayerProfileRepository playerProfileRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Test
    void clubAdminCanRoundTripGetAddUpdateJerseyNumberAndRemoveForAFlexibleTeamsMatchSquad() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Juniors"));
        Season season = seasonRepository.save(newSeason(club.getId()));
        Team team = teamRepository.save(newFlexibleTeam(club.getId(), section.getId(), "U15 Colts"));
        Match match = matchRepository.save(newMatch(club.getId(), season.getId(), team.getId(), 9));
        Person person = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile player = playerProfileRepository.save(newActivePlayerProfile(person.getId(), club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        createRound(admin, club.getId(), section.getId(), match.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad",
                                club.getId(),
                                match.getId(),
                                team.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.windowId").isNotEmpty())
                .andExpect(jsonPath("$.windowOpen").value(true))
                .andExpect(jsonPath("$.roundId").isNotEmpty())
                .andExpect(jsonPath("$.selected.length()").value(0));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad/{playerId}/add",
                                club.getId(),
                                match.getId(),
                                team.getId(),
                                player.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.playerProfileId").value(player.getId().toString()))
                .andExpect(jsonPath("$.firstName").value("Jane"));

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad",
                                club.getId(),
                                match.getId(),
                                team.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.selected.length()").value(1))
                .andExpect(jsonPath("$.selected[0].playerProfileId").value(player.getId().toString()));

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad/{playerId}",
                                club.getId(),
                                match.getId(),
                                team.getId(),
                                player.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jerseyNumber\": 9}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.squadJerseyNumber").value(9));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad/{playerId}/remove",
                                club.getId(),
                                match.getId(),
                                team.getId(),
                                player.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad",
                                club.getId(),
                                match.getId(),
                                team.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.selected.length()").value(0));
    }

    @Test
    void aSectionScopedAdminWithoutAccessToThisTeamsSectionGets403() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section juniors = sectionRepository.save(newSection(club.getId(), "Juniors"));
        Section open = sectionRepository.save(newSection(club.getId(), "Open"));
        Season season = seasonRepository.save(newSeason(club.getId()));
        Team openTeam = teamRepository.save(newFlexibleTeam(club.getId(), open.getId(), "1st XI"));
        Match match = matchRepository.save(newMatch(club.getId(), season.getId(), openTeam.getId(), 9));
        JwtRequestPostProcessor juniorsAdmin = grantSectionAdmin("juniors-admin-sub", juniors.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad",
                                club.getId(),
                                match.getId(),
                                openTeam.getId())
                        .with(juniorsAdmin))
                .andExpect(status().isForbidden());
    }

    @Test
    void clubAdminGets404ForAMatchOrTeamIdThatIsRealButBelongsToADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), "Juniors"));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId()));
        Team teamY = teamRepository.save(newFlexibleTeam(clubY.getId(), sectionY.getId(), "U15 Colts"));
        Match matchY = matchRepository.save(newMatch(clubY.getId(), seasonY.getId(), teamY.getId(), 9));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        // clubX is the caller's own club (so @PreAuthorize passes), but matchY/teamY belong to clubY.
        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad",
                                clubX.getId(),
                                matchY.getId(),
                                teamY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    /**
     * The Part C hard block's real, live proof: two real HTTP {@code add} requests for the same
     * player against two different real matches (and teams) whose own brackets both resolve to the
     * same bracket (same section, same date, same day-part) — opening one round covering both
     * matches creates exactly one shared window for them. The second {@code add} is rejected with
     * a real {@code 409}, naming the conflicting team/match in the error body, not a silent
     * failure.
     */
    @Test
    void pickingTheSamePlayerForTwoDifferentMatchesSharingTheSameBracketIsRejectedWith409() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Juniors"));
        Season season = seasonRepository.save(newSeason(club.getId()));
        Team teamA = teamRepository.save(newFlexibleTeam(club.getId(), section.getId(), "U15 Colts"));
        Team teamB = teamRepository.save(newFlexibleTeam(club.getId(), section.getId(), "U15 Panthers"));
        Match matchA = matchRepository.save(newMatch(club.getId(), season.getId(), teamA.getId(), 9));
        Match matchB = matchRepository.save(newMatch(club.getId(), season.getId(), teamB.getId(), 9));
        Person person = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile player = playerProfileRepository.save(newActivePlayerProfile(person.getId(), club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        // Both matches selected into one round, in the same section+date+day-part bracket, so
        // opening it creates exactly one shared SectionAvailabilityWindow for both.
        createRound(admin, club.getId(), section.getId(), matchA.getId(), matchB.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad/{playerId}/add",
                                club.getId(),
                                matchA.getId(),
                                teamA.getId(),
                                player.getId())
                        .with(admin))
                .andExpect(status().isOk());

        String conflictResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/teams/{teamId}/squad/{playerId}/add",
                                club.getId(),
                                matchB.getId(),
                                teamB.getId(),
                                player.getId())
                        .with(admin))
                .andExpect(status().isConflict())
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(conflictResponse).contains(matchA.getId().toString());
        assertThat(conflictResponse).contains(teamA.getId().toString());
    }

    private String createRound(JwtRequestPostProcessor admin, UUID clubId, UUID sectionId, UUID... matchIds)
            throws Exception {
        StringBuilder matchIdsJson = new StringBuilder();
        for (int i = 0; i < matchIds.length; i++) {
            if (i > 0) {
                matchIdsJson.append(", ");
            }
            matchIdsJson.append('"').append(matchIds[i]).append('"');
        }
        return mockMvc.perform(post("/api/v1/manage/clubs/{clubId}/section-availability-rounds", clubId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sectionId\": \"" + sectionId + "\", \"description\": \"Saturday fixtures\", "
                                + "\"matchIds\": [" + matchIdsJson + "], \"autoClose\": true}"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
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

    private Season newSeason(UUID clubId) {
        return Season.builder().clubId(clubId).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build();
    }

    private Team newFlexibleTeam(UUID clubId, UUID sectionId, String name) {
        return Team.builder().clubId(clubId).sectionId(sectionId).name(name).active(true).build();
    }

    /** A future match (needed by the fixture-group resolver a round's own creation relies on). */
    private Match newMatch(UUID clubId, UUID seasonId, UUID homeTeamId, int hourOfDay) {
        Instant matchDate = LocalDate.now(ZoneId.systemDefault())
                .plus(2, ChronoUnit.DAYS)
                .atTime(hourOfDay, 0)
                .atZone(ZoneId.systemDefault())
                .toInstant();
        return Match.builder().clubId(clubId).homeTeamId(homeTeamId).awayTeamName("Occasionals")
                .seasonId(seasonId).matchDate(matchDate).active(true).build();
    }

    private Person newPlayerPerson(String firstName, String lastName) {
        return Person.builder().firstName(firstName).lastName(lastName).build();
    }

    private PlayerProfile newActivePlayerProfile(UUID personId, UUID clubId) {
        return PlayerProfile.builder().personId(personId).clubId(clubId).active(true).build();
    }
}
