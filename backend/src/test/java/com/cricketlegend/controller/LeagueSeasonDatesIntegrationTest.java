package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSeason;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Match;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.LeagueSeasonRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchRepository.OutsideDatesSummary;
import com.cricketlegend.service.support.ServerClock;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * docs/specs/111-league-season-dates.md against real Postgres: the migration's constraints, the outside-dates query,
 * the dates endpoints, match create and update honouring the dates, and the age reference date preferring them. The
 * season of {@link ManagerOverviewFixtures#world()} is calendar 2031; the league runs 1 Mar 2031 to 30 Sep 2031 here.
 * Deliberately not {@code @Transactional}; the fixtures remove what they seed (including {@code league_season}).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class LeagueSeasonDatesIntegrationTest {

    private static final String DATES = "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/dates";
    private static final String AGE = "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/age-reference-date";
    private static final String MATCHES = "/api/v1/manage/clubs/{clubId}/matches";
    private static final ZoneId ZONE = ZoneId.systemDefault();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private LeagueRepository leagueRepository;

    @Autowired
    private LeagueSeasonRepository leagueSeasonRepository;

    @Autowired
    private MatchRepository matchRepository;

    private ManagerOverviewFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private static Instant on(int month, int day) {
        return LocalDate.of(2031, month, day).atTime(15, 30).atZone(ZONE).toInstant();
    }

    private League league(World w) {
        return leagueRepository.save(League.builder().clubId(w.club().getId()).name("L-" + UUID.randomUUID())
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build());
    }

    private void dates(League league, World w, int fromMonth, int fromDay, int toMonth, int toDay) {
        leagueSeasonRepository.save(LeagueSeason.builder().leagueId(league.getId()).seasonId(w.season().getId())
                .startDate(LocalDate.of(2031, fromMonth, fromDay)).endDate(LocalDate.of(2031, toMonth, toDay)).build());
    }

    private static String body(String start, String end) {
        return "{\"startDate\":" + (start == null ? "null" : "\"" + start + "\"")
                + ",\"endDate\":" + (end == null ? "null" : "\"" + end + "\"") + "}";
    }

    private String matchJson(World w, League league, Instant when) {
        return "{\"homeTeamId\":\"" + w.seniors1().getId() + "\",\"awayTeamName\":\"Occasionals\",\"leagueId\":"
                + (league == null ? "null" : "\"" + league.getId() + "\"")
                + ",\"seasonId\":\"" + w.season().getId() + "\",\"matchDate\":\"" + when + "\"}";
    }

    // --- the migration ---

    @Test
    void theTableRefusesAStartAfterTheEndAndASecondRowForThePair() {
        World w = fixtures.world();
        League league = league(w);
        assertThatThrownBy(() -> dates(league, w, 9, 1, 3, 1)).isInstanceOf(DataIntegrityViolationException.class);

        dates(league, w, 3, 1, 9, 30);
        assertThatThrownBy(() -> dates(league, w, 4, 1, 8, 30)).isInstanceOf(DataIntegrityViolationException.class);
    }

    // --- the outside-dates query ---

    @Test
    void theOutsideQueryCountsOnlyActiveMatchesOfThePairOutsideTheDayBounds() {
        World w = fixtures.world();
        League one = league(w);
        League two = league(w);
        fixtures.match(w, w.seniors1(), null, on(3, 1), true, one);
        fixtures.match(w, w.seniors1(), null, on(9, 30), true, one);
        fixtures.match(w, w.seniors1(), null, on(2, 28), true, one);
        fixtures.match(w, w.seniors1(), null, on(10, 1), true, one);
        fixtures.match(w, w.seniors1(), null, on(1, 5), false, one);
        fixtures.match(w, w.seniors1(), null, on(12, 5), true, two);

        OutsideDatesSummary summary = matchRepository.summariseOutsideDates(
                one.getId(), w.season().getId(), ServerClock.startOfDay(LocalDate.of(2031, 3, 1)),
                ServerClock.startOfDay(LocalDate.of(2031, 10, 1)));

        assertThat(summary.getMatchCount()).isEqualTo(2);
        assertThat(summary.getEarliest()).isEqualTo(on(2, 28));
        assertThat(summary.getLatest()).isEqualTo(on(10, 1));

        OutsideDatesSummary none = matchRepository.summariseOutsideDates(
                one.getId(), w.season().getId(), ServerClock.startOfDay(LocalDate.of(2031, 1, 1)),
                ServerClock.startOfDay(LocalDate.of(2032, 1, 1)));
        assertThat(none.getMatchCount()).isZero();
        assertThat(none.getEarliest()).isNull();
    }

    // --- the endpoints ---

    @Test
    void getIs404UntilDatesAreSetThenPutCreatesAndReplacesThem() throws Exception {
        World w = fixtures.world();
        League league = league(w);

        mockMvc.perform(get(DATES, w.club().getId(), league.getId(), w.season().getId()).with(fixtures.clubAdmin(w)))
                .andExpect(status().isNotFound());

        mockMvc.perform(put(DATES, w.club().getId(), league.getId(), w.season().getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(body("2031-03-01", "2031-09-30")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.startDate").value("2031-03-01"))
                .andExpect(jsonPath("$.endDate").value("2031-09-30"));
        mockMvc.perform(put(DATES, w.club().getId(), league.getId(), w.season().getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(body("2031-02-01", "2031-10-31")))
                .andExpect(status().isOk());

        mockMvc.perform(get(DATES, w.club().getId(), league.getId(), w.season().getId()).with(fixtures.clubAdmin(w)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.startDate").value("2031-02-01"))
                .andExpect(jsonPath("$.endDate").value("2031-10-31"));
        assertThat(leagueSeasonRepository.findAll().stream().filter(row -> row.getLeagueId().equals(league.getId())))
                .hasSize(1);
    }

    @Test
    void putValidatesTheBody() throws Exception {
        World w = fixtures.world();
        League league = league(w);

        for (String bad : new String[] {body("2031-09-30", "2031-03-01"), body(null, "2031-03-01"), body("2031-03-01", null), "{}"}) {
            mockMvc.perform(put(DATES, w.club().getId(), league.getId(), w.season().getId()).with(fixtures.clubAdmin(w))
                            .contentType(MediaType.APPLICATION_JSON).content(bad))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void putIs409WhenAnActiveMatchWouldFallOutsideAndIgnoresInactiveOnes() throws Exception {
        World w = fixtures.world();
        League league = league(w);
        fixtures.match(w, w.seniors1(), null, on(3, 10), true, league);
        fixtures.match(w, w.seniors1(), null, on(5, 10), true, league);
        fixtures.match(w, w.seniors1(), null, on(11, 20), true, league);
        fixtures.match(w, w.seniors1(), null, on(1, 2), false, league);

        mockMvc.perform(put(DATES, w.club().getId(), league.getId(), w.season().getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(body("2031-04-01", "2031-09-30")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(
                        "2 matches of this league fall outside these dates (the earliest on 10 Mar 2031, the latest on 20 Nov 2031)."));
        assertThat(leagueSeasonRepository.findByLeagueIdAndSeasonId(league.getId(), w.season().getId())).isEmpty();

        mockMvc.perform(put(DATES, w.club().getId(), league.getId(), w.season().getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(body("2031-03-10", "2031-11-20")))
                .andExpect(status().isOk());
    }

    @Test
    void anotherClubsLeagueOrSeasonIs404AndAnOutsiderIs403() throws Exception {
        World w = fixtures.world();
        World other = fixtures.world();
        League mine = league(w);
        League theirs = league(other);

        mockMvc.perform(put(DATES, w.club().getId(), theirs.getId(), w.season().getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(body("2031-03-01", "2031-09-30")))
                .andExpect(status().isNotFound());
        mockMvc.perform(put(DATES, w.club().getId(), mine.getId(), other.season().getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(body("2031-03-01", "2031-09-30")))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(DATES, w.club().getId(), theirs.getId(), w.season().getId()).with(fixtures.clubAdmin(w)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(DATES, w.club().getId(), mine.getId(), w.season().getId()).with(fixtures.nobody()))
                .andExpect(status().isForbidden());
    }

    // --- matches honour the dates ---

    @Test
    void createRefusesAMatchOutsideTheDatesWithTheCodeAndAcceptsTheBoundaryDays() throws Exception {
        World w = fixtures.world();
        League league = league(w);
        dates(league, w, 3, 1, 9, 30);

        mockMvc.perform(post(MATCHES, w.club().getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(matchJson(w, league, on(10, 1))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MATCH_OUTSIDE_LEAGUE_DATES"))
                .andExpect(jsonPath("$.detail").value("This league runs from 1 Mar 2031 to 30 Sep 2031."));
        mockMvc.perform(post(MATCHES, w.club().getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(matchJson(w, league, on(2, 28))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(MATCHES, w.club().getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(matchJson(w, league, on(3, 1))))
                .andExpect(status().isCreated());
        mockMvc.perform(post(MATCHES, w.club().getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(matchJson(w, league, on(9, 30))))
                .andExpect(status().isCreated());
    }

    @Test
    void aLeagueWithNoDatesAndAFriendlyAreNotChecked() throws Exception {
        World w = fixtures.world();
        League undated = league(w);
        League dated = league(w);
        dates(dated, w, 3, 1, 9, 30);

        mockMvc.perform(post(MATCHES, w.club().getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(matchJson(w, undated, on(12, 25))))
                .andExpect(status().isCreated());
        mockMvc.perform(post(MATCHES, w.club().getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(matchJson(w, null, on(12, 25))))
                .andExpect(status().isCreated());
    }

    @Test
    void updateRefusesMovingAMatchOutsideAndDeactivatingStillWorks() throws Exception {
        World w = fixtures.world();
        League league = league(w);
        Match match = fixtures.match(w, w.seniors1(), null, on(5, 5), true, league);
        dates(league, w, 3, 1, 9, 30);

        mockMvc.perform(put(MATCHES + "/{matchId}", w.club().getId(), match.getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(matchJson(w, league, on(11, 5))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MATCH_OUTSIDE_LEAGUE_DATES"));
        mockMvc.perform(put(MATCHES + "/{matchId}", w.club().getId(), match.getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(matchJson(w, league, on(6, 6))))
                .andExpect(status().isOk());

        // A match left outside the dates by older data can still be deactivated, but cannot be reactivated.
        Match stray = fixtures.match(w, w.seniors1(), null, on(12, 5), true, league);
        mockMvc.perform(post(MATCHES + "/{matchId}/deactivate", w.club().getId(), stray.getId()).with(fixtures.clubAdmin(w)))
                .andExpect(status().isOk());
        mockMvc.perform(post(MATCHES + "/{matchId}/reactivate", w.club().getId(), stray.getId()).with(fixtures.clubAdmin(w)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MATCH_OUTSIDE_LEAGUE_DATES"));
        org.assertj.core.api.Assertions.assertThat(matchRepository.findById(stray.getId()).orElseThrow().isActive())
                .isFalse();

        // Inside the dates it comes back.
        Match inside = fixtures.match(w, w.seniors1(), null, on(6, 7), true, league);
        mockMvc.perform(post(MATCHES + "/{matchId}/deactivate", w.club().getId(), inside.getId()).with(fixtures.clubAdmin(w)))
                .andExpect(status().isOk());
        mockMvc.perform(post(MATCHES + "/{matchId}/reactivate", w.club().getId(), inside.getId()).with(fixtures.clubAdmin(w)))
                .andExpect(status().isOk());
    }

    // --- the age reference date ---

    @Test
    void theAgeReferenceDateTakesTheLeagueStartFromTheDatesBeforeTheFirstMatch() throws Exception {
        World w = fixtures.world();
        League league = league(w);
        fixtures.match(w, w.seniors1(), null, on(5, 5), true, league);
        dates(league, w, 3, 1, 9, 30);

        mockMvc.perform(get(AGE, w.club().getId(), league.getId(), w.season().getId()).with(fixtures.clubAdmin(w)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.leagueStart").value("2031-03-01"))
                .andExpect(jsonPath("$.leagueStartSource").value("LEAGUE_SEASON_DATES"))
                .andExpect(jsonPath("$.referenceDate").value("2031-03-01"));
    }
}
