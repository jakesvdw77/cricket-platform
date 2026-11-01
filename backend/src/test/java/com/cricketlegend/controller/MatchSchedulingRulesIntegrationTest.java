package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Match;
import com.cricketlegend.dto.CreateMatchRequest;
import com.cricketlegend.exception.ScheduleRuleException;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.service.MatchService;
import com.cricketlegend.service.support.schedule.ScheduleRule;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * docs/specs/132-match-scheduling-rules.md against real Postgres: the owner's three 2026-11-01 cases through
 * {@code POST /matches}, an unrelated edit of an already clashing match, reschedule, reactivate, the batch the import
 * commits through, and club isolation. Deliberately not {@code @Transactional}; the fixtures remove what they seed.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MatchSchedulingRulesIntegrationTest {

    private static final String MATCHES = "/api/v1/manage/clubs/{clubId}/matches";
    private static final ZoneId ZONE = ZoneId.systemDefault();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private MatchService matchService;

    private ManagerOverviewFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private static Instant at(String time) {
        return LocalDate.of(2031, 6, 7).atTime(LocalTime.parse(time)).atZone(ZONE).toInstant();
    }

    private static String createBody(World w, UUID homeTeamId, String awayName, String time, String venue,
            List<String> acknowledged) {
        return "{\"homeTeamId\":\"" + homeTeamId + "\",\"awayTeamName\":\"" + awayName + "\",\"seasonId\":\""
                + w.season().getId() + "\",\"matchDate\":\"" + at(time) + "\""
                + (venue == null ? "" : ",\"venue\":\"" + venue + "\"")
                + (acknowledged == null ? ""
                        : ",\"acknowledgedWarnings\":[" + String.join(",", acknowledged.stream().map(c -> "\"" + c + "\"").toList()) + "]")
                + "}";
    }

    private ResultActions create(World w, JwtRequestPostProcessor admin, UUID homeTeamId, String awayName, String time,
            String venue, List<String> acknowledged) throws Exception {
        return mockMvc.perform(post(MATCHES, w.club().getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                .content(createBody(w, homeTeamId, awayName, time, venue, acknowledged)));
    }

    private long matchCount(World w) {
        return matchRepository.findAll().stream().filter(m -> w.club().getId().equals(m.getClubId())).count();
    }

    @Test
    void theOwnersFirstCaseAnOwnTeamTwiceWithinTwoHoursIsABlockingErrorNamingTheOtherMatch() throws Exception {
        World w = fixtures.world();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        create(w, admin, w.seniors1().getId(), "Harlequins", "09:30", null, null).andExpect(status().isCreated());
        Match first = matchRepository.findAll().stream()
                .filter(m -> w.club().getId().equals(m.getClubId())).findFirst().orElseThrow();

        create(w, admin, w.seniors1().getId(), "Zebras", "10:00", null, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.needsConfirmation").value(false))
                .andExpect(jsonPath("$.findings[0].code").value("OWN_TEAM_OVERLAP"))
                .andExpect(jsonPath("$.findings[0].severity").value("ERROR"))
                .andExpect(jsonPath("$.findings[0].field").value("time"))
                .andExpect(jsonPath("$.findings[0].otherMatchId").value(first.getId().toString()))
                .andExpect(jsonPath("$.findings[0].message").value(
                        "Villagers 1 already plays Harlequins at 09:30 on 7 Jun 2031, less than 2 hours from 10:00."));
        // an error is never overridden by acknowledging it
        create(w, admin, w.seniors1().getId(), "Zebras", "10:00", null, List.of("OWN_TEAM_OVERLAP"))
                .andExpect(status().isConflict());
        assertThat(matchCount(w)).isEqualTo(1);
    }

    @Test
    void theOwnersSecondCaseARepeatOfAMatchIsABlockingError() throws Exception {
        World w = fixtures.world();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        create(w, admin, w.seniors2().getId(), "Harlequins", "07:30", null, null).andExpect(status().isCreated());

        create(w, admin, w.seniors2().getId(), "Harlequins", "07:30", null, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.needsConfirmation").value(false))
                .andExpect(jsonPath("$.findings.length()").value(1))
                .andExpect(jsonPath("$.findings[0].code").value("DUPLICATE_MATCH"))
                .andExpect(jsonPath("$.findings[0].field").value("teams"));
        assertThat(matchCount(w)).isEqualTo(1);
    }

    @Test
    void theOwnersThirdCaseTheSamePairAtAnotherTimeWarnsThenSavesWithTheAcknowledgement() throws Exception {
        World w = fixtures.world();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        create(w, admin, w.seniors2().getId(), "Harlequins", "07:30", null, null).andExpect(status().isCreated());

        create(w, admin, w.seniors2().getId(), "Harlequins", "14:00", null, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.needsConfirmation").value(true))
                .andExpect(jsonPath("$.findings[?(@.code=='DUPLICATE_SAME_DAY')].severity").value("WARNING"))
                .andExpect(jsonPath("$.findings[?(@.code=='OWN_TEAM_SAME_DATE')].severity").value("WARNING"));
        // a code that was not acknowledged returns 409 again
        create(w, admin, w.seniors2().getId(), "Harlequins", "14:00", null, List.of("DUPLICATE_SAME_DAY"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.needsConfirmation").value(true));
        assertThat(matchCount(w)).isEqualTo(1);

        create(w, admin, w.seniors2().getId(), "Harlequins", "14:00", null,
                List.of("DUPLICATE_SAME_DAY", "OWN_TEAM_SAME_DATE")).andExpect(status().isCreated());
        assertThat(matchCount(w)).isEqualTo(2);
    }

    @Test
    void aVenueInUseWithinThreeHoursWarnsAndNeedsTheAcknowledgement() throws Exception {
        World w = fixtures.world();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        create(w, admin, w.seniors1().getId(), "Harlequins", "09:00", "Main Oval", null).andExpect(status().isCreated());

        create(w, admin, w.juniorsTeam().getId(), "Zebras", "11:00", "main oval", null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.needsConfirmation").value(true))
                .andExpect(jsonPath("$.findings[0].code").value("VENUE_TIME_CLASH"))
                .andExpect(jsonPath("$.findings[0].field").value("venue"));
        create(w, admin, w.juniorsTeam().getId(), "Zebras", "11:00", "main oval", List.of("VENUE_TIME_CLASH"))
                .andExpect(status().isCreated());
    }

    @Test
    void editingAnUnrelatedFieldOfAMatchThatAlreadyClashesIsNeverBlocked() throws Exception {
        World w = fixtures.world();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        Match clashing = fixtures.match(w, w.seniors1(), null, at("10:00"));
        fixtures.match(w, w.seniors1(), w.seniors2(), at("09:30")); // seeded clash, saved before the rules existed

        mockMvc.perform(put(MATCHES + "/{id}", w.club().getId(), clashing.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody(w, "Occasionals", "10:00", "Ground", "https://example.com/live")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scoringUrl").value("https://example.com/live"));

        // moving it to another still-clashing time is a change of time, so the rules run
        mockMvc.perform(put(MATCHES + "/{id}", w.club().getId(), clashing.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody(w, "Occasionals", "10:30", "Ground", "https://example.com/live")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.findings[0].code").value("OWN_TEAM_OVERLAP"));
        assertThat(matchRepository.findById(clashing.getId()).orElseThrow().getMatchDate()).isEqualTo(at("10:00"));

        // and moving it to another day, clear of the clash, saves
        String nextDay = updateBody(w, "Occasionals", "10:00", "Ground", "https://example.com/live")
                .replace(at("10:00").toString(), at("10:00").plusSeconds(86_400).toString());
        mockMvc.perform(put(MATCHES + "/{id}", w.club().getId(), clashing.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON).content(nextDay))
                .andExpect(status().isOk());
    }

    private static String updateBody(World w, String awayName, String time, String venue, String scoringUrl) {
        return "{\"homeTeamId\":\"" + w.seniors1().getId() + "\",\"awayTeamName\":\"" + awayName + "\",\"seasonId\":\""
                + w.season().getId() + "\",\"matchDate\":\"" + at(time) + "\",\"venue\":\"" + venue
                + "\",\"scoringUrl\":\"" + scoringUrl + "\"}";
    }

    @Test
    void anEditedMatchNeverClashesWithItself() throws Exception {
        World w = fixtures.world();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        Match match = fixtures.match(w, w.seniors1(), null, at("10:00"));

        mockMvc.perform(put(MATCHES + "/{id}", w.club().getId(), match.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody(w, "Occasionals", "10:00", "Ground", "https://example.com/x")))
                .andExpect(status().isOk());
        // a small move of the same match (10:00 to 10:30) is not a clash with its own old slot
        mockMvc.perform(put(MATCHES + "/{id}", w.club().getId(), match.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateBody(w, "Occasionals", "10:30", "Ground", "https://example.com/x")))
                .andExpect(status().isOk());
    }

    @Test
    void rescheduleIntoAnOverlapIsBlockedAndIntoASameDayWarnsUntilAcknowledged() throws Exception {
        World w = fixtures.world();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        fixtures.match(w, w.seniors1(), null, at("09:00"));
        Match moving = fixtures.match(w, w.seniors1(), w.seniors2(), at("20:00"));
        String url = MATCHES + "/{id}/date-time";

        mockMvc.perform(patch(url, w.club().getId(), moving.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"matchDate\":\"" + at("10:00") + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.findings[0].code").value("OWN_TEAM_OVERLAP"));
        mockMvc.perform(patch(url, w.club().getId(), moving.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"matchDate\":\"" + at("14:00") + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.needsConfirmation").value(true))
                .andExpect(jsonPath("$.findings[0].code").value("OWN_TEAM_SAME_DATE"));
        assertThat(matchRepository.findById(moving.getId()).orElseThrow().getMatchDate()).isEqualTo(at("20:00"));

        mockMvc.perform(patch(url, w.club().getId(), moving.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"matchDate\":\"" + at("14:00") + "\",\"acknowledgedWarnings\":[\"OWN_TEAM_SAME_DATE\"]}"))
                .andExpect(status().isOk());
        assertThat(matchRepository.findById(moving.getId()).orElseThrow().getMatchDate()).isEqualTo(at("14:00"));
    }

    @Test
    void reactivatingIntoAnOverlapIsBlockedAndAWarningOnlyClashDoesNotBlock() throws Exception {
        World w = fixtures.world();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        fixtures.match(w, w.seniors1(), null, at("09:30"));
        Match overlapping = fixtures.match(w, w.seniors1(), null, at("10:00"), false, null);
        Match sameDayOnly = fixtures.match(w, w.seniors1(), null, at("20:00"), false, null);
        String url = MATCHES + "/{id}/reactivate";

        mockMvc.perform(post(url, w.club().getId(), overlapping.getId()).with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.findings[0].code").value("OWN_TEAM_OVERLAP"));
        assertThat(matchRepository.findById(overlapping.getId()).orElseThrow().isActive()).isFalse();

        mockMvc.perform(post(url, w.club().getId(), sameDayOnly.getId()).with(admin)).andExpect(status().isOk());
    }

    @Test
    void anInactiveMatchNeverCausesAFinding() throws Exception {
        World w = fixtures.world();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        fixtures.match(w, w.seniors1(), null, at("09:30"), false, null);

        create(w, admin, w.seniors1().getId(), "Occasionals", "09:30", null, null).andExpect(status().isCreated());
    }

    @Test
    void aBatchBlocksAnInBatchOverlapAndSavesNothing() {
        World w = fixtures.world();
        Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");
        List<CreateMatchRequest> requests = List.of(
                batchRequest(w, "Harlequins", "09:30", null), batchRequest(w, "Zebras", "10:00", null));

        assertThatThrownBy(() -> matchService.createBatch(admin, w.club().getId(), requests))
                .isInstanceOfSatisfying(ScheduleRuleException.class, e -> {
                    assertThat(e.needsConfirmation()).isFalse();
                    assertThat(e.getFindings().get(0).code()).isEqualTo("OWN_TEAM_OVERLAP");
                });
        assertThat(matchCount(w)).isZero();
    }

    @Test
    void aBatchSavesWhenItsWarningsAreAcknowledgedAndNotOtherwise() {
        World w = fixtures.world();
        Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");
        fixtures.match(w, w.seniors1(), null, at("09:00"));

        assertThatThrownBy(() -> matchService.createBatch(admin, w.club().getId(),
                List.of(batchRequest(w, "Zebras", "15:00", null))))
                .isInstanceOfSatisfying(ScheduleRuleException.class, e -> assertThat(e.needsConfirmation()).isTrue());
        assertThat(matchService.createBatch(admin, w.club().getId(),
                List.of(batchRequest(w, "Zebras", "15:00", ScheduleRule.warningCodes())))).hasSize(1);
    }

    private static CreateMatchRequest batchRequest(World w, String awayName, String time, List<String> acknowledged) {
        return new CreateMatchRequest(w.seniors1().getId(), null, null, awayName, null, null, null, w.season().getId(),
                at(time), null, null, null, null, null, null, acknowledged);
    }

    @Test
    void anotherClubsMatchesNeverCauseAFinding() throws Exception {
        World mine = fixtures.world();
        World other = fixtures.world();
        fixtures.match(other, other.seniors1(), null, at("09:30"));

        create(mine, fixtures.clubAdmin(mine), mine.seniors1().getId(), "Occasionals", "09:30", "Ground", null)
                .andExpect(status().isCreated());
    }

    // ---- past date (docs/specs/132) -------------------------------------------------------------------------------

    private static Instant daysFromToday(int days, String time) {
        return LocalDate.now(ZONE).plusDays(days).atTime(LocalTime.parse(time)).atZone(ZONE).toInstant();
    }

    private static String bodyAt(World w, Instant when, String venue) {
        return "{\"homeTeamId\":\"" + w.seniors1().getId() + "\",\"awayTeamName\":\"Occasionals\",\"seasonId\":\""
                + w.season().getId() + "\",\"matchDate\":\"" + when + "\",\"venue\":\"" + venue + "\"}";
    }

    @Test
    void creatingAMatchInThePastWarnsUntilAcknowledged() throws Exception {
        World w = fixtures.world();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        String body = bodyAt(w, daysFromToday(-3, "10:00"), "Ground");

        mockMvc.perform(post(MATCHES, w.club().getId()).with(admin).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.needsConfirmation").value(true))
                .andExpect(jsonPath("$.findings[0].code").value("PAST_DATE"))
                .andExpect(jsonPath("$.findings[0].severity").value("WARNING"))
                .andExpect(jsonPath("$.findings[0].message").value("This match is dated in the past."));
        assertThat(matchCount(w)).isZero();

        mockMvc.perform(post(MATCHES, w.club().getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content(body.substring(0, body.length() - 1) + ",\"acknowledgedWarnings\":[\"PAST_DATE\"]}"))
                .andExpect(status().isCreated());
    }

    @Test
    void editingOtherFieldsOfAPastMatchDoesNotRaisePastDateButChangingItsDateDoes() throws Exception {
        World w = fixtures.world();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        Instant past = daysFromToday(-5, "10:00");
        Match match = fixtures.match(w, w.seniors1(), null, past);

        // venue changes, date unchanged: no PAST_DATE (and no other finding)
        mockMvc.perform(put(MATCHES + "/{id}", w.club().getId(), match.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON).content(bodyAt(w, past, "Back field")))
                .andExpect(status().isOk());

        // date changed to another past day: warns
        mockMvc.perform(put(MATCHES + "/{id}", w.club().getId(), match.getId()).with(admin)
                        .contentType(MediaType.APPLICATION_JSON).content(bodyAt(w, daysFromToday(-4, "10:00"), "Back field")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.findings[0].code").value("PAST_DATE"));

        // the date-time route: unchanged is fine, changed into the past warns, a future date is fine
        String url = MATCHES + "/{id}/date-time";
        mockMvc.perform(patch(url, w.club().getId(), match.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"matchDate\":\"" + past + "\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(patch(url, w.club().getId(), match.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"matchDate\":\"" + daysFromToday(-2, "10:00") + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.findings[0].code").value("PAST_DATE"));
        mockMvc.perform(patch(url, w.club().getId(), match.getId()).with(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"matchDate\":\"" + daysFromToday(10, "10:00") + "\"}"))
                .andExpect(status().isOk());
    }
}
