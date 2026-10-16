package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.withSubject;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.MatchResult;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSquadMember;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.ResultDecidedBy;
import com.cricketlegend.domain.ResultDetailLevel;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchResultRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.MatchSquadMemberRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
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
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * docs/specs/109-delete-empty-match.md, Test Plan: {@code DELETE /matches/{matchId}} through real HTTP against real
 * Postgres (modelled on {@code MatchControllerIntegrationTest}). An empty match is deleted; each kind of attachment
 * refuses with a 409 naming it and leaves both the match and the attachment; another club's match is 404; a caller
 * who cannot administer the match is 403; {@code deletable} is true only for an empty match in get and list. The
 * import candidates' flag is covered in {@code ResultImportRoutesIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class MatchDeleteIntegrationTest {

    private static final String ONE = "/api/v1/manage/clubs/{clubId}/matches/{matchId}";

    @Autowired private MockMvc mockMvc;
    @Autowired private ClubRepository clubRepository;
    @Autowired private SectionRepository sectionRepository;
    @Autowired private TeamRepository teamRepository;
    @Autowired private SeasonRepository seasonRepository;
    @Autowired private MatchRepository matchRepository;
    @Autowired private MatchSideRepository matchSideRepository;
    @Autowired private MatchResultRepository matchResultRepository;
    @Autowired private MatchAvailabilityPollRepository pollRepository;
    @Autowired private MatchSquadMemberRepository squadMemberRepository;
    @Autowired private SectionAvailabilityRoundRepository roundRepository;
    @Autowired private SectionAvailabilityWindowRepository windowRepository;
    @Autowired private SectionAvailabilityWindowMatchRepository windowMatchRepository;
    @Autowired private PersonRepository personRepository;
    @Autowired private PlayerProfileRepository playerProfileRepository;
    @Autowired private RoleAssignmentRepository roleAssignmentRepository;

    /** A club with a section, a team and a season, and a manager of the whole club. */
    private record World(Club club, Section section, Team team, Season season, JwtRequestPostProcessor admin) {}

    private World world() {
        Club club = clubRepository.save(
                Club.builder().name("Riverside CC").slug("riverside-" + UUID.randomUUID()).status(ClubStatus.ACTIVE).build());
        Section section = sectionRepository.save(
                Section.builder().clubId(club.getId()).name("Seniors").active(true).build());
        Team team = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(section.getId()).name("First XI").active(true).build());
        Season season = seasonRepository.save(Season.builder().clubId(club.getId()).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
        return new World(club, section, team, season, grant("admin-" + UUID.randomUUID(), ScopeType.CLUB, club.getId()));
    }

    private JwtRequestPostProcessor grant(String subject, ScopeType scope, UUID scopeId) {
        Person person = personRepository.save(Person.builder().firstName("Casey").lastName("Manager")
                .email(subject + "@example.com").keycloakUserId(subject).build());
        roleAssignmentRepository.save(RoleAssignment.builder().personId(person.getId())
                .role(RoleAssignmentRole.CLUB_ADMIN).scopeType(scope).scopeId(scopeId).build());
        return withSubject(subject);
    }

    private Match match(World w) {
        return matchRepository.save(Match.builder().clubId(w.club().getId()).homeTeamId(w.team().getId())
                .awayTeamName("Occasionals").seasonId(w.season().getId())
                .matchDate(Instant.now().plus(2, ChronoUnit.DAYS)).active(true).build());
    }

    private void result(World w, Match m, ResultStatus status) {
        matchResultRepository.save(MatchResult.builder().clubId(w.club().getId()).matchId(m.getId()).status(status)
                .detailLevel(ResultDetailLevel.SUMMARY).decidedBy(ResultDecidedBy.REGULAR).source("MANUAL")
                .ballsPerOver(6)
                .outcomeType(com.cricketlegend.domain.ResultOutcomeType.WON).build());
    }

    private SectionAvailabilityWindow window(World w) {
        SectionAvailabilityRound round = roundRepository.save(SectionAvailabilityRound.builder()
                .clubId(w.club().getId()).sectionId(w.section().getId()).description("Round")
                .firstMatchDate(LocalDate.of(2026, 10, 10)).lastMatchDate(LocalDate.of(2026, 10, 11))
                .autoClose(true).open(true).build());
        return windowRepository.save(SectionAvailabilityWindow.builder().clubId(w.club().getId())
                .sectionId(w.section().getId()).roundId(round.getId()).windowDate(LocalDate.of(2026, 10, 10))
                .dayPart(DayPart.MORNING).open(false).build());
    }

    private void attachSquadMember(World w, Match m) {
        SectionAvailabilityWindow window = window(w);
        Person person = personRepository.save(Person.builder().firstName("Alex").lastName("Player").build());
        PlayerProfile profile = playerProfileRepository.save(PlayerProfile.builder().personId(person.getId())
                .clubId(w.club().getId()).active(true).build());
        squadMemberRepository.save(MatchSquadMember.builder().matchId(m.getId()).teamId(w.team().getId())
                .sectionAvailabilityWindowId(window.getId()).playerProfileId(profile.getId()).build());
    }

    private void assertRefused(World w, Match m, String message) throws Exception {
        mockMvc.perform(delete(ONE, w.club().getId(), m.getId()).with(w.admin()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(message));
        assertThat(matchRepository.existsById(m.getId())).isTrue();
        mockMvc.perform(get(ONE, w.club().getId(), m.getId()).with(w.admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deletable").value(false));
    }

    @Test
    void anEmptyMatchIsDeletedWith204AndTheRowIsGone() throws Exception {
        World w = world();
        Match m = match(w);

        mockMvc.perform(get(ONE, w.club().getId(), m.getId()).with(w.admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deletable").value(true));
        mockMvc.perform(delete(ONE, w.club().getId(), m.getId()).with(w.admin()))
                .andExpect(status().isNoContent());

        assertThat(matchRepository.existsById(m.getId())).isFalse();
        mockMvc.perform(get(ONE, w.club().getId(), m.getId()).with(w.admin())).andExpect(status().isNotFound());
    }

    @Test
    void aDraftResultRefusesAndKeepsBoth() throws Exception {
        World w = world();
        Match m = match(w);
        result(w, m, ResultStatus.DRAFT);

        assertRefused(w, m, "This match has a draft result. Deactivate it instead.");
        assertThat(matchResultRepository.findByMatchId(m.getId())).isPresent();
    }

    @Test
    void aPublishedResultRefusesAndKeepsBoth() throws Exception {
        World w = world();
        Match m = match(w);
        result(w, m, ResultStatus.PUBLISHED);

        assertRefused(w, m, "This match has a published result. Deactivate it instead.");
        assertThat(matchResultRepository.findByMatchId(m.getId())).isPresent();
    }

    @Test
    void anAvailabilityPollRefusesAndKeepsBoth() throws Exception {
        World w = world();
        Match m = match(w);
        pollRepository.save(MatchAvailabilityPoll.builder().matchId(m.getId()).teamId(w.team().getId()).open(true).build());

        assertRefused(w, m, "This match has an availability poll. Deactivate it instead.");
        assertThat(pollRepository.findByMatchId(m.getId())).hasSize(1);
    }

    @Test
    void aSquadMemberRefusesAndKeepsBoth() throws Exception {
        World w = world();
        Match m = match(w);
        attachSquadMember(w, m);

        assertRefused(w, m, "This match has a squad. Deactivate it instead.");
        assertThat(squadMemberRepository.findByMatchIdIn(java.util.List.of(m.getId()))).hasSize(1);
    }

    @Test
    void aMatchSideRefusesAndKeepsBoth() throws Exception {
        World w = world();
        Match m = match(w);
        matchSideRepository.save(MatchSide.builder().matchId(m.getId()).teamId(w.team().getId()).build());

        assertRefused(w, m, "This match has a team selection. Deactivate it instead.");
        assertThat(matchSideRepository.findByMatchId(m.getId())).hasSize(1);
    }

    @Test
    void anAvailabilityWindowLinkRefusesAndKeepsBoth() throws Exception {
        World w = world();
        Match m = match(w);
        windowMatchRepository.save(SectionAvailabilityWindowMatch.builder()
                .windowId(window(w).getId()).matchId(m.getId()).build());

        assertRefused(w, m, "This match has an availability window. Deactivate it instead.");
        assertThat(windowMatchRepository.existsByMatchId(m.getId())).isTrue();
    }

    @Test
    void severalAttachmentsNameTheFirstAndMentionTheOthers() throws Exception {
        World w = world();
        Match m = match(w);
        result(w, m, ResultStatus.DRAFT);
        matchSideRepository.save(MatchSide.builder().matchId(m.getId()).teamId(w.team().getId()).build());

        assertRefused(w, m, "This match has a draft result and other records. Deactivate it instead.");
    }

    @Test
    void anotherClubsMatchIsNotFoundAndKept() throws Exception {
        World mine = world();
        World theirs = world();
        Match theirMatch = match(theirs);

        mockMvc.perform(delete(ONE, mine.club().getId(), theirMatch.getId()).with(mine.admin()))
                .andExpect(status().isNotFound());
        assertThat(matchRepository.existsById(theirMatch.getId())).isTrue();
    }

    @Test
    void aCallerWhoCannotAdministerTheMatchGets403AndNothingIsDeleted() throws Exception {
        World w = world();
        Match m = match(w);
        Section other = sectionRepository.save(
                Section.builder().clubId(w.club().getId()).name("Juniors").active(true).build());
        JwtRequestPostProcessor juniorsAdmin = grant("juniors-" + UUID.randomUUID(), ScopeType.SECTION, other.getId());
        JwtRequestPostProcessor stranger = withSubject("stranger-" + UUID.randomUUID());

        mockMvc.perform(delete(ONE, w.club().getId(), m.getId()).with(juniorsAdmin)).andExpect(status().isForbidden());
        mockMvc.perform(delete(ONE, w.club().getId(), m.getId()).with(stranger)).andExpect(status().isForbidden());
        assertThat(matchRepository.existsById(m.getId())).isTrue();
    }

    @Test
    void deletableIsTrueInTheListOnlyForTheEmptyMatch() throws Exception {
        World w = world();
        Match empty = match(w);
        Match withResult = match(w);
        result(w, withResult, ResultStatus.DRAFT);
        Match withSquad = match(w);
        attachSquadMember(w, withSquad);

        String json = mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/matches", w.club().getId()).with(w.admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(3))
                .andReturn().getResponse().getContentAsString();

        for (Match m : java.util.List.of(empty, withResult, withSquad)) {
            java.util.List<Boolean> deletable = com.jayway.jsonpath.JsonPath.read(
                    json, "$.content[?(@.id=='" + m.getId() + "')].deletable");
            assertThat(deletable).hasSize(1);
            assertThat(deletable.get(0)).as("deletable for %s", m.getId()).isEqualTo(m.equals(empty));
        }
    }
}
