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
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
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
 * HTTP-layer integration test for MatchSideController — per docs/specs/029-league-management.md's
 * Test Plan, following {@code TeamControllerIntegrationTest}'s pattern exactly: a real {@code
 * CLUB_ADMIN} can reach every playing-XI endpoint for their own club, gets {@code 403} for a
 * different club and {@code 404} for a {@code matchId}/{@code sideId} that's real but belongs to a
 * different club, a {@code platform_admin} JWT also succeeds, and every documented {@code
 * 400}/{@code 409} from the MatchSide/MatchSidePlayer business rules — squad membership (including
 * a wrong-season squad row), the applicable playing-XI cap, age eligibility (missing DOB and
 * out-of-range age), captain/keeper-must-be-in-XI, twelfth-man-must-not-be-in-XI, and the reorder
 * exact-set check — are all proven through the real HTTP layer.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class MatchSideControllerIntegrationTest {

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
    private MatchSideRepository matchSideRepository;

    @Autowired
    private TeamSquadMemberRepository teamSquadMemberRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private PlayerProfileRepository playerProfileRepository;

    @Autowired
    private RoleAssignmentRepository roleAssignmentRepository;

    @Test
    void clubAdminCanReachAllCoreEndpointsForTheirOwnClub() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        PlayerProfile playerA = addSquadMember(club.getId(), team.getId(), season.getId(), "Alice");
        PlayerProfile playerB = addSquadMember(club.getId(), team.getId(), season.getId(), "Bob");
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides",
                                club.getId(),
                                match.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        String createSideBody = "{\"teamId\": \"" + team.getId() + "\"}";
        String createSideResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides",
                                club.getId(),
                                match.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createSideBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.teamId").value(team.getId().toString()))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String sideId = com.jayway.jsonpath.JsonPath.read(createSideResponse, "$.id");

        String addPlayerABody = "{\"playerProfileId\": \"" + playerA.getId() + "\", \"role\": \"BATSMAN\"}";
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(addPlayerABody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.players.length()").value(1))
                .andExpect(jsonPath("$.players[0].battingOrder").value(1));

        String addPlayerBBody = "{\"playerProfileId\": \"" + playerB.getId() + "\", \"role\": \"BOWLER\"}";
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(addPlayerBBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.players.length()").value(2));

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players/{playerId}",
                                club.getId(),
                                match.getId(),
                                sideId,
                                playerA.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\": \"ALL_ROUNDER\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.players[0].role").value("ALL_ROUNDER"));

        String reorderBody = "{\"playerProfileIds\": [\"" + playerB.getId() + "\", \"" + playerA.getId() + "\"]}";
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players/reorder",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reorderBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.players[0].playerProfileId").value(playerB.getId().toString()))
                .andExpect(jsonPath("$.players[1].playerProfileId").value(playerA.getId().toString()));

        String updateSideBody = "{\"captainPlayerId\": \"" + playerB.getId() + "\", \"wicketKeeperPlayerId\": \""
                + playerA.getId() + "\"}";
        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateSideBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.captainPlayerId").value(playerB.getId().toString()))
                .andExpect(jsonPath("$.wicketKeeperPlayerId").value(playerA.getId().toString()));

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players/{playerId}/remove",
                                club.getId(),
                                match.getId(),
                                sideId,
                                playerA.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.players.length()").value(1))
                // Removing the wicketkeeper clears wicketKeeperPlayerId on the side.
                .andExpect(jsonPath("$.wicketKeeperPlayerId").doesNotExist());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides",
                                club.getId(),
                                match.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void clubAdminGets403OnAllEndpointsForADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), "Men"));
        Team teamY = teamRepository.save(newTeam(clubY.getId(), sectionY.getId(), "1st XI"));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId(), "2026"));
        Match matchY = matchRepository.save(newMatchWithoutLeague(clubY.getId(), teamY.getId(), seasonY.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides",
                                clubY.getId(),
                                matchY.getId())
                        .with(admin))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides",
                                clubY.getId(),
                                matchY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + teamY.getId() + "\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void clubAdminGets404ForAMatchOrSideIdThatIsRealButBelongsToADifferentClub() throws Exception {
        Club clubX = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Club clubY = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        Section sectionY = sectionRepository.save(newSection(clubY.getId(), "Men"));
        Team teamY = teamRepository.save(newTeam(clubY.getId(), sectionY.getId(), "1st XI"));
        Season seasonY = seasonRepository.save(newSeason(clubY.getId(), "2026"));
        Match matchY = matchRepository.save(newMatchWithoutLeague(clubY.getId(), teamY.getId(), seasonY.getId()));
        MatchSide sideY =
                matchSideRepository.save(MatchSide.builder().matchId(matchY.getId()).teamId(teamY.getId()).build());
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", clubX.getId());

        // clubX is the caller's own club (so @PreAuthorize passes), but matchY belongs to clubY.
        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides",
                                clubX.getId(),
                                matchY.getId())
                        .with(admin))
                .andExpect(status().isNotFound());

        // Set up a real match under clubX, but reference clubY's own sideId under it.
        Section sectionX = sectionRepository.save(newSection(clubX.getId(), "Men"));
        Team teamX = teamRepository.save(newTeam(clubX.getId(), sectionX.getId(), "1st XI"));
        Season seasonX = seasonRepository.save(newSeason(clubX.getId(), "2026"));
        Match matchX = matchRepository.save(newMatchWithoutLeague(clubX.getId(), teamX.getId(), seasonX.getId()));

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}",
                                clubX.getId(),
                                matchX.getId(),
                                sideY.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void platformAdminSucceedsOnCoreEndpointsForAnArbitraryClubsMatch() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        PlayerProfile player = addSquadMember(club.getId(), team.getId(), season.getId(), "Alice");

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides",
                                club.getId(),
                                match.getId())
                        .with(platformAdmin()))
                .andExpect(status().isOk());

        String createSideResponse = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides",
                                club.getId(),
                                match.getId())
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + team.getId() + "\"}"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String sideId = com.jayway.jsonpath.JsonPath.read(createSideResponse, "$.id");

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerProfileId\": \"" + player.getId() + "\", \"role\": \"BATSMAN\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void callerWithNoClubAdminGrantAndNoPlatformAdminRoleGets403() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        JwtRequestPostProcessor unknown = withSubject("unknown-sub-no-person-or-grant");

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides",
                                club.getId(),
                                match.getId())
                        .with(unknown))
                .andExpect(status().isForbidden());
    }

    @Test
    void createSideReturns400WhenTeamIdIsNotOneOfTheMatchsOwnTeams() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Team unrelatedTeam = teamRepository.save(newTeam(club.getId(), section.getId(), "2nd XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides",
                                club.getId(),
                                match.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + unrelatedTeam.getId() + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createSideReturns409WhenASideForThatTeamAlreadyExists() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        String body = "{\"teamId\": \"" + team.getId() + "\"}";

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides",
                                club.getId(),
                                match.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides",
                                club.getId(),
                                match.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());
    }

    /** {@link com.cricketlegend.exception.PlayerNotInSquadException}, including the wrong-season case. */
    @Test
    void addPlayerReturns400WhenPlayerIsNotInTheTeamsSquadForTheMatchsOwnSeason() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season matchSeason = seasonRepository.save(newSeason(club.getId(), "2026"));
        Season otherSeason = seasonRepository.save(Season.builder()
                .clubId(club.getId())
                .label("2027")
                .startDate(LocalDate.of(2027, 1, 1))
                .endDate(LocalDate.of(2027, 12, 31))
                .active(true)
                .build());
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), matchSeason.getId()));
        // Never added to any squad at all.
        Person strangerPerson = personRepository.save(Person.builder().firstName("Not").lastName("Squadded").build());
        PlayerProfile stranger = playerProfileRepository.save(
                PlayerProfile.builder().personId(strangerPerson.getId()).clubId(club.getId()).active(true).build());
        // In the team's squad, but only for a DIFFERENT season than the match's own.
        PlayerProfile wrongSeasonPlayer = addSquadMember(club.getId(), team.getId(), otherSeason.getId(), "Wrong");
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        String sideId = createSide(admin, club.getId(), match.getId(), team.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerProfileId\": \"" + stranger.getId() + "\", \"role\": \"BATSMAN\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerProfileId\": \"" + wrongSeasonPlayer.getId()
                                + "\", \"role\": \"BATSMAN\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void addPlayerReturns409WhenAlreadyAddedToThisSide() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        PlayerProfile player = addSquadMember(club.getId(), team.getId(), season.getId(), "Alice");
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        String sideId = createSide(admin, club.getId(), match.getId(), team.getId());
        String addBody = "{\"playerProfileId\": \"" + player.getId() + "\", \"role\": \"BATSMAN\"}";

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(addBody))
                .andExpect(status().isCreated());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(addBody))
                .andExpect(status().isConflict());
    }

    /** {@link com.cricketlegend.exception.PlayingXiCapExceededException}, using a league-configured cap of 1. */
    @Test
    void addPlayerReturns400WhenThePlayingXiCapIsExceeded() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        League league = leagueRepository.save(League.builder()
                .clubId(club.getId())
                .name("One-a-side League")
                .source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(1)
                .allowSubstitutions(false)
                .active(true)
                .build());
        Match match = matchRepository.save(Match.builder()
                .clubId(club.getId())
                .homeTeamId(team.getId())
                .awayTeamName("Occasionals")
                .leagueId(league.getId())
                .seasonId(season.getId())
                .matchDate(Instant.now().plus(7, ChronoUnit.DAYS))
                .active(true)
                .build());
        PlayerProfile playerA = addSquadMember(club.getId(), team.getId(), season.getId(), "Alice");
        PlayerProfile playerB = addSquadMember(club.getId(), team.getId(), season.getId(), "Bob");
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        String sideId = createSide(admin, club.getId(), match.getId(), team.getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerProfileId\": \"" + playerA.getId() + "\", \"role\": \"BATSMAN\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerProfileId\": \"" + playerB.getId() + "\", \"role\": \"BOWLER\"}"))
                .andExpect(status().isBadRequest());
    }

    /**
     * {@link com.cricketlegend.exception.PlayerAgeIneligibleException} — a player with no recorded
     * date of birth is rejected outright when the league has an enforced age range.
     */
    @Test
    void addPlayerReturns400WhenPlayerHasNoRecordedDateOfBirth() throws Exception {
        AgeRestrictedFixture fixture = setUpAgeRestrictedMatch(LocalDate.of(2026, 12, 31));
        PlayerProfile player = addSquadMemberWithDob(
                fixture.club().getId(), fixture.team().getId(), fixture.season().getId(), "NoDob", null);
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", fixture.club().getId());
        String sideId = createSide(admin, fixture.club().getId(), fixture.match().getId(), fixture.team().getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players",
                                fixture.club().getId(),
                                fixture.match().getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerProfileId\": \"" + player.getId() + "\", \"role\": \"BATSMAN\"}"))
                .andExpect(status().isBadRequest());
    }

    /**
     * {@link com.cricketlegend.exception.PlayerAgeIneligibleException} — a player whose age (as of
     * the league's own {@code ageCutoffDate}) falls outside {@code minAge}/{@code maxAge} is
     * rejected.
     */
    @Test
    void addPlayerReturns400WhenPlayersAgeIsOutsideTheLeaguesRange() throws Exception {
        AgeRestrictedFixture fixture = setUpAgeRestrictedMatch(LocalDate.of(2026, 12, 31));
        // 21 years old as of the 2026-12-31 cutoff — above the league's own maxAge of 15.
        PlayerProfile tooOld = addSquadMemberWithDob(
                fixture.club().getId(), fixture.team().getId(), fixture.season().getId(), "TooOld",
                LocalDate.of(2005, 6, 1));
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", fixture.club().getId());
        String sideId = createSide(admin, fixture.club().getId(), fixture.match().getId(), fixture.team().getId());

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players",
                                fixture.club().getId(),
                                fixture.match().getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerProfileId\": \"" + tooOld.getId() + "\", \"role\": \"BATSMAN\"}"))
                .andExpect(status().isBadRequest());
    }

    /** Captain/keeper must already be one of the side's ordered XI. */
    @Test
    void updateSideReturns400WhenCaptainIsNotInTheOrderedXi() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        PlayerProfile notOnSide = addSquadMember(club.getId(), team.getId(), season.getId(), "NotOnSide");
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        String sideId = createSide(admin, club.getId(), match.getId(), team.getId());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"captainPlayerId\": \"" + notOnSide.getId() + "\"}"))
                .andExpect(status().isBadRequest());
    }

    /** The twelfth man must NOT already be one of the side's ordered XI. */
    @Test
    void updateSideReturns400WhenTwelfthManIsAlreadyInTheOrderedXi() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        PlayerProfile player = addSquadMember(club.getId(), team.getId(), season.getId(), "Alice");
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        String sideId = createSide(admin, club.getId(), match.getId(), team.getId());
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerProfileId\": \"" + player.getId() + "\", \"role\": \"BATSMAN\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"twelfthManPlayerId\": \"" + player.getId() + "\"}"))
                .andExpect(status().isBadRequest());
    }

    /** The full new order's player-id set must exactly match the side's current players. */
    @Test
    void reorderPlayersReturns400WhenTheSetDoesNotMatchTheSidesCurrentPlayers() throws Exception {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        Match match = matchRepository.save(newMatchWithoutLeague(club.getId(), team.getId(), season.getId()));
        PlayerProfile player = addSquadMember(club.getId(), team.getId(), season.getId(), "Alice");
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", club.getId());
        String sideId = createSide(admin, club.getId(), match.getId(), team.getId());
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerProfileId\": \"" + player.getId() + "\", \"role\": \"BATSMAN\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(put(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/players/reorder",
                                club.getId(),
                                match.getId(),
                                sideId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playerProfileIds\": [\"" + UUID.randomUUID() + "\"]}"))
                .andExpect(status().isBadRequest());
    }

    private record AgeRestrictedFixture(Club club, Team team, Season season, League league, Match match) {
    }

    private AgeRestrictedFixture setUpAgeRestrictedMatch(LocalDate ageCutoffDate) {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Men"));
        Team team = teamRepository.save(newTeam(club.getId(), section.getId(), "1st XI"));
        Season season = seasonRepository.save(newSeason(club.getId(), "2026"));
        League league = leagueRepository.save(League.builder()
                .clubId(club.getId())
                .name("U15s")
                .source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11)
                .allowSubstitutions(false)
                .minAge(13)
                .maxAge(15)
                .ageCutoffDate(ageCutoffDate)
                .active(true)
                .build());
        Match match = matchRepository.save(Match.builder()
                .clubId(club.getId())
                .homeTeamId(team.getId())
                .awayTeamName("Occasionals")
                .leagueId(league.getId())
                .seasonId(season.getId())
                .matchDate(Instant.now().plus(7, ChronoUnit.DAYS))
                .active(true)
                .build());
        return new AgeRestrictedFixture(club, team, season, league, match);
    }

    private String createSide(JwtRequestPostProcessor admin, UUID clubId, UUID matchId, UUID teamId)
            throws Exception {
        String response = mockMvc.perform(post(
                                "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides", clubId, matchId)
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + teamId + "\"}"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(response, "$.id");
    }

    private PlayerProfile addSquadMember(UUID clubId, UUID teamId, UUID seasonId, String firstName) {
        return addSquadMemberWithDob(clubId, teamId, seasonId, firstName, LocalDate.of(1995, 1, 1));
    }

    private PlayerProfile addSquadMemberWithDob(
            UUID clubId, UUID teamId, UUID seasonId, String firstName, LocalDate dateOfBirth) {
        Person person = personRepository.save(
                Person.builder().firstName(firstName).lastName("Player").dateOfBirth(dateOfBirth).build());
        PlayerProfile profile = playerProfileRepository.save(
                PlayerProfile.builder().personId(person.getId()).clubId(clubId).active(true).build());
        teamSquadMemberRepository.save(TeamSquadMember.builder()
                .teamId(teamId)
                .seasonId(seasonId)
                .playerProfileId(profile.getId())
                .build());
        return profile;
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

    private Match newMatchWithoutLeague(UUID clubId, UUID homeTeamId, UUID seasonId) {
        return Match.builder()
                .clubId(clubId)
                .homeTeamId(homeTeamId)
                .awayTeamName("Occasionals")
                .seasonId(seasonId)
                .matchDate(Instant.now().plus(7, ChronoUnit.DAYS))
                .active(true)
                .build();
    }
}
