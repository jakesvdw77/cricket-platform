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
import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Contact;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Sponsor;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.ClubContactRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.SponsorRepository;
import com.cricketlegend.repository.TeamRepository;
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
 * HTTP-layer integration test for TeamController — per docs/specs/026-teams.md's Test Plan,
 * following docs/specs/025-club-structure.md's own {@code SectionControllerIntegrationTest}
 * pattern exactly ({@code withSubject}, a real {@code Person} + {@code
 * RoleAssignment(CLUB_ADMIN, CLUB, clubId)} row): a real {@code CLUB_ADMIN} can reach all six
 * endpoints for their own club, gets {@code 403} for a different club and {@code 404} for a
 * {@code sectionId} that's real but belongs to a different club, a {@code platform_admin} JWT
 * also succeeds (proving {@code AccessService.canAdministerClub}'s superset-access claim
 * end-to-end), both transition {@code 409}s are proven through the real HTTP layer, and the flat
 * club-wide {@code GET} returns teams from multiple different sections in one call.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class TeamControllerIntegrationTest {

    private static final String TEAM_BODY = """
            {
                "name": "1st XI"
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
    private PersonRepository personRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Autowired
    private ClubContactRepository clubContactRepository;

    @Autowired
    private SponsorRepository sponsorRepository;

    @Test
    void clubAdminCanReachAllSixEndpointsForTheirOwnClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/teams", club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams",
                                club.getId(),
                                section.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        String createResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams",
                                club.getId(),
                                section.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TEAM_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("1st XI"))
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.sectionId").value(section.getId().toString()))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String teamId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        String updateBody = """
                {
                    "name": "1st XI (renamed)"
                }
                """;
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}",
                                club.getId(),
                                section.getId(),
                                teamId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("1st XI (renamed)"));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/deactivate",
                                club.getId(),
                                section.getId(),
                                teamId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/reactivate",
                                club.getId(),
                                section.getId(),
                                teamId)
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void clubAdminGets403OnAllEndpointsForADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), "Men"));
        Team teamY = teamRepository.save(newTeam(clubY.getId(), sectionY.getId(), "1st XI"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/teams", clubY.getId()).with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams",
                                clubY.getId(),
                                sectionY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams",
                                clubY.getId(),
                                sectionY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TEAM_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}",
                                clubY.getId(),
                                sectionY.getId(),
                                teamY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TEAM_BODY))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/deactivate",
                                clubY.getId(),
                                sectionY.getId(),
                                teamY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/reactivate",
                                clubY.getId(),
                                sectionY.getId(),
                                teamY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());
    }

    @Test
    void clubAdminGets404ForASectionIdThatIsRealButBelongsToADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), "Men"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        // clubX is the caller's own club (so @PreAuthorize passes), but sectionY belongs to
        // clubY — the service's findSectionOrThrowForClub must 404 this, not the controller's
        // @PreAuthorize.
        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams",
                                clubX.getId(),
                                sectionY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams",
                                clubX.getId(),
                                sectionY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TEAM_BODY))
                .andExpect(status().isNotFound());
    }

    @Test
    void clubAdminGets404ForATeamIdThatIsRealButBelongsToADifferentSection() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section sectionA = sectionRepository.save(newSection(club.getId(), "Men"));
        Section sectionB = sectionRepository.save(newSection(club.getId(), "Women"));
        Team teamUnderA = teamRepository.save(newTeam(club.getId(), sectionA.getId(), "1st XI"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}",
                                club.getId(),
                                sectionB.getId(),
                                teamUnderA.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TEAM_BODY))
                .andExpect(status().isNotFound());
    }

    @Test
    void platformAdminSucceedsOnAllSixEndpointsForAnArbitraryClubsTeams() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/teams", club.getId()).with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams",
                                club.getId(),
                                section.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        String createResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams",
                                club.getId(),
                                section.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TEAM_BODY))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String teamId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}",
                                club.getId(),
                                section.getId(),
                                teamId)
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(TEAM_BODY))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/deactivate",
                                club.getId(),
                                section.getId(),
                                teamId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/reactivate",
                                club.getId(),
                                section.getId(),
                                teamId)
                        .with(platformAdmin()))
                .andExpect(status().isOk());
    }

    @Test
    void callerWithNoClubAdminGrantAndNoPlatformAdminRoleGets403() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        JwtRequestPostProcessor unknown = withSubject("unknown-sub-no-person-or-grant");

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/teams", club.getId()).with(unknown))
                .andExpect(status().isForbidden());
    }

    /** Both transition {@code 409}s, proven through the real HTTP layer. */
    @Test
    void deactivateAndReactivateReturn409WhenAlreadyInThatState() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        // Already active — reactivate is the invalid transition first.
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/reactivate",
                                club.getId(),
                                section.getId(),
                                team.getId())
                        .with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("already active")));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/deactivate",
                                club.getId(),
                                section.getId(),
                                team.getId())
                        .with(admin))
                .andExpect(status().isOk());

        // Now already inactive — deactivate is the invalid transition.
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/deactivate",
                                club.getId(),
                                section.getId(),
                                team.getId())
                        .with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("already inactive")));
    }

    /** The flat club-wide {@code GET} returning teams from multiple different sections in one call. */
    @Test
    void clubWideListReturnsTeamsFromMultipleDifferentSectionsInOneCall() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section sectionA = sectionRepository.save(newSection(club.getId(), "Men"));
        Section sectionB = sectionRepository.save(newSection(club.getId(), "Women"));
        teamRepository.save(newTeam(club.getId(), sectionA.getId(), "1st XI"));
        teamRepository.save(newTeam(club.getId(), sectionB.getId(), "1st XI"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/teams", club.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    /** {@code logoUrl} round-trips through the real POST create and PUT update endpoints. */
    @Test
    void logoUrlRoundTripsThroughCreateAndUpdate() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        String createBody = """
                {
                    "name": "1st XI",
                    "logoUrl": "https://example.com/logo.png"
                }
                """;
        String createResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams",
                                club.getId(),
                                section.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.logoUrl").value("https://example.com/logo.png"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String teamId = com.jayway.jsonpath.JsonPath.read(createResponse, "$.id");

        String updateBody = """
                {
                    "name": "1st XI",
                    "logoUrl": "https://example.com/new-logo.png"
                }
                """;
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}",
                                club.getId(),
                                section.getId(),
                                teamId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logoUrl").value("https://example.com/new-logo.png"));

        String clearBody = """
                {
                    "name": "1st XI",
                    "logoUrl": null
                }
                """;
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}",
                                club.getId(),
                                section.getId(),
                                teamId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(clearBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logoUrl").doesNotExist());
    }

    /**
     * A real {@code CLUB_ADMIN} can reach all six of docs/specs/027-team-profile.md's new
     * contact/sponsor endpoints for their own club: list (empty), link, list (populated),
     * unlink, list (empty again) — for both {@code TeamContact} and {@code TeamSponsor}.
     */
    @Test
    void clubAdminCanReachAllSixNewContactAndSponsorEndpointsForTheirOwnClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        ClubContact contact = clubContactRepository.save(newClubContact(club.getId()));
        Sponsor sponsor = sponsorRepository.save(newSponsor(club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts",
                                club.getId(),
                                section.getId(),
                                team.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        String linkContactBody = """
                {
                    "role": "Coach"
                }
                """;
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts/{contactId}/link",
                                club.getId(),
                                section.getId(),
                                team.getId(),
                                contact.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(linkContactBody))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts",
                                club.getId(),
                                section.getId(),
                                team.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].role").value("Coach"))
                .andExpect(jsonPath("$[0].contact.id").value(contact.getId().toString()));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts/{contactId}/unlink",
                                club.getId(),
                                section.getId(),
                                team.getId(),
                                contact.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts",
                                club.getId(),
                                section.getId(),
                                team.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors",
                                club.getId(),
                                section.getId(),
                                team.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors/{sponsorId}/link",
                                club.getId(),
                                section.getId(),
                                team.getId(),
                                sponsor.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors",
                                club.getId(),
                                section.getId(),
                                team.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(sponsor.getId().toString()));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors/{sponsorId}/unlink",
                                club.getId(),
                                section.getId(),
                                team.getId(),
                                sponsor.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors",
                                club.getId(),
                                section.getId(),
                                team.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void clubAdminGets403OnAllSixNewEndpointsForADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), "Men"));
        Team teamY = teamRepository.save(newTeam(clubY.getId(), sectionY.getId(), "1st XI"));
        UUID contactId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts",
                                clubY.getId(),
                                sectionY.getId(),
                                teamY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts/{contactId}/link",
                                clubY.getId(),
                                sectionY.getId(),
                                teamY.getId(),
                                contactId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\": \"Coach\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts/{contactId}/unlink",
                                clubY.getId(),
                                sectionY.getId(),
                                teamY.getId(),
                                contactId)
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors",
                                clubY.getId(),
                                sectionY.getId(),
                                teamY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors/{sponsorId}/link",
                                clubY.getId(),
                                sectionY.getId(),
                                teamY.getId(),
                                sponsorId)
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors/{sponsorId}/unlink",
                                clubY.getId(),
                                sectionY.getId(),
                                teamY.getId(),
                                sponsorId)
                        .with(admin))
                .andExpect(status().isForbidden());
    }

    @Test
    void clubAdminGets404OnTheSixNewEndpointsForASectionIdThatIsRealButBelongsToADifferentClub()
            throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), "Men"));
        Team teamY = teamRepository.save(newTeam(clubY.getId(), sectionY.getId(), "1st XI"));
        UUID contactId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        // clubX is the caller's own club (so @PreAuthorize passes), but sectionY (and teamY)
        // belong to clubY — the service's scoping chain must 404 this, not the controller's
        // @PreAuthorize.
        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts",
                                clubX.getId(),
                                sectionY.getId(),
                                teamY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts/{contactId}/link",
                                clubX.getId(),
                                sectionY.getId(),
                                teamY.getId(),
                                contactId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\": \"Coach\"}"))
                .andExpect(status().isNotFound());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors",
                                clubX.getId(),
                                sectionY.getId(),
                                teamY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors/{sponsorId}/link",
                                clubX.getId(),
                                sectionY.getId(),
                                teamY.getId(),
                                sponsorId)
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    @Test
    void platformAdminSucceedsOnAllSixNewEndpointsForAnArbitraryClubsTeam() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        ClubContact contact = clubContactRepository.save(newClubContact(club.getId()));
        Sponsor sponsor = sponsorRepository.save(newSponsor(club.getId()));

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts",
                                club.getId(),
                                section.getId(),
                                team.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts/{contactId}/link",
                                club.getId(),
                                section.getId(),
                                team.getId(),
                                contact.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\": \"Coach\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts/{contactId}/unlink",
                                club.getId(),
                                section.getId(),
                                team.getId(),
                                contact.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors",
                                club.getId(),
                                section.getId(),
                                team.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors/{sponsorId}/link",
                                club.getId(),
                                section.getId(),
                                team.getId(),
                                sponsor.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors/{sponsorId}/unlink",
                                club.getId(),
                                section.getId(),
                                team.getId(),
                                sponsor.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());
    }

    /** The already-linked {@code 409} and the no-such-link {@code 404}, through real HTTP. */
    @Test
    void linkingAnAlreadyLinkedContactOrSponsorReturns409AndUnlinkingAnUnlinkedOneReturns404()
            throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        ClubContact contact = clubContactRepository.save(newClubContact(club.getId()));
        Sponsor sponsor = sponsorRepository.save(newSponsor(club.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts/{contactId}/unlink",
                                club.getId(),
                                section.getId(),
                                team.getId(),
                                contact.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors/{sponsorId}/unlink",
                                club.getId(),
                                section.getId(),
                                team.getId(),
                                sponsor.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts/{contactId}/link",
                                club.getId(),
                                section.getId(),
                                team.getId(),
                                contact.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\": \"Coach\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts/{contactId}/link",
                                club.getId(),
                                section.getId(),
                                team.getId(),
                                contact.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\": \"Manager\"}"))
                .andExpect(status().isConflict());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors/{sponsorId}/link",
                                club.getId(),
                                section.getId(),
                                team.getId(),
                                sponsor.getId())
                        .with(admin))
                .andExpect(status().isOk());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors/{sponsorId}/link",
                                club.getId(),
                                section.getId(),
                                team.getId(),
                                sponsor.getId())
                        .with(admin))
                .andExpect(status().isConflict());
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

    private ClubContact newClubContact(UUID clubId) {
        return ClubContact.builder()
                .clubId(clubId)
                .contact(Contact.builder()
                        .firstName("Jane")
                        .lastName("Doe")
                        .email("jane@example.com")
                        .phone("0123456789")
                        .build())
                .role("Treasurer")
                .active(true)
                .build();
    }

    private Sponsor newSponsor(UUID clubId) {
        return Sponsor.builder().clubId(clubId).name("Acme Co").active(true).build();
    }
}
