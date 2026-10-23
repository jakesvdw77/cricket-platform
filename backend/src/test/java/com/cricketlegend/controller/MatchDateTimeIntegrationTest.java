package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import java.sql.Timestamp;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * docs/specs/118-result-review-fixes.md: {@code PATCH .../matches/{matchId}/date-time} against real Postgres: it changes
 * only the match date (also while a result is published), honours the league season dates of spec 111, and has the same
 * access rule as match edit. Deliberately not {@code @Transactional}; the fixtures remove what they seed. The world's
 * season is calendar 2031; the league runs 1 Mar 2031 to 30 Sep 2031 here.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MatchDateTimeIntegrationTest {

    private static final String URL = "/api/v1/manage/clubs/{clubId}/matches/{matchId}/date-time";
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

    @Autowired
    private JdbcTemplate jdbc;

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

    private static String body(Instant when) {
        return "{\"matchDate\":\"" + when + "\"}";
    }

    private League datedLeague(World w) {
        League league = leagueRepository.save(League.builder().clubId(w.club().getId()).name("L-" + UUID.randomUUID())
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build());
        leagueSeasonRepository.save(LeagueSeason.builder().leagueId(league.getId()).seasonId(w.season().getId())
                .startDate(LocalDate.of(2031, 3, 1)).endDate(LocalDate.of(2031, 9, 30)).build());
        return league;
    }

    private void result(Match match, UUID clubId, String status) {
        jdbc.update("insert into match_result (id, club_id, match_id, status, detail_level, outcome_type, winning_side,"
                        + " balls_per_over, published_at) values (?, ?, ?, ?, 'FULL', 'WON', 'HOME', 6, ?)",
                UUID.randomUUID(), clubId, match.getId(), status,
                "PUBLISHED".equals(status) ? Timestamp.from(Instant.now()) : null);
    }

    @Test
    void changesOnlyTheMatchDateAndReturnsTheMatch() throws Exception {
        World w = fixtures.world();
        League league = datedLeague(w);
        Match match = fixtures.match(w, w.seniors1(), w.seniors2(), on(5, 5), true, league);
        match.setHomeTeamLogoUrl("https://logo/home.png");
        match.setVenue("Newlands");
        matchRepository.save(match);

        mockMvc.perform(patch(URL, w.club().getId(), match.getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(body(on(6, 6))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(match.getId().toString()))
                .andExpect(jsonPath("$.matchDate").value(on(6, 6).toString()));

        Match after = matchRepository.findById(match.getId()).orElseThrow();
        assertThat(after.getMatchDate()).isEqualTo(on(6, 6));
        assertThat(after.getHomeTeamId()).isEqualTo(w.seniors1().getId());
        assertThat(after.getAwayTeamId()).isEqualTo(w.seniors2().getId());
        assertThat(after.getLeagueId()).isEqualTo(league.getId());
        assertThat(after.getSeasonId()).isEqualTo(w.season().getId());
        assertThat(after.getVenue()).isEqualTo("Newlands");
        assertThat(after.getHomeTeamLogoUrl()).isEqualTo("https://logo/home.png");
        assertThat(after.isActive()).isTrue();
    }

    @Test
    void worksOnAMatchWithADraftAndWithAPublishedResult() throws Exception {
        World w = fixtures.world();
        Match draft = fixtures.match(w, w.seniors1(), null, on(5, 5));
        Match published = fixtures.match(w, w.seniors1(), null, on(5, 6));
        result(draft, w.club().getId(), "DRAFT");
        result(published, w.club().getId(), "PUBLISHED");

        mockMvc.perform(patch(URL, w.club().getId(), draft.getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(body(on(7, 7))))
                .andExpect(status().isOk());
        mockMvc.perform(patch(URL, w.club().getId(), published.getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(body(on(7, 8))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchDate").value(on(7, 8).toString()));

        assertThat(matchRepository.findById(published.getId()).orElseThrow().getMatchDate()).isEqualTo(on(7, 8));
        assertThat(jdbc.queryForObject("select status from match_result where match_id = ?", String.class,
                published.getId())).isEqualTo("PUBLISHED");
    }

    @Test
    void aDateOutsideTheLeagueSeasonDatesIs400WithTheCodeAndNothingChangesBoundaryDaysPass() throws Exception {
        World w = fixtures.world();
        League league = datedLeague(w);
        Match match = fixtures.match(w, w.seniors1(), null, on(5, 5), true, league);

        mockMvc.perform(patch(URL, w.club().getId(), match.getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(body(on(10, 1))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MATCH_OUTSIDE_LEAGUE_DATES"));
        assertThat(matchRepository.findById(match.getId()).orElseThrow().getMatchDate()).isEqualTo(on(5, 5));

        mockMvc.perform(patch(URL, w.club().getId(), match.getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(body(on(9, 30))))
                .andExpect(status().isOk());
        mockMvc.perform(patch(URL, w.club().getId(), match.getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(body(on(3, 1))))
                .andExpect(status().isOk());
    }

    @Test
    void aFriendlyAcceptsAnyDate() throws Exception {
        World w = fixtures.world();
        Match friendly = fixtures.match(w, w.seniors1(), null, on(5, 5));

        mockMvc.perform(patch(URL, w.club().getId(), friendly.getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(body(on(12, 25))))
                .andExpect(status().isOk());
    }

    @Test
    void aMissingOrNullMatchDateIs400() throws Exception {
        World w = fixtures.world();
        Match match = fixtures.match(w, w.seniors1(), null, on(5, 5));

        for (String payload : new String[] {"{}", "{\"matchDate\":null}"}) {
            mockMvc.perform(patch(URL, w.club().getId(), match.getId()).with(fixtures.clubAdmin(w))
                            .contentType(MediaType.APPLICATION_JSON).content(payload))
                    .andExpect(status().isBadRequest());
        }
        assertThat(matchRepository.findById(match.getId()).orElseThrow().getMatchDate()).isEqualTo(on(5, 5));
    }

    @Test
    void aSectionManagerOutsideTheMatchsSectionIs403AndOneInsideItSucceeds() throws Exception {
        World w = fixtures.world();
        Match seniors = fixtures.match(w, w.seniors1(), null, on(5, 5));

        mockMvc.perform(patch(URL, w.club().getId(), seniors.getId()).with(fixtures.sectionManager(w.juniors()))
                        .contentType(MediaType.APPLICATION_JSON).content(body(on(6, 6))))
                .andExpect(status().isForbidden());
        assertThat(matchRepository.findById(seniors.getId()).orElseThrow().getMatchDate()).isEqualTo(on(5, 5));

        mockMvc.perform(patch(URL, w.club().getId(), seniors.getId()).with(fixtures.sectionManager(w.seniors()))
                        .contentType(MediaType.APPLICATION_JSON).content(body(on(6, 6))))
                .andExpect(status().isOk());
    }

    @Test
    void anUnknownOrOtherClubsMatchIs404() throws Exception {
        World w = fixtures.world();
        World other = fixtures.world();
        Match theirs = fixtures.match(other, other.seniors1(), null, on(5, 5));

        mockMvc.perform(patch(URL, w.club().getId(), theirs.getId()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(body(on(6, 6))))
                .andExpect(status().isNotFound());
        mockMvc.perform(patch(URL, w.club().getId(), UUID.randomUUID()).with(fixtures.clubAdmin(w))
                        .contentType(MediaType.APPLICATION_JSON).content(body(on(6, 6))))
                .andExpect(status().isNotFound());
        assertThat(matchRepository.findById(theirs.getId()).orElseThrow().getMatchDate()).isEqualTo(on(5, 5));
    }

    @Test
    void anonymousIs401AndAnAdminOfAnotherClubOrNobodyIs403() throws Exception {
        World w = fixtures.world();
        World other = fixtures.world();
        Match match = fixtures.match(w, w.seniors1(), null, on(5, 5));

        mockMvc.perform(patch(URL, w.club().getId(), match.getId())
                        .contentType(MediaType.APPLICATION_JSON).content(body(on(6, 6))))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(patch(URL, w.club().getId(), match.getId()).with(fixtures.clubAdmin(other))
                        .contentType(MediaType.APPLICATION_JSON).content(body(on(6, 6))))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch(URL, w.club().getId(), match.getId()).with(fixtures.nobody())
                        .contentType(MediaType.APPLICATION_JSON).content(body(on(6, 6))))
                .andExpect(status().isForbidden());
        assertThat(matchRepository.findById(match.getId()).orElseThrow().getMatchDate()).isEqualTo(on(5, 5));
    }
}
