package com.cricketlegend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.service.support.AvailabilityPollFilter;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * League and team parameters of the squad poll lists ({@code /availability-polls/open|closed}) and
 * the group round list ({@code /section-availability-rounds}) from docs/specs/083 slice 3, against a
 * real Postgres: narrowing, 404 for another club's league/team, 403 for a team outside the caller's
 * sections, and that the closed-poll cap applies after the narrowing. Not {@code @Transactional}
 * (docs/standards/backend.md), so lazy-loading and cap behaviour are those of the real server.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class AvailabilityPollListFiltersIntegrationTest {

    private static final String OPEN = "/api/v1/manage/clubs/{clubId}/availability-polls/open";
    private static final String CLOSED = "/api/v1/manage/clubs/{clubId}/availability-polls/closed";
    private static final String ROUNDS = "/api/v1/manage/clubs/{clubId}/section-availability-rounds";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    private ManagerOverviewFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private ResultActions list(JwtRequestPostProcessor caller, World w, String url, String... params) throws Exception {
        var request = get(url, w.club().getId()).with(caller);
        for (int i = 0; i < params.length; i += 2) {
            request = request.param(params[i], params[i + 1]);
        }
        return mockMvc.perform(request);
    }

    @Test
    void squadListsNarrowByLeagueAndByTeam() throws Exception {
        World w = fixtures.world();
        League league = fixtures.league(w, 11);
        Instant now = Instant.now();
        Match inLeague = fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(2)), true, league);
        fixtures.squadPoll(inLeague, w.seniors1(), null);
        fixtures.squadPoll(fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(3))), w.seniors1(), null);
        fixtures.squadPoll(fixtures.match(w, w.juniorsTeam(), null, now.plus(Duration.ofDays(4))), w.juniorsTeam(), null);
        Match closedInLeague = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(2)), true, league);
        fixtures.closeSquadPoll(fixtures.squadPoll(closedInLeague, w.seniors1(), null));
        fixtures.closeSquadPoll(fixtures.squadPoll(
                fixtures.match(w, w.juniorsTeam(), null, now.minus(Duration.ofDays(3))), w.juniorsTeam(), null));
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        String leagueId = league.getId().toString();
        String juniors = w.juniorsTeam().getId().toString();

        list(admin, w, OPEN).andExpect(jsonPath("$.length()").value(3));
        list(admin, w, OPEN, "leagueId", leagueId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].matchId").value(inLeague.getId().toString()));
        list(admin, w, OPEN, "teamId", juniors).andExpect(jsonPath("$.length()").value(1));
        list(admin, w, OPEN, "leagueId", leagueId, "teamId", juniors).andExpect(jsonPath("$.length()").value(0));
        list(admin, w, CLOSED).andExpect(jsonPath("$.length()").value(2));
        list(admin, w, CLOSED, "leagueId", leagueId)
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].matchId").value(closedInLeague.getId().toString()));
        list(admin, w, CLOSED, "teamId", juniors).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void roundListNarrowsByLeagueAndByTeamThroughActiveSlotMatches() throws Exception {
        World w = fixtures.world();
        League league = fixtures.league(w, 11);
        Instant now = Instant.now();
        Match leagueMatch = fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(2)), true, league);
        Match juniorsMatch = fixtures.match(w, w.juniorsTeam(), null, now.plus(Duration.ofDays(3)));
        Match inactive = fixtures.match(w, w.seniors2(), null, now.plus(Duration.ofDays(4)), false, league);
        SectionAvailabilityRound leagueRound = fixtures.groupPoll(w, w.seniors(), null);
        fixtures.linkMatch(leagueRound, leagueMatch);
        fixtures.linkMatch(fixtures.groupPoll(w, w.juniors(), null), juniorsMatch);
        fixtures.linkMatch(fixtures.groupPoll(w, w.seniors(), null), inactive);
        fixtures.groupPoll(w, w.seniors(), null);
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);

        list(admin, w, ROUNDS, "open", "true").andExpect(jsonPath("$.length()").value(4));
        list(admin, w, ROUNDS, "open", "true", "leagueId", league.getId().toString())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(leagueRound.getId().toString()));
        list(admin, w, ROUNDS, "open", "true", "teamId", w.juniorsTeam().getId().toString())
                .andExpect(jsonPath("$.length()").value(1));
        // a deactivated slot match satisfies no team narrowing
        list(admin, w, ROUNDS, "open", "true", "teamId", w.seniors2().getId().toString())
                .andExpect(jsonPath("$.length()").value(0));
        list(admin, w, ROUNDS, "open", "true", "sectionId", w.seniors().getId().toString(),
                        "leagueId", league.getId().toString())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void theClosedCapAppliesAfterTheLeagueNarrowing() throws Exception {
        World w = fixtures.world();
        League league = fixtures.league(w, 11);
        Instant now = Instant.now();
        Match inside = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(400)), true, league);
        fixtures.closeSquadPoll(fixtures.squadPoll(inside, w.seniors1(), null));
        for (int i = 0; i < 2; i++) {
            Match older = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(401 + i)), true, league);
            fixtures.closeSquadPoll(fixtures.squadPoll(older, w.seniors1(), null));
        }
        // 3 older closed rounds inside the league first, then newer ones outside it
        for (int i = 0; i < 3; i++) {
            SectionAvailabilityRound round = fixtures.groupPoll(w, w.seniors(), null);
            // a match belongs to at most one window
            fixtures.linkMatch(round, fixtures.match(w, w.seniors2(), null, now.minus(Duration.ofDays(500)), true, league));
            fixtures.closeGroupPoll(round);
        }
        for (int i = 0; i < AvailabilityPollFilter.CLOSED_POLLS_LIMIT + 5; i++) {
            Match m = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(1)));
            fixtures.closeSquadPoll(fixtures.squadPoll(m, w.seniors1(), null));
            Match m2 = fixtures.match(w, w.seniors2(), null, now.minus(Duration.ofDays(1)));
            SectionAvailabilityRound round = fixtures.groupPoll(w, w.seniors(), null);
            fixtures.linkMatch(round, m2);
            fixtures.closeGroupPoll(round);
        }
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        String leagueId = league.getId().toString();

        list(admin, w, CLOSED).andExpect(jsonPath("$.length()").value(AvailabilityPollFilter.CLOSED_POLLS_LIMIT));
        list(admin, w, CLOSED, "leagueId", leagueId).andExpect(jsonPath("$.length()").value(3));
        list(admin, w, ROUNDS, "open", "false").andExpect(jsonPath("$.length()").value(AvailabilityPollFilter.CLOSED_POLLS_LIMIT));
        list(admin, w, ROUNDS, "open", "false", "leagueId", leagueId).andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    void aLeagueOrTeamOfAnotherClubIsNotFoundOnEveryList() throws Exception {
        World w = fixtures.world();
        World other = fixtures.world();
        League foreign = fixtures.league(other, 11);
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);

        for (String url : new String[] {OPEN, CLOSED, ROUNDS}) {
            list(admin, w, url, "leagueId", foreign.getId().toString()).andExpect(status().isNotFound());
            list(admin, w, url, "teamId", other.seniors1().getId().toString()).andExpect(status().isNotFound());
            list(admin, w, url, "leagueId", UUID.randomUUID().toString()).andExpect(status().isNotFound());
        }
    }

    @Test
    void aTeamOutsideTheCallersSectionsIsForbiddenAndPlainListsStillWork() throws Exception {
        World w = fixtures.world();
        JwtRequestPostProcessor juniorsManager = fixtures.sectionManager(w.juniors());

        for (String url : new String[] {OPEN, CLOSED, ROUNDS}) {
            list(juniorsManager, w, url, "teamId", w.seniors1().getId().toString()).andExpect(status().isForbidden());
            list(juniorsManager, w, url).andExpect(status().isOk());
        }
        list(fixtures.clubAdmin(fixtures.world()), w, OPEN, "leagueId", UUID.randomUUID().toString())
                .andExpect(status().isForbidden());
    }
}
