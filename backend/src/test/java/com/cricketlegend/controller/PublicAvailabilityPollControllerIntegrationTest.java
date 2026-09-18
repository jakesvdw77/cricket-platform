package com.cricketlegend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * HTTP-layer integration test for PublicAvailabilityPollController — per
 * docs/specs/032-match-availability-polls.md's Test Plan: every request here is made with
 * NO {@code Authorization} header at all, proving the real {@code permitAll} round-trip — a real
 * {@code 200} for {@code GET}/{@code PUT}, a closed poll's {@code PUT} rejected with {@code 409},
 * an unknown {@code pollId} cleanly {@code 404}s on both {@code GET} and {@code PUT}, and the
 * public {@code GET} response shape carries only that one poll's own match/team/squad data (no
 * {@code clubId} anywhere in the shape).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
@Transactional
class PublicAvailabilityPollControllerIntegrationTest {

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
    private MatchRepository matchRepository;

    @Autowired
    private MatchAvailabilityPollRepository matchAvailabilityPollRepository;

    @Autowired
    private TeamSquadMemberRepository teamSquadMemberRepository;

    @Autowired
    private PersonRepository personRepository;

    @Autowired
    private PlayerProfileRepository playerProfileRepository;

    private record Fixture(Club club, Team team, Season season, Match match, MatchAvailabilityPoll poll) {
    }

    private Fixture setUpOpenPoll() {
        Club club = clubRepository.save(
                Club.builder().name("Riverside CC").slug("riverside-cc").status(ClubStatus.ACTIVE).build());
        Section section = sectionRepository.save(Section.builder().clubId(club.getId()).name("Men").active(true).build());
        Team team = teamRepository.save(
                Team.builder().clubId(club.getId()).sectionId(section.getId()).name("1st XI").active(true).build());
        Season season = seasonRepository.save(Season.builder().clubId(club.getId()).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
        Match match = matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(team.getId())
                .awayTeamName("Occasionals").seasonId(season.getId())
                .matchDate(Instant.now().plus(7, ChronoUnit.DAYS)).venue("The Oval").active(true).build());
        MatchAvailabilityPoll poll = matchAvailabilityPollRepository.save(
                MatchAvailabilityPoll.builder().matchId(match.getId()).teamId(team.getId()).open(true).build());
        return new Fixture(club, team, season, match, poll);
    }

    private PlayerProfile addSquadMember(UUID clubId, UUID teamId, UUID seasonId, String firstName) {
        Person person = personRepository.save(
                Person.builder().firstName(firstName).lastName("Player").dateOfBirth(LocalDate.of(1995, 1, 1))
                        .build());
        PlayerProfile profile = playerProfileRepository.save(
                PlayerProfile.builder().personId(person.getId()).clubId(clubId).active(true).build());
        teamSquadMemberRepository.save(TeamSquadMember.builder()
                .teamId(teamId).seasonId(seasonId).playerProfileId(profile.getId()).build());
        return profile;
    }

    @Test
    void getPollReturns200WithNoAuthorizationHeader() throws Exception {
        Fixture fixture = setUpOpenPoll();
        addSquadMember(fixture.club().getId(), fixture.team().getId(), fixture.season().getId(), "Alice");

        mockMvc.perform(get("/api/v1/public/polls/{pollId}", fixture.poll().getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pollId").value(fixture.poll().getId().toString()))
                .andExpect(jsonPath("$.open").value(true))
                .andExpect(jsonPath("$.teamName").value("1st XI"))
                .andExpect(jsonPath("$.awayTeamName").value("Occasionals"))
                .andExpect(jsonPath("$.venue").value("The Oval"))
                .andExpect(jsonPath("$.responses.length()").value(1))
                .andExpect(jsonPath("$.responses[0].firstName").value("Alice"))
                .andExpect(jsonPath("$.responses[0].status").doesNotExist())
                // The public shape never carries clubId anywhere.
                .andExpect(jsonPath("$.clubId").doesNotExist());
    }

    @Test
    void setAvailabilityReturns200AndUpsertsWithNoAuthorizationHeader() throws Exception {
        Fixture fixture = setUpOpenPoll();
        PlayerProfile player =
                addSquadMember(fixture.club().getId(), fixture.team().getId(), fixture.season().getId(), "Alice");

        mockMvc.perform(put(
                                "/api/v1/public/polls/{pollId}/players/{playerProfileId}",
                                fixture.poll().getId(),
                                player.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"AVAILABLE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.responses[0].status").value("AVAILABLE"));

        // A repeat call from the same player updates the row in place, not a second one.
        mockMvc.perform(put(
                                "/api/v1/public/polls/{pollId}/players/{playerProfileId}",
                                fixture.poll().getId(),
                                player.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"UNSURE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.responses.length()").value(1))
                .andExpect(jsonPath("$.responses[0].status").value("UNSURE"));
    }

    @Test
    void setAvailabilityReturns404WhenPlayerIsNotPartOfThisPollsOwnSquad() throws Exception {
        Fixture fixture = setUpOpenPoll();

        mockMvc.perform(put(
                                "/api/v1/public/polls/{pollId}/players/{playerProfileId}",
                                fixture.poll().getId(),
                                UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"AVAILABLE\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void setAvailabilityReturns409WhenPollIsClosed() throws Exception {
        Fixture fixture = setUpOpenPoll();
        PlayerProfile player =
                addSquadMember(fixture.club().getId(), fixture.team().getId(), fixture.season().getId(), "Alice");
        MatchAvailabilityPoll poll = fixture.poll();
        poll.setOpen(false);
        matchAvailabilityPollRepository.save(poll);

        mockMvc.perform(put(
                                "/api/v1/public/polls/{pollId}/players/{playerProfileId}",
                                poll.getId(),
                                player.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"AVAILABLE\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void getPollReturns404ForAnUnknownPollId() throws Exception {
        mockMvc.perform(get("/api/v1/public/polls/{pollId}", UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    void setAvailabilityReturns404ForAnUnknownPollId() throws Exception {
        mockMvc.perform(put(
                                "/api/v1/public/polls/{pollId}/players/{playerProfileId}",
                                UUID.randomUUID(),
                                UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\": \"AVAILABLE\"}"))
                .andExpect(status().isNotFound());
    }
}
