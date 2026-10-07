package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.PlatformRoleJwtPostProcessors;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.ClubStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.support.PublicPollKind;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;

/** docs/specs/077 public form, group poll kind: the shared scenarios plus the multi-window rules. */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class PublicSectionAvailabilityRoundIntegrationTest extends AbstractPublicAvailabilityIntegrationTest {

    @Autowired private ClubRepository clubRepository;
    @Autowired private SectionRepository sectionRepository;
    @Autowired private TeamRepository teamRepository;
    @Autowired private SeasonRepository seasonRepository;
    @Autowired private MatchRepository matchRepository;
    @Autowired private PlayerSectionRepository playerSectionRepository;
    @Autowired private SectionAvailabilityRoundRepository roundRepository;
    @Autowired private SectionAvailabilityWindowRepository windowRepository;
    @Autowired private SectionAvailabilityWindowMatchRepository windowMatchRepository;
    @Autowired private SectionAvailabilityResponseRepository responseRepository;

    private Club club;
    private Section section;
    private SectionAvailabilityRound round;
    private SectionAvailabilityWindow morning;
    private SectionAvailabilityWindow afternoon;
    private int jersey;

    @Override
    protected PublicPollKind kind() {
        return PublicPollKind.ROUND;
    }

    private Club newClub() {
        String slug = "club-" + UUID.randomUUID();
        return clubRepository.save(Club.builder().name(slug).slug(slug).status(ClubStatus.ACTIVE).build());
    }

    @Override
    protected void createPoll() {
        club = newClub();
        section = sectionRepository.save(Section.builder().clubId(club.getId()).name("Juniors").active(true).build());
        Team team = teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section.getId())
                .name("U15 Colts").active(true).build());
        Season season = seasonRepository.save(Season.builder().clubId(club.getId()).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true).build());
        Match match = matchRepository.save(Match.builder().clubId(club.getId()).homeTeamId(team.getId())
                .awayTeamName("Occasionals").seasonId(season.getId())
                .matchDate(Instant.now().plus(7, ChronoUnit.DAYS)).active(true).build());
        LocalDate day = LocalDate.now().plusDays(7);
        round = roundRepository.save(SectionAvailabilityRound.builder().clubId(club.getId())
                .sectionId(section.getId()).description("Saturday fixtures").firstMatchDate(day).lastMatchDate(day)
                .autoClose(true).scheduledCloseAt(Instant.now().plus(3, ChronoUnit.DAYS)).open(true).build());
        morning = windowRepository.save(window(day, DayPart.MORNING, true));
        afternoon = windowRepository.save(window(day, DayPart.AFTERNOON, true));
        windowMatchRepository.save(SectionAvailabilityWindowMatch.builder()
                .windowId(morning.getId()).matchId(match.getId()).build());
        jersey = 0;
    }

    private SectionAvailabilityWindow window(LocalDate day, DayPart part, boolean open) {
        return SectionAvailabilityWindow.builder().clubId(club.getId()).sectionId(section.getId())
                .roundId(round.getId()).windowDate(day).dayPart(part).open(open).build();
    }

    @Override
    protected UUID currentPollId() {
        return round.getId();
    }

    @Override
    protected String baseUrl(UUID pollId) {
        return "/api/v1/public/section-availability-rounds/" + pollId;
    }

    private UUID tagged(Club ofClub, Section ofSection, String first, String last, LocalDate dob, boolean active) {
        UUID profile = newProfile(ofClub.getId(), first, last, dob, active);
        playerSectionRepository.save(PlayerSection.builder().playerProfileId(profile)
                .sectionId(ofSection.getId()).build());
        return profile;
    }

    @Override
    protected UUID addPlayer(String first, String last, LocalDate dob, boolean active) {
        jersey++;
        return tagged(club, section, first, last, dob, active);
    }

    @Override
    protected UUID addOutsider(String first, String last, LocalDate dob) {
        return newProfile(club.getId(), first, last, dob, true);
    }

    @Override
    protected UUID addPlayerOfAnotherClub(String first, String last, LocalDate dob) {
        Club other = newClub();
        Section otherSection = sectionRepository.save(
                Section.builder().clubId(other.getId()).name("Juniors").active(true).build());
        return tagged(other, otherSection, first, last, dob, true);
    }

    @Override
    protected void closeCurrentPoll() {
        round.setOpen(false);
        roundRepository.save(round);
        for (SectionAvailabilityWindow w : windowRepository.findByRoundId(round.getId())) {
            w.setOpen(false);
            windowRepository.save(w);
        }
    }

    @Override
    protected String answersBody(String status) {
        return "{\"answers\":[{\"windowId\":\"" + morning.getId() + "\",\"status\":\"" + status + "\"},"
                + "{\"windowId\":\"" + afternoon.getId() + "\",\"status\":\"" + status + "\"}]}";
    }

    @Override
    protected String storedSource(UUID playerId) {
        return responseRepository.findByWindowIdAndPlayerProfileId(morning.getId(), playerId)
                .orElseThrow().getSource().name();
    }

    private String managerBase() {
        return "/api/v1/manage/clubs/" + club.getId() + "/section-availability-rounds/" + round.getId();
    }

    @Override
    protected void managerSets(UUID playerId, String status) throws Exception {
        mockMvc.perform(put(managerBase() + "/players/" + playerId).with(PlatformRoleJwtPostProcessors.platformAdmin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"windowId\":\"" + morning.getId() + "\",\"status\":\"" + status + "\"}"))
                .andExpect(status().isOk());
    }

    @Override
    protected Boolean managerViaLink(UUID playerId) throws Exception {
        String raw = mockMvc.perform(managerGet(managerBase() + "/responses")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<Boolean> values = JsonPath.read(raw,
                "$.responses[?(@.playerProfileId=='" + playerId + "')].statuses[?(@.windowId=='" + morning.getId()
                        + "')].viaLink");
        return values.get(0);
    }

    /** Answers are ordered by window id, so the first path is not stable: look the window up by id instead. */
    @Override
    protected String firstAnswerStatusPath() {
        return "$.answers[?(@.windowId=='" + morning.getId() + "')].status";
    }

    // ---- group-only rules ----

    @Test
    void headerListsTheWindowsWithTheirMatchesAndNoPlayers() throws Exception {
        addPlayer("Alice", "Anderson", DOB, true);

        mockMvc.perform(get(baseUrl(round.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roundId").value(round.getId().toString()))
                .andExpect(jsonPath("$.description").value("Saturday fixtures"))
                .andExpect(jsonPath("$.sectionName").value("Juniors"))
                .andExpect(jsonPath("$.clubId").value(club.getId().toString()))
                .andExpect(jsonPath("$.scheduledCloseAt").isNotEmpty())
                .andExpect(jsonPath("$.windows.length()").value(2))
                .andExpect(jsonPath("$.windows[0].windowId").value(morning.getId().toString()))
                .andExpect(jsonPath("$.windows[0].dayPart").value("MORNING"))
                .andExpect(jsonPath("$.windows[0].open").value(true))
                .andExpect(jsonPath("$.windows[0].matches[0].homeTeamName").value("U15 Colts"))
                .andExpect(jsonPath("$.windows[0].matches[0].awayTeamName").value("Occasionals"))
                .andExpect(jsonPath("$.windows[1].matches.length()").value(0));
    }

    @Test
    void severalWindowsAreSavedInOneCallAndPartialAnswersAreAllowed() throws Exception {
        UUID alice = addPlayer("Alice", "Anderson", DOB, true);
        String token = verifiedToken("Alice", "Anderson", DOB, null);

        mockMvc.perform(putAnswers(alice, token, "{\"answers\":[{\"windowId\":\"" + morning.getId()
                        + "\",\"status\":\"UNSURE\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answers.length()").value(1));
        mockMvc.perform(putAnswers(alice, token, answersBody("AVAILABLE")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.answers.length()").value(2));

        String raw = mockMvc.perform(getAnswers(round.getId(), alice, token)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<String> statuses = JsonPath.read(raw, "$.answers[*].status");
        assertThat(statuses).containsExactly("AVAILABLE", "AVAILABLE");
        assertThat(responseRepository.findByWindowId(afternoon.getId())).hasSize(1)
                .allSatisfy(r -> assertThat(r.getSource().name()).isEqualTo("PUBLIC_LINK"));
    }

    @Test
    void oneClosedWindowRejectsTheWholeCallAndSavesNothing() throws Exception {
        UUID alice = addPlayer("Alice", "Anderson", DOB, true);
        String token = verifiedToken("Alice", "Anderson", DOB, null);
        afternoon.setOpen(false);
        windowRepository.save(afternoon);

        mockMvc.perform(putAnswers(alice, token, answersBody("AVAILABLE"))).andExpect(status().isConflict());

        assertThat(responseRepository.findByWindowId(morning.getId())).isEmpty();
        assertThat(responseRepository.findByWindowId(afternoon.getId())).isEmpty();
        // The still-open window alone can be saved.
        mockMvc.perform(putAnswers(alice, token, "{\"answers\":[{\"windowId\":\"" + morning.getId()
                        + "\",\"status\":\"AVAILABLE\"}]}"))
                .andExpect(status().isOk());
    }

    @Test
    void aWindowOfAnotherRoundIsNotFoundAndSavesNothing() throws Exception {
        UUID alice = addPlayer("Alice", "Anderson", DOB, true);
        String token = verifiedToken("Alice", "Anderson", DOB, null);
        UUID foreignWindow = windowRepository.save(SectionAvailabilityWindow.builder().clubId(club.getId())
                .sectionId(section.getId()).roundId(roundRepository.save(SectionAvailabilityRound.builder()
                        .clubId(club.getId()).sectionId(section.getId()).description("Other")
                        .firstMatchDate(LocalDate.now().plusDays(30)).lastMatchDate(LocalDate.now().plusDays(30))
                        .autoClose(false).open(true).build()).getId())
                .windowDate(LocalDate.now().plusDays(30)).dayPart(DayPart.MORNING).open(true).build()).getId();

        mockMvc.perform(putAnswers(alice, token, "{\"answers\":[{\"windowId\":\"" + morning.getId()
                        + "\",\"status\":\"AVAILABLE\"},{\"windowId\":\"" + foreignWindow
                        + "\",\"status\":\"AVAILABLE\"}]}"))
                .andExpect(status().isNotFound());

        assertThat(responseRepository.findByWindowId(morning.getId())).isEmpty();
    }

    @Test
    void duplicateOrWindowlessAnswersAreRejected() throws Exception {
        UUID alice = addPlayer("Alice", "Anderson", DOB, true);
        String token = verifiedToken("Alice", "Anderson", DOB, null);

        mockMvc.perform(putAnswers(alice, token, "{\"answers\":[]}")).andExpect(status().isBadRequest());
        mockMvc.perform(putAnswers(alice, token, "{\"answers\":[{\"status\":\"AVAILABLE\"}]}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(putAnswers(alice, token, "{\"answers\":[{\"windowId\":\"" + morning.getId()
                        + "\",\"status\":\"AVAILABLE\"},{\"windowId\":\"" + morning.getId()
                        + "\",\"status\":\"UNSURE\"}]}"))
                .andExpect(status().isBadRequest());
    }
}
