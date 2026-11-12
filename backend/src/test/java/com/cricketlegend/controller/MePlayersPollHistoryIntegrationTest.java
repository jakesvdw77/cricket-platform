package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.AbstractLinkIntegrationTest;
import com.cricketlegend.domain.AnswerSource;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonLink;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Hub Availability pills (docs/specs/119): {@code GET /me/players/{k}/polls/closed} and {@code /polls/responses}. Not
 * transactional (the {@code open-in-view=false} trap in docs/standards/backend.md); every test makes its own club.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MePlayersPollHistoryIntegrationTest extends AbstractLinkIntegrationTest {

    private static final Set<String> ROW_KEYS = Set.of("pollId", "kind", "title", "teamName", "matchDate", "homeName",
            "awayName", "venue", "windowDate", "open", "closedAt", "answers", "answered", "selected");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PlayerAvailabilityRepository availabilityRepository;
    @Autowired private SectionAvailabilityResponseRepository responseRepository;
    @Autowired private MatchSideRepository sideRepository;
    @Autowired private MatchSidePlayerRepository sidePlayerRepository;

    /** A club with a current season, a team, a parent and one linked child in the team's squad and the section. */
    private record Setup(Club club, Section section, Season season, Team team, Person parent, PlayerProfile kid, PersonLink link) {}

    private Setup setup() {
        Club club = club("Hillcrest");
        Section section = section(club, "Over 40");
        Season season = seasonRepository.save(Season.builder().clubId(club.getId()).label(unique("Cur"))
                .startDate(LocalDate.now().minusDays(100)).endDate(LocalDate.now().plusDays(100)).active(true).build());
        Team team = teamRepository.save(Team.builder().clubId(club.getId()).sectionId(section.getId()).name("Over 40 A")
                .active(true).build());
        Person parent = account("Pat", "Parent");
        Person kidPerson = playerPerson("Sam", "Smith", CHILD_DOB);
        PlayerProfile kid = profile(club, kidPerson, null);
        tag(kid, section);
        squadMemberRepository.save(TeamSquadMember.builder().teamId(team.getId()).seasonId(season.getId())
                .playerProfileId(kid.getId()).jerseyNumber(1).build());
        return new Setup(club, section, season, team, parent, kid, link(parent, kidPerson, club, true));
    }

    private Match match(Setup s, Season season, int daysFromNow) {
        return matchRepository.save(Match.builder().clubId(s.club().getId()).homeTeamId(s.team().getId())
                .awayTeamName("Eagles").seasonId(season.getId()).matchDate(Instant.now().plus(daysFromNow, ChronoUnit.DAYS))
                .venue("Main Oval").active(true).build());
    }

    /** A squad poll on a match {@code matchDays} from now; a closed one closed {@code closedDaysAgo} days ago. */
    private MatchAvailabilityPoll squadPoll(Setup s, Season season, int matchDays, boolean open, int closedDaysAgo) {
        Match m = match(s, season, matchDays);
        MatchAvailabilityPoll poll = pollRepository.save(MatchAvailabilityPoll.builder().matchId(m.getId())
                .teamId(s.team().getId()).open(open).build());
        if (!open) {
            setUpdatedAt("match_availability_poll", poll.getId(), closedDaysAgo);
        }
        return poll;
    }

    private void setUpdatedAt(String table, UUID id, int daysAgo) {
        jdbc.update("update " + table + " set updated_at = ? where id = ?",
                java.sql.Timestamp.from(Instant.now().minus(daysAgo, ChronoUnit.DAYS)), id);
    }

    private void answer(MatchAvailabilityPoll poll, PlayerProfile who, AvailabilityStatus status) {
        availabilityRepository.save(PlayerAvailability.builder().pollId(poll.getId()).playerProfileId(who.getId())
                .status(status).source(AnswerSource.LINKED_ACCOUNT).build());
    }

    private SectionAvailabilityRound round(Setup s, int firstDaysFromNow, boolean open, int closedDaysAgo) {
        LocalDate day = LocalDate.now().plusDays(firstDaysFromNow);
        SectionAvailabilityRound round = roundRepository.save(SectionAvailabilityRound.builder().clubId(s.club().getId())
                .sectionId(s.section().getId()).description("Sunday fixtures").firstMatchDate(day).lastMatchDate(day)
                .autoClose(false).open(open).build());
        if (!open) {
            setUpdatedAt("section_availability_round", round.getId(), closedDaysAgo);
        }
        return round;
    }

    private SectionAvailabilityWindow window(Setup s, SectionAvailabilityRound round, LocalDate day, DayPart part) {
        return windowRepository.save(SectionAvailabilityWindow.builder().clubId(s.club().getId())
                .sectionId(s.section().getId()).roundId(round.getId()).windowDate(day).dayPart(part)
                .open(round.isOpen()).build());
    }

    private void respond(SectionAvailabilityWindow w, PlayerProfile who, AvailabilityStatus status) {
        responseRepository.save(SectionAvailabilityResponse.builder().windowId(w.getId()).playerProfileId(who.getId())
                .status(status).source(AnswerSource.LINKED_ACCOUNT).build());
    }

    private MatchSide announce(MatchAvailabilityPoll poll, Team team, boolean announced, PlayerProfile... selected) {
        MatchSide side = sideRepository.save(MatchSide.builder().matchId(poll.getMatchId()).teamId(team.getId())
                .announced(announced).build());
        for (PlayerProfile p : selected) {
            sidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(side.getId()).playerProfileId(p.getId())
                    .role(com.cricketlegend.domain.PlayingRole.BATSMAN).build());
        }
        return side;
    }

    private String closed(Setup s, String query) throws Exception {
        return mockMvc.perform(get("/api/v1/me/players/{k}/polls/closed" + query, s.link().getId()).with(as(s.parent())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    private String responses(Setup s, String query) throws Exception {
        return mockMvc.perform(get("/api/v1/me/players/{k}/polls/responses" + query, s.link().getId()).with(as(s.parent())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    // ---- access ----

    @Test
    void accessMatrixAndParameterErrors() throws Exception {
        Setup s = setup();
        Person stranger = account("Some", "Stranger");
        Setup other = setup();
        for (String route : List.of("closed", "responses")) {
            String url = "/api/v1/me/players/{k}/polls/" + route;
            mockMvc.perform(get(url, s.link().getId())).andExpect(status().isUnauthorized());
            mockMvc.perform(get(url, other.link().getId()).with(as(s.parent()))).andExpect(status().isNotFound());
            mockMvc.perform(get(url, "not-a-key").with(as(s.parent()))).andExpect(status().isNotFound());
            mockMvc.perform(get(url, UUID.randomUUID()).with(as(s.parent()))).andExpect(status().isNotFound());
            mockMvc.perform(get(url, s.link().getId()).with(as(stranger))).andExpect(status().isNotFound());
            mockMvc.perform(get(url, s.link().getId()).param("status", "MAYBE").with(as(s.parent())))
                    .andExpect(status().isBadRequest());
            mockMvc.perform(get(url, s.link().getId()).with(as(clubAdmin(s.club())))).andExpect(status().isNotFound());
        }
        for (String days : List.of("0", "366", "-5", "abc")) {
            mockMvc.perform(get("/api/v1/me/players/{k}/polls/closed", s.link().getId()).param("sinceDays", days)
                    .with(as(s.parent()))).andExpect(status().isBadRequest());
        }
        mockMvc.perform(get("/api/v1/me/players/{k}/polls/responses", s.link().getId()).param("seasonId", "nope")
                .with(as(s.parent()))).andExpect(status().isBadRequest());

        Person parent = personRepository.findById(s.parent().getId()).orElseThrow();
        parent.setStatus(PersonStatus.SUSPENDED);
        personRepository.save(parent);
        mockMvc.perform(get("/api/v1/me/players/{k}/polls/closed", s.link().getId()).with(as(parent)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/me/players/{k}/polls/responses", s.link().getId()).with(as(parent)))
                .andExpect(status().isForbidden());
    }

    // ---- closed ----

    @Test
    void closedDefaultsToThirtyDaysAndSinceDaysWidensItNewestClosedFirstOpenAndForeignPollsExcluded() throws Exception {
        Setup s = setup();
        MatchAvailabilityPoll recent = squadPoll(s, s.season(), -9, false, 8);
        MatchAvailabilityPoll older = squadPoll(s, s.season(), -45, false, 40);
        MatchAvailabilityPoll newest = squadPoll(s, s.season(), -2, false, 1);
        squadPoll(s, s.season(), 5, true, 0); // open: not in this list
        // a closed poll of a team the player is not in
        Team otherTeam = teamRepository.save(Team.builder().clubId(s.club().getId()).sectionId(s.section().getId())
                .name("Other").active(true).build());
        Match foreign = match(s, s.season(), -3);
        MatchAvailabilityPoll foreignPoll = pollRepository.save(MatchAvailabilityPoll.builder().matchId(foreign.getId())
                .teamId(otherTeam.getId()).open(false).build());
        setUpdatedAt("match_availability_poll", foreignPoll.getId(), 2);
        // a closed poll of another club's squad, same days
        Setup elsewhere = setup();
        squadPoll(elsewhere, elsewhere.season(), -3, false, 2);

        String json = closed(s, "");
        assertThat(JsonPath.<Integer>read(json, "$.sinceDays")).isEqualTo(30);
        assertThat(JsonPath.<Integer>read(json, "$.total")).isEqualTo(2);
        assertThat(JsonPath.<List<String>>read(json, "$.rows[*].pollId"))
                .containsExactly(newest.getId().toString(), recent.getId().toString());

        String wide = closed(s, "?sinceDays=90");
        assertThat(JsonPath.<Integer>read(wide, "$.sinceDays")).isEqualTo(90);
        assertThat(JsonPath.<List<String>>read(wide, "$.rows[*].pollId"))
                .containsExactly(newest.getId().toString(), recent.getId().toString(), older.getId().toString());
        assertThat(JsonPath.<Boolean>read(wide, "$.rows[0].open")).isFalse();
        assertThat(JsonPath.<String>read(wide, "$.rows[0].closedAt")).isNotNull();
    }

    @Test
    void closedRowsCarryTheOwnAnswerAndTheSelectionOnlyOnceAnnouncedAndTheStatusFilterNarrowsButTotalDoesNot() throws Exception {
        Setup s = setup();
        MatchAvailabilityPoll selected = squadPoll(s, s.season(), -2, false, 1);
        answer(selected, s.kid(), AvailabilityStatus.AVAILABLE);
        announce(selected, s.team(), true, s.kid());
        MatchAvailabilityPoll notSelected = squadPoll(s, s.season(), -4, false, 3);
        answer(notSelected, s.kid(), AvailabilityStatus.UNAVAILABLE);
        announce(notSelected, s.team(), true);
        MatchAvailabilityPoll unannounced = squadPoll(s, s.season(), -6, false, 5);
        announce(unannounced, s.team(), false, s.kid());
        // someone else's answer on the poll is never returned
        Person other = playerPerson("Olive", "Other", CHILD_DOB);
        PlayerProfile otherProfile = profile(s.club(), other, null);
        answer(unannounced, otherProfile, AvailabilityStatus.AVAILABLE);

        String json = closed(s, "");
        assertThat(JsonPath.<Integer>read(json, "$.total")).isEqualTo(3);
        assertThat(JsonPath.<List<Boolean>>read(json, "$.rows[?(@.pollId=='" + selected.getId() + "')].selected"))
                .containsExactly(true);
        assertThat(JsonPath.<List<Boolean>>read(json, "$.rows[?(@.pollId=='" + notSelected.getId() + "')].selected"))
                .containsExactly(false);
        assertThat(JsonPath.<List<Object>>read(json, "$.rows[?(@.pollId=='" + unannounced.getId() + "')].selected"))
                .containsExactly((Object) null);
        assertThat(JsonPath.<List<Boolean>>read(json, "$.rows[?(@.pollId=='" + unannounced.getId() + "')].answered"))
                .containsExactly(false);
        assertThat(JsonPath.<List<Integer>>read(json, "$.rows[?(@.pollId=='" + unannounced.getId() + "')].answers.length()"))
                .containsExactly(0);

        String available = closed(s, "?status=AVAILABLE");
        assertThat(JsonPath.<Integer>read(available, "$.total")).isEqualTo(3);
        assertThat(JsonPath.<List<String>>read(available, "$.rows[*].pollId")).containsExactly(selected.getId().toString());
        assertThat(JsonPath.<String>read(available, "$.rows[0].answers[0].status")).isEqualTo("AVAILABLE");
        assertThat(JsonPath.<List<String>>read(closed(s, "?status=UNAVAILABLE"), "$.rows[*].pollId"))
                .containsExactly(notSelected.getId().toString());
        assertThat(JsonPath.<List<String>>read(closed(s, "?status=NOT_ANSWERED"), "$.rows[*].pollId"))
                .containsExactly(unannounced.getId().toString());
        assertThat(JsonPath.<List<String>>read(closed(s, "?status=UNSURE"), "$.rows[*].pollId")).isEmpty();
    }

    @Test
    void aClosedGroupPollShowsTheOwnAnswersWithWindowLabelsAndTheDatesCovered() throws Exception {
        Setup s = setup();
        SectionAvailabilityRound round = round(s, -3, false, 2);
        LocalDate sat = LocalDate.now().minusDays(3);
        SectionAvailabilityWindow morning = window(s, round, sat, DayPart.MORNING);
        SectionAvailabilityWindow afternoon = window(s, round, sat.plusDays(1), DayPart.AFTERNOON);
        respond(morning, s.kid(), AvailabilityStatus.UNAVAILABLE);
        respond(afternoon, s.kid(), AvailabilityStatus.AVAILABLE);

        String json = closed(s, "?status=UNAVAILABLE");
        assertThat(JsonPath.<Integer>read(json, "$.rows.length()")).isEqualTo(1);
        assertThat(JsonPath.<String>read(json, "$.rows[0].kind")).isEqualTo("GROUP");
        assertThat(JsonPath.<String>read(json, "$.rows[0].title")).isEqualTo("Sunday fixtures");
        assertThat(JsonPath.<String>read(json, "$.rows[0].teamName")).isEqualTo(s.section().getName());
        assertThat(JsonPath.<List<String>>read(json, "$.rows[0].windowDate"))
                .containsExactly(sat.toString(), sat.plusDays(1).toString());
        assertThat(JsonPath.<List<String>>read(json, "$.rows[0].answers[*].status")).containsExactly("UNAVAILABLE", "AVAILABLE");
        assertThat(JsonPath.<String>read(json, "$.rows[0].answers[0].label"))
                .endsWith(" morning").hasSize("Sat morning".length());
        assertThat(JsonPath.<String>read(json, "$.rows[0].answers[0].windowId")).isEqualTo(morning.getId().toString());
        assertThat((Object) JsonPath.read(json, "$.rows[0].selected")).isNull();
        // a mixed answer matches either status filter
        assertThat(JsonPath.<Integer>read(closed(s, "?status=AVAILABLE"), "$.rows.length()")).isEqualTo(1);
        assertThat(JsonPath.<Integer>read(closed(s, "?status=NOT_ANSWERED"), "$.rows.length()")).isEqualTo(0);
    }

    // ---- responses ----

    @Test
    void responsesDefaultToTheCurrentSeasonWithSummaryAndStatusFilterAndOldSeasonsNeedSeasonId() throws Exception {
        Setup s = setup();
        Season old = seasonRepository.save(Season.builder().clubId(s.club().getId()).label(unique("Old"))
                .startDate(LocalDate.now().minusDays(600)).endDate(LocalDate.now().minusDays(400)).active(true).build());
        squadMemberRepository.save(TeamSquadMember.builder().teamId(s.team().getId()).seasonId(old.getId())
                .playerProfileId(s.kid().getId()).jerseyNumber(1).build());
        MatchAvailabilityPoll oldPoll = squadPoll(s, old, -500, false, 499);

        MatchAvailabilityPoll openPoll = squadPoll(s, s.season(), 5, true, 0); // unanswered, open
        MatchAvailabilityPoll yes = squadPoll(s, s.season(), -3, false, 4);
        answer(yes, s.kid(), AvailabilityStatus.AVAILABLE);
        announce(yes, s.team(), true, s.kid());
        MatchAvailabilityPoll no = squadPoll(s, s.season(), -10, false, 11);
        answer(no, s.kid(), AvailabilityStatus.UNAVAILABLE);
        MatchAvailabilityPoll none = squadPoll(s, s.season(), -20, false, 21);
        SectionAvailabilityRound round = round(s, -30, false, 29);
        SectionAvailabilityWindow w1 = window(s, round, LocalDate.now().minusDays(30), DayPart.MORNING);
        SectionAvailabilityWindow w2 = window(s, round, LocalDate.now().minusDays(30), DayPart.AFTERNOON);
        respond(w1, s.kid(), AvailabilityStatus.UNSURE);
        respond(w2, s.kid(), AvailabilityStatus.AVAILABLE);
        SectionAvailabilityRound unsure = round(s, -40, true, 0);
        respond(window(s, unsure, LocalDate.now().minusDays(40), DayPart.MORNING), s.kid(), AvailabilityStatus.UNSURE);

        String json = responses(s, "");
        assertThat(JsonPath.<String>read(json, "$.scope.seasonId")).isEqualTo(s.season().getId().toString());
        assertThat(JsonPath.<String>read(json, "$.currentSeasonId")).isEqualTo(s.season().getId().toString());
        assertThat(JsonPath.<List<String>>read(json, "$.seasons[*].id"))
                .containsExactly(s.season().getId().toString(), old.getId().toString());
        assertThat(JsonPath.<List<String>>read(json, "$.seasons[*].label")).containsExactly(s.season().getLabel(), old.getLabel());
        assertThat(JsonPath.<List<String>>read(json, "$.rows[*].pollId")).containsExactly(
                openPoll.getId().toString(), yes.getId().toString(), no.getId().toString(), none.getId().toString(),
                round.getId().toString(), unsure.getId().toString());
        Map<String, Integer> summary = JsonPath.read(json, "$.summary");
        assertThat(summary).containsOnlyKeys("polls", "answered", "available", "unavailable", "notSure", "notAnswered");
        // the group poll with a mix counts once as available; the all-unsure round counts as not sure
        assertThat(summary).containsEntry("polls", 6).containsEntry("answered", 4).containsEntry("available", 2)
                .containsEntry("unavailable", 1).containsEntry("notSure", 1).containsEntry("notAnswered", 2);
        assertThat(JsonPath.<List<Boolean>>read(json, "$.rows[?(@.pollId=='" + yes.getId() + "')].selected")).containsExactly(true);
        assertThat(JsonPath.<List<Boolean>>read(json, "$.rows[?(@.pollId=='" + openPoll.getId() + "')].open")).containsExactly(true);

        String filtered = responses(s, "?status=NOT_ANSWERED");
        assertThat(JsonPath.<List<String>>read(filtered, "$.rows[*].pollId"))
                .containsExactly(openPoll.getId().toString(), none.getId().toString());
        assertThat(JsonPath.<Integer>read(filtered, "$.summary.polls")).isEqualTo(6); // before the filter

        String oldJson = responses(s, "?seasonId=" + old.getId());
        assertThat(JsonPath.<String>read(oldJson, "$.scope.seasonId")).isEqualTo(old.getId().toString());
        assertThat(JsonPath.<List<String>>read(oldJson, "$.rows[*].pollId")).containsExactly(oldPoll.getId().toString());
        assertThat(JsonPath.<Integer>read(oldJson, "$.summary.polls")).isEqualTo(1);
    }

    @Test
    void anotherClubsSeasonIsNotFound() throws Exception {
        Setup s = setup();
        Setup other = setup();
        mockMvc.perform(get("/api/v1/me/players/{k}/polls/responses", s.link().getId())
                        .param("seasonId", other.season().getId().toString()).with(as(s.parent())))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/me/players/{k}/polls/responses", s.link().getId())
                        .param("seasonId", UUID.randomUUID().toString()).with(as(s.parent())))
                .andExpect(status().isNotFound());
    }

    @Test
    void aPlayerWithNoPollsGetsEmptyListsAndZeroes() throws Exception {
        Setup s = setup();
        String json = responses(s, "");
        assertThat(JsonPath.<Integer>read(json, "$.rows.length()")).isZero();
        assertThat(JsonPath.<Integer>read(json, "$.seasons.length()")).isZero();
        assertThat(JsonPath.<Integer>read(json, "$.summary.polls")).isZero();
        assertThat(JsonPath.<Integer>read(closed(s, ""), "$.total")).isZero();
    }

    @Test
    void responseKeysAreExactAndNoInternalIdIsExposed() throws Exception {
        Setup s = setup();
        MatchAvailabilityPoll poll = squadPoll(s, s.season(), -3, false, 2);
        answer(poll, s.kid(), AvailabilityStatus.AVAILABLE);
        SectionAvailabilityRound round = round(s, -1, false, 1);
        respond(window(s, round, LocalDate.now().minusDays(1), DayPart.MORNING), s.kid(), AvailabilityStatus.AVAILABLE);

        String closed = closed(s, "");
        assertThat(JsonPath.<Map<String, Object>>read(closed, "$").keySet()).containsExactlyInAnyOrder("sinceDays", "total", "rows");
        String responses = responses(s, "");
        assertThat(JsonPath.<Map<String, Object>>read(responses, "$").keySet())
                .containsExactlyInAnyOrder("scope", "seasons", "currentSeasonId", "summary", "rows");
        assertThat(JsonPath.<Map<String, Object>>read(responses, "$.scope").keySet()).containsExactly("seasonId");
        assertThat(JsonPath.<Map<String, Object>>read(responses, "$.seasons[0]").keySet()).containsExactlyInAnyOrder("id", "label");
        for (String json : List.of(closed, responses)) {
            for (int i = 0; i < 2; i++) {
                assertThat(JsonPath.<Map<String, Object>>read(json, "$.rows[" + i + "]").keySet()).isEqualTo(ROW_KEYS);
            }
        }
        // the only ids in a row are the poll id and a group answer's window id; none of the player, team, match, section or club
        assertThat(responses).doesNotContain(s.kid().getId().toString(), s.team().getId().toString(),
                s.section().getId().toString(), s.club().getId().toString(), poll.getMatchId().toString());
        List<Map<String, Object>> squadAnswers = JsonPath.read(responses, "$.rows[?(@.kind=='SQUAD')].answers[0]");
        assertThat(squadAnswers.get(0).keySet()).containsExactlyInAnyOrder("windowId", "label", "status");
    }
}
