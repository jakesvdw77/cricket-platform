package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.withSubject;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.MatchSquadMember;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.RoleAssignment;
import com.cricketlegend.domain.RoleAssignmentRole;
import com.cricketlegend.domain.ScopeType;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSquadMemberRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.RoleAssignmentRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.AvailabilityAutoCloseService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * Integration tests for docs/specs/064-unified-availability-polls.md's Test Plan: the two new
 * {@code DELETE} endpoints (cascade, {@code 409}, isolation, "delete frees the match"), the
 * cross-kind exclusivity, the squad endpoint's coverage-driven {@code windowId}, the generalised
 * fixture-groups {@code alreadyPolled}, {@code AvailabilityAutoCloseService.closeDuePolls}
 * end-to-end against real repositories, and the {@code 035} schema shape.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class UnifiedAvailabilityPollsIntegrationTest {

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

    @Autowired
    private MatchAvailabilityPollRepository pollRepository;

    @Autowired
    private PlayerAvailabilityRepository playerAvailabilityRepository;

    @Autowired
    private SectionAvailabilityRoundRepository roundRepository;

    @Autowired
    private SectionAvailabilityWindowRepository windowRepository;

    @Autowired
    private SectionAvailabilityWindowMatchRepository windowMatchRepository;

    @Autowired
    private SectionAvailabilityResponseRepository responseRepository;

    @Autowired
    private MatchSquadMemberRepository matchSquadMemberRepository;

    @Autowired
    private AvailabilityAutoCloseService autoCloseService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Value("${cricketlegend.autoclose.enabled}")
    private boolean autoCloseEnabled;

    // ---------------------------------------------------------------- DELETE squad poll

    @Test
    void deleteSquadPollReturns204RemovesItAndItsResponsesAndFreesTheMatchForAGroupPoll() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        String pollId = createSquadPoll(admin, f);
        UUID player = addPlayer(f.club.getId(), "Alice");
        playerAvailabilityRepository.save(PlayerAvailability.builder()
                .pollId(UUID.fromString(pollId))
                .playerProfileId(player)
                .status(AvailabilityStatus.AVAILABLE)
                .build());

        // While the squad poll exists, a group poll for the same match is rejected.
        createRoundRequest(admin, f, f.match.getId()).andExpect(status().isConflict());

        mockMvc.perform(delete(
                                "/api/v1/manage/clubs/{c}/matches/{m}/polls/{p}",
                                f.club.getId(), f.match.getId(), pollId)
                        .with(admin))
                .andExpect(status().isNoContent());

        assertThat(pollRepository.findById(UUID.fromString(pollId))).isEmpty();
        assertThat(playerAvailabilityRepository.findByPollId(UUID.fromString(pollId))).isEmpty();

        // The match is free again: a group poll can now cover it.
        createRoundRequest(admin, f, f.match.getId()).andExpect(status().isCreated());
    }

    @Test
    void deleteSquadPollReturns404ForAnUnknownPollAndForAPollOfADifferentMatch() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        Match otherMatch = matchRepository.save(newMatch(f, 11));
        String pollOnOtherMatch = createSquadPoll(admin, f, otherMatch);

        mockMvc.perform(delete(
                                "/api/v1/manage/clubs/{c}/matches/{m}/polls/{p}",
                                f.club.getId(), f.match.getId(), UUID.randomUUID())
                        .with(admin))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete(
                                "/api/v1/manage/clubs/{c}/matches/{m}/polls/{p}",
                                f.club.getId(), f.match.getId(), pollOnOtherMatch)
                        .with(admin))
                .andExpect(status().isNotFound());
        assertThat(pollRepository.findById(UUID.fromString(pollOnOtherMatch))).isPresent();
    }

    @Test
    void deleteSquadPollIsIsolatedAcrossClubsAndSections() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        String pollId = createSquadPoll(admin, f);

        Club otherClub = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        JwtRequestPostProcessor otherClubAdmin = grantClubAdmin("other-admin-sub", otherClub.getId());
        // Other club's admin on this club's path: 403. On their own club's path with this club's ids: 404.
        mockMvc.perform(delete(
                                "/api/v1/manage/clubs/{c}/matches/{m}/polls/{p}",
                                f.club.getId(), f.match.getId(), pollId)
                        .with(otherClubAdmin))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete(
                                "/api/v1/manage/clubs/{c}/matches/{m}/polls/{p}",
                                otherClub.getId(), f.match.getId(), pollId)
                        .with(otherClubAdmin))
                .andExpect(status().isNotFound());

        Section otherSection = sectionRepository.save(newSection(f.club.getId(), "Open"));
        JwtRequestPostProcessor otherSectionAdmin =
                grantSectionAdmin("open-admin-sub", otherSection.getId());
        mockMvc.perform(delete(
                                "/api/v1/manage/clubs/{c}/matches/{m}/polls/{p}",
                                f.club.getId(), f.match.getId(), pollId)
                        .with(otherSectionAdmin))
                .andExpect(status().isForbidden());

        assertThat(pollRepository.findById(UUID.fromString(pollId))).isPresent();
    }

    @Test
    void createSquadPollOnAGroupCoveredMatchReturns409AndDeletingTheRoundFreesTheMatch() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        String roundId = createRoundId(admin, f);

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/matches/{m}/polls", f.club.getId(), f.match.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + f.team.getId() + "\"}"))
                .andExpect(status().isConflict());

        mockMvc.perform(delete("/api/v1/manage/clubs/{c}/section-availability-rounds/{r}", f.club.getId(), roundId)
                        .with(admin))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/matches/{m}/polls", f.club.getId(), f.match.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + f.team.getId() + "\"}"))
                .andExpect(status().isCreated());
    }

    // ---------------------------------------------------------------- DELETE group round

    @Test
    void deleteRoundReturns204AndCascadesResponsesWindowMatchesWindowsAndRound() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        UUID player = addPlayer(f.club.getId(), "Alice");
        String createResponse = createRound(admin, f, f.match.getId());
        UUID roundId = UUID.fromString(com.jayway.jsonpath.JsonPath.read(createResponse, "$.id"));
        UUID windowId = UUID.fromString(com.jayway.jsonpath.JsonPath.read(createResponse, "$.brackets[0].windowId"));
        responseRepository.save(SectionAvailabilityResponse.builder()
                .windowId(windowId)
                .playerProfileId(player)
                .status(AvailabilityStatus.AVAILABLE)
                .build());
        assertThat(windowRepository.findByRoundId(roundId)).hasSize(1);
        assertThat(windowMatchRepository.findByMatchId(f.match.getId())).isPresent();

        mockMvc.perform(delete("/api/v1/manage/clubs/{c}/section-availability-rounds/{r}", f.club.getId(), roundId)
                        .with(admin))
                .andExpect(status().isNoContent());

        assertThat(roundRepository.findById(roundId)).isEmpty();
        assertThat(windowRepository.findByRoundId(roundId)).isEmpty();
        assertThat(windowMatchRepository.findByMatchId(f.match.getId())).isEmpty();
        assertThat(responseRepository.findAll()).noneMatch(r -> r.getWindowId().equals(windowId));

        // Freed: a squad poll can now be created for the match.
        mockMvc.perform(post("/api/v1/manage/clubs/{c}/matches/{m}/polls", f.club.getId(), f.match.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + f.team.getId() + "\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void deleteRoundReturns409WhileAMatchSquadMemberIsPickedFromItsWindows() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        UUID player = addPlayer(f.club.getId(), "Alice");
        String createResponse = createRound(admin, f, f.match.getId());
        UUID roundId = UUID.fromString(com.jayway.jsonpath.JsonPath.read(createResponse, "$.id"));
        UUID windowId = UUID.fromString(com.jayway.jsonpath.JsonPath.read(createResponse, "$.brackets[0].windowId"));
        matchSquadMemberRepository.save(MatchSquadMember.builder()
                .matchId(f.match.getId())
                .teamId(f.team.getId())
                .sectionAvailabilityWindowId(windowId)
                .playerProfileId(player)
                .build());

        mockMvc.perform(delete("/api/v1/manage/clubs/{c}/section-availability-rounds/{r}", f.club.getId(), roundId)
                        .with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(
                        org.hamcrest.Matchers.containsString("Remove the picked squad members")));

        assertThat(roundRepository.findById(roundId)).isPresent();
        assertThat(windowRepository.findByRoundId(roundId)).hasSize(1);
        assertThat(windowMatchRepository.findByMatchId(f.match.getId())).isPresent();

        // Once the pick is removed the delete succeeds.
        matchSquadMemberRepository.deleteAll();
        mockMvc.perform(delete("/api/v1/manage/clubs/{c}/section-availability-rounds/{r}", f.club.getId(), roundId)
                        .with(admin))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteRoundIsIsolatedAcrossClubsAndSectionsAndUnknownIdsReturn404() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        String roundId = createRoundId(admin, f);

        mockMvc.perform(delete(
                                "/api/v1/manage/clubs/{c}/section-availability-rounds/{r}",
                                f.club.getId(), UUID.randomUUID())
                        .with(admin))
                .andExpect(status().isNotFound());

        Club otherClub = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        JwtRequestPostProcessor otherClubAdmin = grantClubAdmin("other-admin-sub", otherClub.getId());
        mockMvc.perform(delete("/api/v1/manage/clubs/{c}/section-availability-rounds/{r}", f.club.getId(), roundId)
                        .with(otherClubAdmin))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/manage/clubs/{c}/section-availability-rounds/{r}", otherClub.getId(), roundId)
                        .with(otherClubAdmin))
                .andExpect(status().isNotFound());

        Section otherSection = sectionRepository.save(newSection(f.club.getId(), "Open"));
        JwtRequestPostProcessor otherSectionAdmin = grantSectionAdmin("open-admin-sub", otherSection.getId());
        mockMvc.perform(delete("/api/v1/manage/clubs/{c}/section-availability-rounds/{r}", f.club.getId(), roundId)
                        .with(otherSectionAdmin))
                .andExpect(status().isForbidden());

        assertThat(roundRepository.findById(UUID.fromString(roundId))).isPresent();
    }

    // ---------------------------------------------------------------- squad endpoint

    @Test
    void squadEndpointReturnsNullWindowIdWhenNotGroupCoveredAndPopulatedWhenCovered() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        String squadUrl = "/api/v1/manage/clubs/{c}/matches/{m}/teams/{t}/squad";

        mockMvc.perform(get(squadUrl, f.club.getId(), f.match.getId(), f.team.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.windowId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.roundId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.selected.length()").value(0));

        // A squad poll (not group coverage) still leaves windowId null.
        createSquadPoll(admin, f);
        mockMvc.perform(get(squadUrl, f.club.getId(), f.match.getId(), f.team.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.windowId").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void squadEndpointExposesWindowAndRoundOnceAGroupPollCoversTheMatch() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        String roundId = createRoundId(admin, f);

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{c}/matches/{m}/teams/{t}/squad",
                                f.club.getId(), f.match.getId(), f.team.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.windowId").isNotEmpty())
                .andExpect(jsonPath("$.roundId").value(roundId));
    }

    @Test
    void addWithoutACoveringWindowReturns400AndRemoveOfANonexistentPickReturns404() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        UUID player = addPlayer(f.club.getId(), "Alice");

        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{c}/matches/{m}/teams/{t}/squad/{p}/add",
                                f.club.getId(), f.match.getId(), f.team.getId(), player)
                        .with(admin))
                .andExpect(status().isBadRequest());
        // remove never needs a window: with no pick there is simply nothing to remove (404, not 400).
        mockMvc.perform(post(
                                "/api/v1/manage/clubs/{c}/matches/{m}/teams/{t}/squad/{p}/remove",
                                f.club.getId(), f.match.getId(), f.team.getId(), player)
                        .with(admin))
                .andExpect(status().isNotFound());
    }

    // ---------------------------------------------------------------- fixture groups

    @Test
    void fixtureGroupsFlagASquadPolledMatchAndProposeATeamWithoutAnySquadConfiguration() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        String url = "/api/v1/manage/clubs/{c}/sections/{s}/section-availability-fixture-groups";

        // No team configuration of any kind exists: the match is still proposed, not yet polled.
        mockMvc.perform(get(url, f.club.getId(), f.section.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].matches[0].matchId").value(f.match.getId().toString()))
                .andExpect(jsonPath("$[0].matches[0].alreadyPolled").value(false));

        String pollId = createSquadPoll(admin, f);
        mockMvc.perform(get(url, f.club.getId(), f.section.getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].matches[0].alreadyPolled").value(true))
                .andExpect(jsonPath("$[0].matches[0].existingPollType").value("SQUAD"))
                .andExpect(jsonPath("$[0].matches[0].existingPollId").value(pollId))
                .andExpect(jsonPath("$[0].matches[0].existingPollLabel").value("U15 Colts v Occasionals"));
    }

    @Test
    void fixtureGroupsFlagAGroupCoveredMatchWithTheRoundIdAndDescription() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        String roundId = createRoundId(admin, f);

        mockMvc.perform(get(
                                "/api/v1/manage/clubs/{c}/sections/{s}/section-availability-fixture-groups",
                                f.club.getId(), f.section.getId())
                        .with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].matches[0].alreadyPolled").value(true))
                .andExpect(jsonPath("$[0].matches[0].existingPollType").value("GROUP"))
                .andExpect(jsonPath("$[0].matches[0].existingPollId").value(roundId))
                .andExpect(jsonPath("$[0].matches[0].existingPollLabel").value("Saturday fixtures"));
    }

    // ---------------------------------------------------------------- auto-close end to end

    @Test
    void closeDuePollsClosesOverdueSquadPollsAndGroupRoundsWithEveryWindowAndLeavesTheRestUntouched() {
        Fixture f = fixture();
        Instant now = Instant.parse("2026-10-09T12:00:00Z");
        Instant overdue = now.minus(1, ChronoUnit.HOURS);
        Instant future = now.plus(1, ChronoUnit.HOURS);

        MatchAvailabilityPoll dueSquad = savePoll(f.match, f.team, true, true, overdue);
        Match m2 = matchRepository.save(newMatch(f, 10));
        MatchAvailabilityPoll notYetDue = savePoll(m2, f.team, true, true, future);
        Match m3 = matchRepository.save(newMatch(f, 11));
        MatchAvailabilityPoll alreadyClosed = savePoll(m3, f.team, false, true, overdue);
        Match m4 = matchRepository.save(newMatch(f, 12));
        MatchAvailabilityPoll manual = savePoll(m4, f.team, true, false, null);
        Match m5 = matchRepository.save(newMatch(f, 13));
        MatchAvailabilityPoll autoNoSchedule = savePoll(m5, f.team, true, true, null);

        SectionAvailabilityRound dueRound = saveRound(f, true, true, overdue, true);
        SectionAvailabilityWindow w1 = saveWindow(f, dueRound, LocalDate.of(2026, 10, 10), DayPart.MORNING, true);
        SectionAvailabilityWindow w2 = saveWindow(f, dueRound, LocalDate.of(2026, 10, 11), DayPart.MORNING, true);
        SectionAvailabilityRound futureRound = saveRound(f, true, true, future, true);
        SectionAvailabilityWindow w3 = saveWindow(f, futureRound, LocalDate.of(2026, 10, 17), DayPart.MORNING, true);
        SectionAvailabilityRound manualRound = saveRound(f, true, false, null, true);
        SectionAvailabilityWindow w4 = saveWindow(f, manualRound, LocalDate.of(2026, 10, 24), DayPart.MORNING, true);
        SectionAvailabilityRound closedRound = saveRound(f, false, true, overdue, true);
        SectionAvailabilityWindow w5 = saveWindow(f, closedRound, LocalDate.of(2026, 10, 31), DayPart.MORNING, false);

        int closed = autoCloseService.closeDuePolls(now);

        assertThat(closed).isEqualTo(2);
        assertThat(pollRepository.findById(dueSquad.getId()).orElseThrow().isOpen()).isFalse();
        assertThat(roundRepository.findById(dueRound.getId()).orElseThrow().isOpen()).isFalse();
        assertThat(windowRepository.findById(w1.getId()).orElseThrow().isOpen()).isFalse();
        assertThat(windowRepository.findById(w2.getId()).orElseThrow().isOpen()).isFalse();

        assertThat(pollRepository.findById(notYetDue.getId()).orElseThrow().isOpen()).isTrue();
        assertThat(pollRepository.findById(alreadyClosed.getId()).orElseThrow().isOpen()).isFalse();
        assertThat(pollRepository.findById(manual.getId()).orElseThrow().isOpen()).isTrue();
        assertThat(pollRepository.findById(autoNoSchedule.getId()).orElseThrow().isOpen()).isTrue();
        assertThat(roundRepository.findById(futureRound.getId()).orElseThrow().isOpen()).isTrue();
        assertThat(windowRepository.findById(w3.getId()).orElseThrow().isOpen()).isTrue();
        assertThat(roundRepository.findById(manualRound.getId()).orElseThrow().isOpen()).isTrue();
        assertThat(windowRepository.findById(w4.getId()).orElseThrow().isOpen()).isTrue();
        assertThat(windowRepository.findById(w5.getId()).orElseThrow().isOpen()).isFalse();

        // Idempotent: a second run finds nothing left to do.
        assertThat(autoCloseService.closeDuePolls(now)).isZero();
        assertThat(pollRepository.findById(notYetDue.getId()).orElseThrow().isOpen()).isTrue();
    }

    @Test
    void closeDuePollsClosesAPollOnceItsScheduledTimeIsReached() {
        Fixture f = fixture();
        Instant now = Instant.parse("2026-10-09T12:00:00Z");
        MatchAvailabilityPoll exactlyDue = savePoll(f.match, f.team, true, true, now);

        assertThat(autoCloseService.closeDuePolls(now)).isEqualTo(1);
        assertThat(pollRepository.findById(exactlyDue.getId()).orElseThrow().isOpen()).isFalse();
    }

    @Test
    void theSchedulerIsDisabledUnderTheTestConfig() {
        assertThat(autoCloseEnabled).isFalse();
    }

    // ---------------------------------------------------------------- migration 035

    @Test
    void migration035DropsTeamSquadModeAndAddsPollAutoCloseColumns() {
        List<String> teamColumns = jdbcTemplate.queryForList(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'team'", String.class);
        assertThat(teamColumns).isNotEmpty().doesNotContain("squad_mode");

        List<String> pollColumns = jdbcTemplate.queryForList(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'match_availability_poll'",
                String.class);
        assertThat(pollColumns).contains("auto_close", "scheduled_close_at");
    }

    // ---------------------------------------------------------------- 066 close time

    private String squadCloseTimeUrl() {
        return "/api/v1/manage/clubs/{c}/matches/{m}/polls/{p}/close-time";
    }

    private org.springframework.test.web.servlet.ResultActions putSquadCloseTime(
            JwtRequestPostProcessor who, UUID clubId, UUID matchId, String pollId, String body) throws Exception {
        return mockMvc.perform(put(squadCloseTimeUrl(), clubId, matchId, pollId)
                .with(who)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private org.springframework.test.web.servlet.ResultActions putRoundCloseTime(
            JwtRequestPostProcessor who, UUID clubId, String roundId, String body) throws Exception {
        return mockMvc.perform(put(
                        "/api/v1/manage/clubs/{c}/section-availability-rounds/{r}/close-time", clubId, roundId)
                .with(who)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private static String closeBody(boolean autoClose, Instant at) {
        return "{\"autoClose\": " + autoClose + ", \"scheduledCloseAt\": " + (at == null ? "null" : "\"" + at + "\"")
                + "}";
    }

    @Test
    void putSquadCloseTimeSavesValidatesAndClearsAndNeverChangesOpen() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        String pollId = createSquadPoll(admin, f);
        UUID id = UUID.fromString(pollId);
        Instant kickoff = f.match.getMatchDate();
        Instant closeAt = Instant.now().plus(1, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS);

        putSquadCloseTime(admin, f.club.getId(), f.match.getId(), pollId, closeBody(true, closeAt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.autoClose").value(true))
                .andExpect(jsonPath("$.open").value(true));
        assertThat(pollRepository.findById(id).orElseThrow().getScheduledCloseAt()).isEqualTo(closeAt);

        // equal to kickoff is allowed
        putSquadCloseTime(admin, f.club.getId(), f.match.getId(), pollId, closeBody(true, kickoff))
                .andExpect(status().isOk());

        putSquadCloseTime(admin, f.club.getId(), f.match.getId(), pollId,
                        closeBody(true, Instant.now().minusSeconds(60)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Choose a closing time in the future."));
        putSquadCloseTime(admin, f.club.getId(), f.match.getId(), pollId, closeBody(true, kickoff.plusSeconds(60)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Choose a closing time before the first match starts."));
        putSquadCloseTime(admin, f.club.getId(), f.match.getId(), pollId, closeBody(true, null))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("A closing time is required when Autoclose is on."));

        putSquadCloseTime(admin, f.club.getId(), f.match.getId(), pollId, closeBody(false, closeAt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.autoClose").value(false))
                .andExpect(jsonPath("$.scheduledCloseAt").doesNotExist());
        assertThat(pollRepository.findById(id).orElseThrow().getScheduledCloseAt()).isNull();
    }

    @Test
    void putSquadCloseTimeOnAClosedPollKeepsItClosedAndAllowsReopenWithAFutureTime() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        MatchAvailabilityPoll poll = savePoll(f.match, f.team, false, true, Instant.now().minusSeconds(3600));
        String pollId = poll.getId().toString();

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/matches/{m}/polls/{p}/open",
                        f.club.getId(), f.match.getId(), pollId).with(admin))
                .andExpect(status().isConflict());

        putSquadCloseTime(admin, f.club.getId(), f.match.getId(), pollId,
                        closeBody(true, Instant.now().plus(2, ChronoUnit.HOURS)))
                .andExpect(status().isOk());
        assertThat(pollRepository.findById(poll.getId()).orElseThrow().isOpen()).isFalse();

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/matches/{m}/polls/{p}/open",
                        f.club.getId(), f.match.getId(), pollId).with(admin))
                .andExpect(status().isOk());
        assertThat(pollRepository.findById(poll.getId()).orElseThrow().isOpen()).isTrue();
    }

    @Test
    void putSquadCloseTimeIsGatedBySectionAndClub() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        String pollId = createSquadPoll(admin, f);
        String body = closeBody(true, Instant.now().plus(1, ChronoUnit.HOURS));

        Section otherSection = sectionRepository.save(newSection(f.club.getId(), "Open"));
        putSquadCloseTime(grantSectionAdmin("open-admin-sub", otherSection.getId()),
                        f.club.getId(), f.match.getId(), pollId, body)
                .andExpect(status().isForbidden());

        Club otherClub = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        JwtRequestPostProcessor otherAdmin = grantClubAdmin("other-admin-sub", otherClub.getId());
        putSquadCloseTime(otherAdmin, f.club.getId(), f.match.getId(), pollId, body)
                .andExpect(status().isForbidden());
        putSquadCloseTime(otherAdmin, otherClub.getId(), f.match.getId(), pollId, body)
                .andExpect(status().isNotFound());
    }

    @Test
    void createSquadPollAcceptsAnExplicitScheduledCloseAtAndRejectsAPastOne() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        Instant closeAt = Instant.now().plus(3, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS);

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/matches/{m}/polls", f.club.getId(), f.match.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + f.team.getId() + "\", \"autoClose\": true, "
                                + "\"scheduledCloseAt\": \"" + Instant.now().minusSeconds(60) + "\"}"))
                .andExpect(status().isBadRequest());

        String body = mockMvc.perform(post("/api/v1/manage/clubs/{c}/matches/{m}/polls", f.club.getId(), f.match.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + f.team.getId() + "\", \"autoClose\": true, "
                                + "\"scheduledCloseAt\": \"" + closeAt + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String id = com.jayway.jsonpath.JsonPath.read(body, "$.id");
        assertThat(pollRepository.findById(UUID.fromString(id)).orElseThrow().getScheduledCloseAt())
                .isEqualTo(closeAt);
    }

    @Test
    void putRoundCloseTimeSavesValidatesAgainstTheEarliestKickoffAndKeepsOpenState() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        String created = createRound(admin, f, f.match.getId());
        String roundId = com.jayway.jsonpath.JsonPath.read(created, "$.id");
        UUID id = UUID.fromString(roundId);
        Instant kickoff = f.match.getMatchDate();
        // firstMatchKickoff is the covered match's exact kickoff.
        Object kick = com.jayway.jsonpath.JsonPath.read(created, "$.firstMatchKickoff");
        assertThat(kick).isNotNull();
        Instant closeAt = Instant.now().plus(1, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS);

        putRoundCloseTime(admin, f.club.getId(), roundId, closeBody(true, closeAt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.open").value(true))
                .andExpect(jsonPath("$.firstMatchKickoff").exists());
        assertThat(roundRepository.findById(id).orElseThrow().getScheduledCloseAt()).isEqualTo(closeAt);

        putRoundCloseTime(admin, f.club.getId(), roundId, closeBody(true, kickoff)).andExpect(status().isOk());
        putRoundCloseTime(admin, f.club.getId(), roundId, closeBody(true, Instant.now().minusSeconds(60)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Choose a closing time in the future."));
        putRoundCloseTime(admin, f.club.getId(), roundId, closeBody(true, kickoff.plusSeconds(60)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Choose a closing time before the first match starts."));
        putRoundCloseTime(admin, f.club.getId(), roundId, closeBody(true, null))
                .andExpect(status().isBadRequest());
        putRoundCloseTime(admin, f.club.getId(), roundId, closeBody(false, closeAt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scheduledCloseAt").doesNotExist());
        assertThat(roundRepository.findById(id).orElseThrow().getScheduledCloseAt()).isNull();
    }

    @Test
    void putRoundCloseTimeOnAClosedRoundKeepsItClosedAndAllowsReopen() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        String roundId = createRoundId(admin, f);
        UUID id = UUID.fromString(roundId);
        mockMvc.perform(post("/api/v1/manage/clubs/{c}/section-availability-rounds/{r}/close",
                        f.club.getId(), roundId).with(admin)).andExpect(status().isOk());
        SectionAvailabilityRound round = roundRepository.findById(id).orElseThrow();
        round.setScheduledCloseAt(Instant.now().minusSeconds(3600));
        roundRepository.save(round);

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/section-availability-rounds/{r}/open",
                        f.club.getId(), roundId).with(admin)).andExpect(status().isConflict());

        putRoundCloseTime(admin, f.club.getId(), roundId, closeBody(true, Instant.now().plus(2, ChronoUnit.HOURS)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.open").value(false));

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/section-availability-rounds/{r}/open",
                        f.club.getId(), roundId).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.open").value(true));
    }

    @Test
    void putRoundCloseTimeIsGatedBySectionAndClub() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        String roundId = createRoundId(admin, f);
        String body = closeBody(true, Instant.now().plus(1, ChronoUnit.HOURS));

        Section otherSection = sectionRepository.save(newSection(f.club.getId(), "Open"));
        putRoundCloseTime(grantSectionAdmin("open-admin-sub", otherSection.getId()), f.club.getId(), roundId, body)
                .andExpect(status().isForbidden());

        Club otherClub = clubRepository.save(newClub("Lakeside CC", "lakeside-cc"));
        JwtRequestPostProcessor otherAdmin = grantClubAdmin("other-admin-sub", otherClub.getId());
        putRoundCloseTime(otherAdmin, f.club.getId(), roundId, body).andExpect(status().isForbidden());
        putRoundCloseTime(otherAdmin, otherClub.getId(), roundId, body).andExpect(status().isNotFound());
    }

    @Test
    void createRoundAcceptsAnExplicitScheduledCloseAtAndRejectsAPastOne() throws Exception {
        Fixture f = fixture();
        JwtRequestPostProcessor admin = grantClubAdmin("club-admin-sub", f.club.getId());
        Instant closeAt = Instant.now().plus(3, ChronoUnit.HOURS).truncatedTo(ChronoUnit.SECONDS);
        String base = "{\"sectionId\": \"" + f.section.getId() + "\", \"description\": \"Fx\", "
                + "\"matchIds\": [\"" + f.match.getId() + "\"], \"autoClose\": true, \"scheduledCloseAt\": \"";

        mockMvc.perform(post("/api/v1/manage/clubs/{c}/section-availability-rounds", f.club.getId())
                        .with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(base + Instant.now().minusSeconds(60) + "\"}"))
                .andExpect(status().isBadRequest());

        String body = mockMvc.perform(post("/api/v1/manage/clubs/{c}/section-availability-rounds", f.club.getId())
                        .with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(base + closeAt + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String id = com.jayway.jsonpath.JsonPath.read(body, "$.id");
        assertThat(roundRepository.findById(UUID.fromString(id)).orElseThrow().getScheduledCloseAt())
                .isEqualTo(closeAt);
    }

    // ---------------------------------------------------------------- helpers

    private record Fixture(Club club, Section section, Season season, Team team, Match match) {}

    private Fixture fixture() {
        Club club = clubRepository.save(newClub("Riverside CC", "riverside-cc"));
        Section section = sectionRepository.save(newSection(club.getId(), "Juniors"));
        Season season = seasonRepository.save(Season.builder()
                .clubId(club.getId())
                .label("2026")
                .startDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 12, 31))
                .active(true)
                .build());
        Team team = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(section.getId()).name("U15 Colts").active(true).build());
        Fixture partial = new Fixture(club, section, season, team, null);
        return new Fixture(club, section, season, team, matchRepository.save(newMatch(partial, 9)));
    }

    private Match newMatch(Fixture f, int hourOfDay) {
        Instant matchDate = LocalDate.now(ZoneId.systemDefault())
                .plus(2, ChronoUnit.DAYS)
                .atTime(hourOfDay, 0)
                .atZone(ZoneId.systemDefault())
                .toInstant();
        return Match.builder()
                .clubId(f.club.getId())
                .homeTeamId(f.team.getId())
                .awayTeamName("Occasionals")
                .seasonId(f.season.getId())
                .matchDate(matchDate)
                .active(true)
                .build();
    }

    private String createSquadPoll(JwtRequestPostProcessor admin, Fixture f) throws Exception {
        return createSquadPoll(admin, f, f.match);
    }

    private String createSquadPoll(JwtRequestPostProcessor admin, Fixture f, Match match) throws Exception {
        String body = mockMvc.perform(post("/api/v1/manage/clubs/{c}/matches/{m}/polls", f.club.getId(), match.getId())
                        .with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\": \"" + f.team.getId() + "\"}"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.id");
    }

    private org.springframework.test.web.servlet.ResultActions createRoundRequest(
            JwtRequestPostProcessor admin, Fixture f, UUID matchId) throws Exception {
        return mockMvc.perform(post("/api/v1/manage/clubs/{c}/section-availability-rounds", f.club.getId())
                .with(admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"sectionId\": \"" + f.section.getId() + "\", \"description\": \"Saturday fixtures\", "
                        + "\"matchIds\": [\"" + matchId + "\"], \"autoClose\": true}"));
    }

    private String createRound(JwtRequestPostProcessor admin, Fixture f, UUID matchId) throws Exception {
        return createRoundRequest(admin, f, matchId)
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    private String createRoundId(JwtRequestPostProcessor admin, Fixture f) throws Exception {
        return com.jayway.jsonpath.JsonPath.read(createRound(admin, f, f.match.getId()), "$.id");
    }

    private MatchAvailabilityPoll savePoll(Match match, Team team, boolean open, boolean autoClose, Instant closeAt) {
        return pollRepository.save(MatchAvailabilityPoll.builder()
                .matchId(match.getId())
                .teamId(team.getId())
                .open(open)
                .autoClose(autoClose)
                .scheduledCloseAt(closeAt)
                .build());
    }

    private SectionAvailabilityRound saveRound(
            Fixture f, boolean open, boolean autoClose, Instant closeAt, boolean unused) {
        return roundRepository.save(SectionAvailabilityRound.builder()
                .clubId(f.club.getId())
                .sectionId(f.section.getId())
                .description("Round")
                .firstMatchDate(LocalDate.of(2026, 10, 10))
                .lastMatchDate(LocalDate.of(2026, 10, 11))
                .autoClose(autoClose)
                .scheduledCloseAt(closeAt)
                .open(open)
                .build());
    }

    private SectionAvailabilityWindow saveWindow(
            Fixture f, SectionAvailabilityRound round, LocalDate date, DayPart dayPart, boolean open) {
        return windowRepository.save(SectionAvailabilityWindow.builder()
                .clubId(f.club.getId())
                .sectionId(f.section.getId())
                .roundId(round.getId())
                .windowDate(date)
                .dayPart(dayPart)
                .open(open)
                .build());
    }

    private UUID addPlayer(UUID clubId, String firstName) {
        Person person = personRepository.save(
                Person.builder().firstName(firstName).lastName("Player").dateOfBirth(LocalDate.of(2010, 1, 1)).build());
        return playerProfileRepository
                .save(PlayerProfile.builder().personId(person.getId()).clubId(clubId).active(true).build())
                .getId();
    }

    private JwtRequestPostProcessor grantClubAdmin(String keycloakUserId, UUID clubId) {
        return grant(keycloakUserId, "Casey", ScopeType.CLUB, clubId);
    }

    private JwtRequestPostProcessor grantSectionAdmin(String keycloakUserId, UUID sectionId) {
        return grant(keycloakUserId, "Jamie", ScopeType.SECTION, sectionId);
    }

    private JwtRequestPostProcessor grant(String keycloakUserId, String firstName, ScopeType scopeType, UUID scopeId) {
        Person person = personRepository.save(Person.builder()
                .firstName(firstName)
                .lastName("Manager")
                .email(keycloakUserId + "@example.com")
                .keycloakUserId(keycloakUserId)
                .build());
        roleAssignmentRepository.save(RoleAssignment.builder()
                .personId(person.getId())
                .role(RoleAssignmentRole.CLUB_ADMIN)
                .scopeType(scopeType)
                .scopeId(scopeId)
                .build());
        return withSubject(keycloakUserId);
    }

    private Club newClub(String name, String slug) {
        return Club.builder().name(name).slug(slug).status(ClubStatus.ACTIVE).build();
    }

    private Section newSection(UUID clubId, String name) {
        return Section.builder().clubId(clubId).name(name).active(true).build();
    }
}
