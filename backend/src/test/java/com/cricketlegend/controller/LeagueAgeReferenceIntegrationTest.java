package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchRepository.LeagueSeasonFirstMatch;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * docs/specs/110-league-age-cutoff-day-and-month.md against real Postgres: the first-match query, the
 * {@code .../age-reference-date} endpoint, and the three age rules of the Problem section through the team selection
 * overview (the batch path). Deliberately not {@code @Transactional}; {@link ManagerOverviewFixtures} removes what it
 * seeds. The season of {@link ManagerOverviewFixtures#world()} starts on 1 January 2031.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class LeagueAgeReferenceIntegrationTest {

    private static final String URL = "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/age-reference-date";
    private static final String HUB = "/api/v1/manage/clubs/{clubId}/team-selection";
    private static final ZoneId ZONE = ZoneId.systemDefault();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private LeagueRepository leagueRepository;

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

    private static Instant on(int year, int month, int day) {
        return LocalDate.of(year, month, day).atTime(10, 0).atZone(ZONE).toInstant();
    }

    private League league(World w, String name, Integer maxAge, Integer month, Integer day) {
        return leagueRepository.save(League.builder().clubId(w.club().getId()).name(name).source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11).maxAge(maxAge).ageCutoffMonth(month).ageCutoffDay(day).active(true).build());
    }

    // --- the first-match query ---

    @Test
    void theFirstMatchQueryCountsOnlyActiveMatchesPerLeagueAndSeason() {
        World w = fixtures.world();
        League one = league(w, "One", null, null, null);
        League two = league(w, "Two", null, null, null);
        fixtures.match(w, w.seniors1(), null, on(2031, 3, 1), false, one);
        fixtures.match(w, w.seniors1(), null, on(2031, 9, 5), true, one);
        fixtures.match(w, w.seniors1(), null, on(2031, 11, 5), true, one);
        fixtures.match(w, w.seniors1(), null, on(2031, 5, 5), true, null);
        fixtures.match(w, w.seniors1(), null, on(2031, 2, 5), false, two);

        List<LeagueSeasonFirstMatch> rows = matchRepository.findFirstMatchDates(
                Set.of(one.getId(), two.getId()), Set.of(w.season().getId()));

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getLeagueId()).isEqualTo(one.getId());
        assertThat(rows.get(0).getFirstMatchDate()).isEqualTo(on(2031, 9, 5));
    }

    // --- the endpoint ---

    @Test
    void aCutoffLeagueReportsTheCutoffInTheYearOfItsFirstActiveMatch() throws Exception {
        World w = fixtures.world();
        League club = league(w, "Club league", 13, 12, 31);
        fixtures.match(w, w.seniors1(), null, on(2031, 3, 1), false, club);
        fixtures.match(w, w.seniors1(), null, on(2031, 9, 5), true, club);

        mockMvc.perform(get(URL, w.club().getId(), club.getId(), w.season().getId()).with(fixtures.clubAdmin(w)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.referenceDate").value("2031-12-31"))
                .andExpect(jsonPath("$.source").value("CUTOFF"))
                .andExpect(jsonPath("$.leagueStart").value("2031-09-05"))
                .andExpect(jsonPath("$.leagueStartSource").value("FIRST_MATCH"));
    }

    @Test
    void aLeagueWithNoCutoffReportsItsFirstMatchDay() throws Exception {
        World w = fixtures.world();
        League winter = league(w, "Winter", 13, null, null);
        fixtures.match(w, w.seniors1(), null, on(2031, 7, 10), true, winter);

        mockMvc.perform(get(URL, w.club().getId(), winter.getId(), w.season().getId()).with(fixtures.clubAdmin(w)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.referenceDate").value("2031-07-10"))
                .andExpect(jsonPath("$.source").value("LEAGUE_START"))
                .andExpect(jsonPath("$.leagueStart").value("2031-07-10"))
                .andExpect(jsonPath("$.leagueStartSource").value("FIRST_MATCH"));
    }

    @Test
    void aLeagueWithNoMatchesFallsBackToTheSeasonStart() throws Exception {
        World w = fixtures.world();
        League empty = league(w, "Empty", 13, null, null);

        mockMvc.perform(get(URL, w.club().getId(), empty.getId(), w.season().getId()).with(fixtures.clubAdmin(w)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.referenceDate").value("2031-01-01"))
                .andExpect(jsonPath("$.source").value("LEAGUE_START"))
                .andExpect(jsonPath("$.leagueStartSource").value("SEASON_START"));
    }

    @Test
    void anotherClubsLeagueOrSeasonIs404() throws Exception {
        World w = fixtures.world();
        World other = fixtures.world();
        League mine = league(w, "Mine", 13, 12, 31);
        League theirs = league(other, "Theirs", 13, 12, 31);

        mockMvc.perform(get(URL, w.club().getId(), theirs.getId(), w.season().getId()).with(fixtures.clubAdmin(w)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(URL, w.club().getId(), mine.getId(), other.season().getId()).with(fixtures.clubAdmin(w)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(URL, w.club().getId(), mine.getId(), w.season().getId()).with(fixtures.nobody()))
                .andExpect(status().isForbidden());
    }

    // --- the three rules, through the team selection overview ---

    private String reason(String body, PlayerProfile player, Match match, UUID teamId) {
        List<Object> found = JsonPath.read(body, "$.players[?(@.playerId=='" + player.getId() + "')].cells[?(@.matchId=='"
                + match.getId() + "' && @.teamId=='" + teamId + "')].reasonCode");
        assertThat(found).hasSize(1);
        return String.valueOf(found.get(0));
    }

    @Test
    void theThreeAgeRulesGiveTheEligibilityTheUserDescribed() throws Exception {
        World w = fixtures.world();
        UUID team = w.seniors1().getId();
        // Rule 1: a club league from September, ages as at 31 December 2031; the limit is 13.
        League clubLeague = league(w, "Club league", 13, 12, 31);
        Match septemberMatch = fixtures.match(w, w.seniors1(), null, on(2031, 9, 5), true, clubLeague);
        Match februaryMatch = fixtures.match(w, w.seniors1(), null, on(2032, 2, 14), true, clubLeague);
        // Rule 2: a winter league with no cut-off, judged on its first match day, 10 July 2031.
        League winter = league(w, "Winter league", 13, null, null);
        Match winterMatch = fixtures.match(w, w.seniors1(), null, on(2031, 7, 10), true, winter);
        // Rule 3: a cup starting in 2032, ages as at 31 December 2032.
        League cup = league(w, "Cup", 13, 12, 31);
        Match cupMatch = fixtures.match(w, w.seniors1(), null, on(2032, 3, 1), true, cup);

        // 13 on 31 December 2031, turns 14 on 1 January 2032.
        PlayerProfile turnsFourteenInTheNewYear = fixtures.rosterPlayerBorn(w, w.seniors1(), "Ann", LocalDate.of(2018, 1, 1));
        // 13 until the day after the winter league starts, 14 the day before.
        PlayerProfile fourteenOnTheWinterStart = fixtures.rosterPlayerBorn(w, w.seniors1(), "Bob", LocalDate.of(2017, 7, 10));
        PlayerProfile thirteenOnTheWinterStart = fixtures.rosterPlayerBorn(w, w.seniors1(), "Cat", LocalDate.of(2017, 7, 11));
        // already 14 on 31 December 2031
        PlayerProfile fourteenInTheClubYear = fixtures.rosterPlayerBorn(w, w.seniors1(), "Dan", LocalDate.of(2017, 12, 31));

        String body = mockMvc.perform(get(HUB, w.club().getId()).with(fixtures.clubAdmin(w)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        // rule 1: eligible all season, in September and after turning 14 in the new year
        assertThat(reason(body, turnsFourteenInTheNewYear, septemberMatch, team)).isEqualTo("null");
        assertThat(reason(body, turnsFourteenInTheNewYear, februaryMatch, team)).isEqualTo("null");
        assertThat(reason(body, fourteenInTheClubYear, septemberMatch, team)).isEqualTo("AGE_INELIGIBLE");
        // rule 2: judged on the first match day
        assertThat(reason(body, thirteenOnTheWinterStart, winterMatch, team)).isEqualTo("null");
        assertThat(reason(body, fourteenOnTheWinterStart, winterMatch, team)).isEqualTo("AGE_INELIGIBLE");
        // rule 3: the same player is too old for a cup judged on 31 December 2032
        assertThat(reason(body, turnsFourteenInTheNewYear, cupMatch, team)).isEqualTo("AGE_INELIGIBLE");
    }
}
