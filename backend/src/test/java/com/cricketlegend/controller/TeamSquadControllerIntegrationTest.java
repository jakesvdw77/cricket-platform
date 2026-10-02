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
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
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
 * HTTP-layer integration test for TeamSquadController — per docs/specs/029-league-management.md's
 * Test Plan, following {@code TeamControllerIntegrationTest}'s pattern exactly: a real {@code
 * CLUB_ADMIN} can reach all three endpoints for their own club, gets {@code 403} for a different
 * club and {@code 404} for a {@code teamId}/{@code seasonId}/{@code playerId} that's real but
 * belongs to a different club, a {@code platform_admin} JWT also succeeds, the inactive-player
 * {@code 400} ({@link com.cricketlegend.exception.PlayerNotActiveClubMemberException}), the
 * already-in-squad {@code 409}, and the not-in-squad {@code 404} on remove are all proven through
 * the real HTTP layer. Also covers docs/specs/031-jersey-numbers.md's new {@code PUT
 * .../squad/{playerId}} endpoint: {@code 200} (persists and is reflected in a subsequent {@code
 * GET .../squad}), {@code 400} (negative), {@code 404} (player not in that season's squad), {@code
 * 409} (duplicate), and cross-club isolation.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class TeamSquadControllerIntegrationTest {

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
    private PersonRepository personRepository;

    @Autowired
    private PlayerProfileRepository playerProfileRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Test
    void clubAdminCanReachAllThreeEndpointsForTheirOwnClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Person person = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile player = playerProfileRepository.save(newActivePlayerProfile(person.getId(), club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad",
                                club.getId(),
                                team.getId(),
                                season.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                player.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.playerProfileId").value(player.getId().toString()))
                .andExpect(jsonPath("$.firstName").value("Jane"));

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad",
                                club.getId(),
                                team.getId(),
                                season.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].playerProfileId").value(player.getId().toString()));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/remove",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                player.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad",
                                club.getId(),
                                team.getId(),
                                season.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void clubAdminGets403OnAllThreeEndpointsForADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), "Men"));
        Team teamY = teamRepository.save(newTeam(clubY.getId(), sectionY.getId(), "1st XI"));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId(), "2026"));
        Person personY = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile playerY =
                playerProfileRepository.save(newActivePlayerProfile(personY.getId(), clubY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad",
                                clubY.getId(),
                                teamY.getId(),
                                seasonY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                clubY.getId(),
                                teamY.getId(),
                                seasonY.getId(),
                                playerY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/remove",
                                clubY.getId(),
                                teamY.getId(),
                                seasonY.getId(),
                                playerY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());
    }

    @Test
    void clubAdminGets404ForATeamSeasonOrPlayerIdThatIsRealButBelongsToADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionX = sectionRepository.save(newSection(clubX.getId(), "Men"));
        Team teamX = teamRepository.save(newTeam(clubX.getId(), sectionX.getId(), "1st XI"));
        Season seasonX = seasonRepository.save(newSeason(clubX.getId(), "2026"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), "Men"));
        Team teamY = teamRepository.save(newTeam(clubY.getId(), sectionY.getId(), "1st XI"));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId(), "2026"));
        Person personY = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile playerY =
                playerProfileRepository.save(newActivePlayerProfile(personY.getId(), clubY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        // clubX is the caller's own club (so @PreAuthorize passes), but teamY belongs to clubY.
        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad",
                                clubX.getId(),
                                teamY.getId(),
                                seasonX.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        // teamX is clubX's own, but seasonY belongs to clubY.
        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad",
                                clubX.getId(),
                                teamX.getId(),
                                seasonY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        // teamX/seasonX are clubX's own, but playerY belongs to clubY.
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                clubX.getId(),
                                teamX.getId(),
                                seasonX.getId(),
                                playerY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    @Test
    void platformAdminSucceedsOnAllThreeEndpointsForAnArbitraryClubsSquad() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Person person = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile player = playerProfileRepository.save(newActivePlayerProfile(person.getId(), club.getId()));

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad",
                                club.getId(),
                                team.getId(),
                                season.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                player.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/remove",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                player.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());
    }

    @Test
    void callerWithNoClubAdminGrantAndNoPlatformAdminRoleGets403() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        JwtRequestPostProcessor unknown = withSubject("unknown-sub-no-person-or-grant");

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad",
                                club.getId(),
                                team.getId(),
                                season.getId())
                        .with(unknown))
                .andExpect(status().isForbidden());
    }

    /** The inactive-player {@code 400}, proven through real HTTP. */
    @Test
    void addingAnInactivePlayerReturns400() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Person person = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile inactivePlayer = playerProfileRepository.save(PlayerProfile.builder()
                .personId(person.getId())
                .clubId(club.getId())
                .active(false)
                .build());
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                inactivePlayer.getId())
                        .with(admin))
                .andExpect(status().isBadRequest());
    }

    /** The already-in-squad {@code 409}, proven through real HTTP. */
    @Test
    void addingAPlayerAlreadyInThatSeasonsSquadReturns409() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Person person = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile player = playerProfileRepository.save(newActivePlayerProfile(person.getId(), club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                player.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                player.getId())
                        .with(admin))
                .andExpect(status().isConflict());
    }

    /** The not-in-squad {@code 404} on remove, proven through real HTTP. */
    @Test
    void removingAPlayerNotCurrentlyInThatSeasonsSquadReturns404() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Person person = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile player = playerProfileRepository.save(newActivePlayerProfile(person.getId(), club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/remove",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                player.getId())
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    /**
     * Squad membership is season-scoped — adding a player for one season has no effect on
     * another season's squad for the same team.
     */
    @Test
    void squadMembershipIsScopedIndependentlyPerSeason() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season2026 = seasonRepository.save(newSeason(club.getId(), "2026"));
        Season season2027 = seasonRepository.save(Season.builder()
                .clubId(club.getId())
                .label("2027")
                .startDate(LocalDate.of(2027, 1, 1))
                .endDate(LocalDate.of(2027, 12, 31))
                .active(true)
                .build());
        Person person = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile player = playerProfileRepository.save(newActivePlayerProfile(person.getId(), club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                club.getId(),
                                team.getId(),
                                season2026.getId(),
                                player.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad",
                                club.getId(),
                                team.getId(),
                                season2027.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    /** The new {@code PUT .../squad/{playerId}}'s {@code 200}, persisted and reflected on a subsequent GET. */
    @Test
    void updatingASquadMembersJerseyNumberReturns200AndPersists() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Person person = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile player = playerProfileRepository.save(newActivePlayerProfile(person.getId(), club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                player.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                player.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jerseyNumber\": 9}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.squadJerseyNumber").value(9));

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad",
                                club.getId(),
                                team.getId(),
                                season.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].squadJerseyNumber").value(9));
    }

    /** The new {@code PUT}'s {@code 400} for a negative jersey number. */
    @Test
    void updatingASquadMembersJerseyNumberToANegativeValueReturns400() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Person person = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile player = playerProfileRepository.save(newActivePlayerProfile(person.getId(), club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                player.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                player.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jerseyNumber\": -1}"))
                .andExpect(status().isBadRequest());
    }

    /** The new {@code PUT}'s {@code 404} for a player not currently in that season's squad. */
    @Test
    void updatingASquadMembersJerseyNumberForAPlayerNotInThatSeasonsSquadReturns404() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Person person = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile player = playerProfileRepository.save(newActivePlayerProfile(person.getId(), club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                player.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jerseyNumber\": 9}"))
                .andExpect(status().isNotFound());
    }

    /** The new {@code PUT}'s {@code 409} when another squad member already holds that number. */
    @Test
    void updatingASquadMembersJerseyNumberToOneAlreadyHeldByAnotherMemberReturns409() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Person personA = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile playerA =
                playerProfileRepository.save(newActivePlayerProfile(personA.getId(), club.getId()));
        Person personB = personRepository.save(newPlayerPerson("Joe", "Bloggs"));
        PlayerProfile playerB =
                playerProfileRepository.save(newActivePlayerProfile(personB.getId(), club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                playerA.getId())
                        .with(admin))
                .andExpect(status().isOk());
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                playerB.getId())
                        .with(admin))
                .andExpect(status().isOk());
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                playerA.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jerseyNumber\": 9}"))
                .andExpect(status().isOk());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                playerB.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jerseyNumber\": 9}"))
                .andExpect(status().isConflict());
    }

    /**
     * docs/specs/057-team-extended-profile.md's rename of the {@code PUT} endpoint's request
     * shape ({@code UpdateTeamSquadMemberJerseyNumberRequest} to {@code
     * UpdateTeamSquadMemberRequest}, gaining {@code isCaptain}) — a real HTTP round trip proving
     * {@code isCaptain} persists and is reflected on a subsequent {@code GET}, alongside {@code
     * jerseyNumber} in the same full-resource payload.
     */
    @Test
    void updatingASquadMembersCaptainFlagReturns200AndPersists() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Person person = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile player = playerProfileRepository.save(newActivePlayerProfile(person.getId(), club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                player.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                player.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jerseyNumber\": 9, \"isCaptain\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.squadJerseyNumber").value(9))
                .andExpect(jsonPath("$.isCaptain").value(true));

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad",
                                club.getId(),
                                team.getId(),
                                season.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].squadJerseyNumber").value(9))
                .andExpect(jsonPath("$[0].isCaptain").value(true));
    }

    /**
     * The captain auto-unset case, through the real HTTP layer — mirrors {@code
     * LeagueContactControllerIntegrationTest}'s {@code
     * settingIsPrimaryTrueOnASecondContactUnsetsTheFirstContactsPrimaryFlagThroughTheHttpLayer}:
     * setting {@code isCaptain: true} on a second squad member while a different one already
     * holds it for the same team+season succeeds with no {@code 409}, and the first member's
     * {@code isCaptain} flips to {@code false}.
     */
    @Test
    void settingIsCaptainTrueOnASecondSquadMemberUnsetsTheFirstMembersCaptainFlagThroughTheHttpLayer()
            throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Person personA = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile playerA =
                playerProfileRepository.save(newActivePlayerProfile(personA.getId(), club.getId()));
        Person personB = personRepository.save(newPlayerPerson("Joe", "Bloggs"));
        PlayerProfile playerB =
                playerProfileRepository.save(newActivePlayerProfile(personB.getId(), club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                playerA.getId())
                        .with(admin))
                .andExpect(status().isOk());
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                playerB.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                playerA.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jerseyNumber\": 1, \"isCaptain\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isCaptain").value(true));

        // Marking playerB captain must succeed with no 409, even though playerA already holds it.
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}",
                                club.getId(),
                                team.getId(),
                                season.getId(),
                                playerB.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jerseyNumber\": 2, \"isCaptain\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isCaptain").value(true));

        String listResponse = mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad",
                                club.getId(),
                                team.getId(),
                                season.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        java.util.List<Boolean> playerACaptainFlags = com.jayway.jsonpath.JsonPath.read(
                listResponse, "$[?(@.playerProfileId == '" + playerA.getId() + "')].isCaptain");
        java.util.List<Boolean> playerBCaptainFlags = com.jayway.jsonpath.JsonPath.read(
                listResponse, "$[?(@.playerProfileId == '" + playerB.getId() + "')].isCaptain");
        assertThat(playerACaptainFlags).containsExactly(false);
        assertThat(playerBCaptainFlags).containsExactly(true);
    }

    /** Cross-club {@code 403} isolation for the new {@code PUT} endpoint. */
    @Test
    void updatingASquadMembersJerseyNumberForADifferentClubReturns403() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), "Men"));
        Team teamY = teamRepository.save(newTeam(clubY.getId(), sectionY.getId(), "1st XI"));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId(), "2026"));
        Person personY = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile playerY =
                playerProfileRepository.save(newActivePlayerProfile(personY.getId(), clubY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}",
                                clubY.getId(),
                                teamY.getId(),
                                seasonY.getId(),
                                playerY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jerseyNumber\": 9}"))
                .andExpect(status().isForbidden());
    }

    /** Cross-club {@code 404} isolation for the new {@code PUT} endpoint's {@code teamId}/{@code seasonId}. */
    @Test
    void updatingASquadMembersJerseyNumberForATeamOrSeasonBelongingToADifferentClubReturns404() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionX = sectionRepository.save(newSection(clubX.getId(), "Men"));
        Team teamX = teamRepository.save(newTeam(clubX.getId(), sectionX.getId(), "1st XI"));
        Season seasonX = seasonRepository.save(newSeason(clubX.getId(), "2026"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), "Men"));
        Team teamY = teamRepository.save(newTeam(clubY.getId(), sectionY.getId(), "1st XI"));
        Person personX = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile playerX =
                playerProfileRepository.save(newActivePlayerProfile(personX.getId(), clubX.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        // clubX is the caller's own club (so @PreAuthorize passes), but teamY belongs to clubY.
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}",
                                clubX.getId(),
                                teamY.getId(),
                                seasonX.getId(),
                                playerX.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jerseyNumber\": 9}"))
                .andExpect(status().isNotFound());
    }

    // --- 035: section-scoped access ---

    @Test
    void sectionScopedAdminManagesOnlyTheirOwnTeamsSquad() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section juniors = sectionRepository.save(newSection(club.getId(), "Juniors"));
        Section open = sectionRepository.save(newSection(club.getId(), "Open"));
        Team juniorsTeam = teamRepository.save(newTeam(club.getId(), juniors.getId(), "U15"));
        Team openTeam = teamRepository.save(newTeam(club.getId(), open.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Person person = personRepository.save(newPlayerPerson("Jane", "Doe"));
        PlayerProfile player = playerProfileRepository.save(newActivePlayerProfile(person.getId(), club.getId()));
        JwtRequestPostProcessor sectionAdmin = grantSectionAdmin("juniors-admin-sub", juniors.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                club.getId(),
                                juniorsTeam.getId(),
                                season.getId(),
                                player.getId())
                        .with(sectionAdmin))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad/{playerId}/add",
                                club.getId(),
                                openTeam.getId(),
                                season.getId(),
                                player.getId())
                        .with(sectionAdmin))
                .andExpect(status().isForbidden());
    }

    @Test
    void clubScopeAdminAccessIsUnchangedByTheSectionScopedAccessChanges() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/squad",
                                club.getId(),
                                team.getId(),
                                season.getId())
                        .with(admin))
                .andExpect(status().isOk());
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

    private Person newPlayerPerson(String firstName, String lastName) {
        return Person.builder().firstName(firstName).lastName(lastName).build();
    }

    private PlayerProfile newActivePlayerProfile(UUID personId, UUID clubId) {
        return PlayerProfile.builder().personId(personId).clubId(clubId).active(true).build();
    }
}
