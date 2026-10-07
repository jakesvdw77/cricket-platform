package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.support.PublicPollKind;
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

/** docs/specs/077 public form, squad poll kind: the shared scenarios plus the squad-only rules. */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class PublicAvailabilityPollIntegrationTest extends AbstractPublicAvailabilityIntegrationTest {

    @Autowired private ClubRepository clubRepository;
    @Autowired private SectionRepository sectionRepository;
    @Autowired private TeamRepository teamRepository;
    @Autowired private SeasonRepository seasonRepository;
    @Autowired private MatchRepository matchRepository;
    @Autowired private MatchAvailabilityPollRepository pollRepository;
    @Autowired private TeamSquadMemberRepository squadMemberRepository;
    @Autowired private PlayerAvailabilityRepository availabilityRepository;

    private Club club;
    private Team team;
    private Season season;
    private Match match;
    private MatchAvailabilityPoll poll;
    private int jersey;

    @Override
    protected PublicPollKind kind() {
        return PublicPollKind.POLL;
    }

    @Override
    protected void createPoll() {
        club = newClub();
        Section section = sectionRepository.save(Section.builder().clubId(club.getId()).name("Men").active(true).build());
        team = teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section.getId())
                .name("1st XI").active(true).build());
        season = seasonRepository.save(Season.builder().clubId(club.getId()).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
        match = matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(team.getId())
                .awayTeamName("Occasionals").seasonId(season.getId())
                .matchDate(Instant.now().plus(7, ChronoUnit.DAYS)).venue("The Oval").active(true).build());
        poll = pollRepository.save(MatchAvailabilityPoll.builder().matchId(match.getId()).teamId(team.getId())
                .open(true).scheduledCloseAt(Instant.now().plus(3, ChronoUnit.DAYS)).build());
        jersey = 0;
    }

    private Club newClub() {
        String slug = "club-" + UUID.randomUUID();
        return clubRepository.save(Club.builder().name(slug).slug(slug).status(ClubStatus.ACTIVE).build());
    }

    @Override
    protected UUID currentPollId() {
        return poll.getId();
    }

    @Override
    protected String baseUrl(UUID pollId) {
        return "/api/v1/public/polls/" + pollId;
    }

    private UUID squadMember(Club ofClub, Team ofTeam, Season ofSeason, String first, String last, LocalDate dob,
            boolean active) {
        UUID profile = newProfile(ofClub.getId(), first, last, dob, active);
        squadMemberRepository.save(TeamSquadMember.builder().teamId(ofTeam.getId()).seasonId(ofSeason.getId())
                .playerProfileId(profile).jerseyNumber(++jersey).build());
        return profile;
    }

    @Override
    protected UUID addPlayer(String first, String last, LocalDate dob, boolean active) {
        return squadMember(club, team, season, first, last, dob, active);
    }

    @Override
    protected UUID addOutsider(String first, String last, LocalDate dob) {
        return newProfile(club.getId(), first, last, dob, true);
    }

    @Override
    protected UUID addPlayerOfAnotherClub(String first, String last, LocalDate dob) {
        Club other = newClub();
        Section section = sectionRepository.save(Section.builder().clubId(other.getId()).name("Men").active(true).build());
        Team otherTeam = teamRepository.save(Team.builder().clubId(other.getId()).sectionId(section.getId())
                .name("Other XI").active(true).build());
        Season otherSeason = seasonRepository.save(Season.builder().clubId(other.getId()).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
        return squadMember(other, otherTeam, otherSeason, first, last, dob, true);
    }

    @Override
    protected void closeCurrentPoll() {
        poll.setOpen(false);
        poll = pollRepository.save(poll);
    }

    @Override
    protected String answersBody(String status) {
        return "{\"answers\":[{\"windowId\":null,\"status\":\"" + status + "\"}]}";
    }

    @Override
    protected String storedSource(UUID playerId) {
        return availabilityRepository.findByPollIdAndPlayerProfileId(poll.getId(), playerId)
                .orElseThrow().getSource().name();
    }

    private String managerBase() {
        return "/api/v1/manage/clubs/" + club.getId() + "/matches/" + match.getId() + "/polls/" + poll.getId();
    }

    @Override
    protected void managerSets(UUID playerId, String status) throws Exception {
        mockMvc.perform(put(managerBase() + "/players/" + playerId).with(com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + status + "\"}"))
                .andExpect(status().isOk());
    }

    @Override
    protected Boolean managerViaLink(UUID playerId) throws Exception {
        String raw = mockMvc.perform(managerGet(managerBase() + "/responses")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        java.util.List<Boolean> values = com.jayway.jsonpath.JsonPath.read(
                raw, "$.responses[?(@.playerProfileId=='" + playerId + "')].viaLink");
        return values.get(0);
    }

    @Override
    protected String firstAnswerStatusPath() {
        return "$.answers[0].status";
    }

    // ---- squad-only rules ----

    @Test
    void headerCarriesTheMatchContextAndCloseTime() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(baseUrl(poll.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pollId").value(poll.getId().toString()))
                .andExpect(jsonPath("$.clubId").value(club.getId().toString()))
                .andExpect(jsonPath("$.homeTeamName").value("1st XI"))
                .andExpect(jsonPath("$.awayTeamName").value("Occasionals"))
                .andExpect(jsonPath("$.venue").value("The Oval"))
                .andExpect(jsonPath("$.teamName").value("1st XI"))
                .andExpect(jsonPath("$.seasonLabel").value("2026"))
                .andExpect(jsonPath("$.scheduledCloseAt").isNotEmpty())
                .andExpect(jsonPath("$.matchDate").isNotEmpty());
    }

    @Test
    void aSquadPollTakesExactlyOneAnswer() throws Exception {
        UUID alice = addPlayer("Alice", "Anderson", DOB, true);
        String token = verifiedToken("Alice", "Anderson", DOB, null);

        mockMvc.perform(putAnswers(alice, token, "{\"answers\":[]}")).andExpect(status().isBadRequest());
        mockMvc.perform(putAnswers(alice, token,
                        "{\"answers\":[{\"status\":\"AVAILABLE\"},{\"status\":\"UNSURE\"}]}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(putAnswers(alice, token, "{\"answers\":[{\"status\":\"MAYBE\"}]}"))
                .andExpect(status().isBadRequest());
        assertThat(availabilityRepository.findByPollId(poll.getId())).isEmpty();
    }

    @Test
    void sameNameSameDateInTheSquadOffersShirtNumbersAndTheTeamLabel() throws Exception {
        addPlayer("Sam", "Smit", DOB, true);
        addPlayer("Sam", "Smit", DOB, true);

        mockMvc.perform(verifyRequest(verifyBody("Sam", "Smit", "1990-05-17", null)))
                .andExpect(jsonPath("$.status").value("PICK"))
                .andExpect(jsonPath("$.candidates[?(@.shirtNumber==1)].teamLabel").value("1st XI"))
                .andExpect(jsonPath("$.candidates[?(@.shirtNumber==2)].teamLabel").value("1st XI"));
    }
}
