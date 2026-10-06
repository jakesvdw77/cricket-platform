package com.cricketlegend.controller;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.service.support.ServerClock;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import java.time.Duration;
import java.time.Instant;
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
 * Integration test for {@code GET /api/v1/manage/clubs/{clubId}/overview}
 * (docs/specs/079-manager-shell-and-overview.md) against a real Postgres: the response shape and
 * numbers for a club admin (week window edges, inactive and past matches left out, announced and
 * selected counts, squad and group polls), a section manager's narrower totals, 403 for another
 * club's manager and for a person with no role, and that another club's data never appears.
 * Deliberately NOT {@code @Transactional} (docs/standards/backend.md): the service's own read-only
 * transaction must be enough to map the response. The statement-count guard lives in {@code
 * ManagerOverviewQueryCountIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class ManagerOverviewControllerIntegrationTest {

    private static final String OVERVIEW = "/api/v1/manage/clubs/{clubId}/overview";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    private ManagerOverviewFixtures fixtures;
    private Instant today;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
        today = ServerClock.startOfToday();
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    /**
     * The club the numbers below are asserted against: three matches this week (one exactly at the
     * start of today, one a derby of two own sections, one in a league of 11 places), one exactly
     * seven days out (not this week), one inactive and one yesterday (never counted); a squad poll
     * (1 of 3 answered), a group poll (1 of 2 answered), six active players.
     */
    private Seeded seed() {
        World w = fixtures.world();
        PlayerProfile ann = fixtures.player(w, "Ann", true);
        PlayerProfile bob = fixtures.player(w, "Bob", true);
        PlayerProfile zed = fixtures.player(w, "Zed", false);
        fixtures.tag(w.seniors(), ann);
        fixtures.tag(w.seniors(), bob);
        fixtures.tag(w.seniors(), zed);
        PlayerProfile j1 = fixtures.rosterPlayer(w, w.juniorsTeam(), "Jay");
        PlayerProfile j2 = fixtures.rosterPlayer(w, w.juniorsTeam(), "Jo");
        PlayerProfile j3 = fixtures.rosterPlayer(w, w.juniorsTeam(), "Jem");
        fixtures.tag(w.juniors(), j1);
        fixtures.tag(w.juniors(), j2);
        fixtures.tag(w.juniors(), j3);
        fixtures.player(w, "Untagged", true);

        Match m1 = fixtures.match(w, w.seniors1(), null, today);
        fixtures.side(m1, w.seniors1(), true, ann, bob);
        Match m2 = fixtures.match(w, w.juniorsTeam(), w.seniors2(), today.plus(Duration.ofHours(2 * 24 + 14)));
        League league = fixtures.league(w, 11);
        Match m6 = fixtures.match(w, w.seniors2(), null, today.plus(Duration.ofDays(3)), true, league);
        fixtures.side(m6, w.seniors2(), false, bob);
        Match m3 = fixtures.match(w, w.seniors1(), null, ServerClock.startOfDayFromToday(7));
        fixtures.match(w, w.seniors1(), null, today.plus(Duration.ofDays(1)), false, null);
        fixtures.match(w, w.seniors1(), null, today.minus(Duration.ofDays(1)));

        MatchAvailabilityPoll squad = fixtures.squadPoll(m2, w.juniorsTeam(), today.plus(Duration.ofDays(1)), j1);
        SectionAvailabilityRound group = fixtures.groupPoll(w, w.seniors(), today.plus(Duration.ofDays(2)), ann);
        return new Seeded(w, m1, m2, m6, m3, squad, group);
    }

    private record Seeded(World w, Match m1, Match m2, Match m6, Match m3, MatchAvailabilityPoll squad,
            SectionAvailabilityRound group) {
    }

    private ResultActions overview(JwtRequestPostProcessor caller, World w) throws Exception {
        return mockMvc.perform(get(OVERVIEW, w.club().getId()).with(caller));
    }

    @Test
    void clubAdminGetsTheWholeClubsOverview() throws Exception {
        Seeded s = seed();
        World other = fixtures.world();
        fixtures.match(other, other.seniors1(), null, today.plus(Duration.ofDays(1)));
        fixtures.player(other, "Elsewhere", true);

        overview(fixtures.clubAdmin(s.w()), s.w())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchesThisWeek").value(3))
                .andExpect(jsonPath("$.teamsNotAnnounced").value(3))
                .andExpect(jsonPath("$.pollAnswersAwaited").value(3))
                .andExpect(jsonPath("$.activePlayers").value(6))
                .andExpect(jsonPath("$.recentResults", hasSize(0)))
                .andExpect(jsonPath("$.quickActions.createMatch").value(true))
                .andExpect(jsonPath("$.quickActions.createPoll").value(true))
                .andExpect(jsonPath("$.quickActions.addPlayer").value(true))
                .andExpect(jsonPath("$.quickActions.messageSquad").value(true))
                .andExpect(jsonPath("$.upcomingMatches", hasSize(4)))
                .andExpect(jsonPath("$.upcomingMatches[*].matchId", contains(
                        s.m1().getId().toString(), s.m2().getId().toString(), s.m6().getId().toString(),
                        s.m3().getId().toString())))
                // m1: home own team, free-text away, announced with two selected
                .andExpect(jsonPath("$.upcomingMatches[0].homeTeamName").value("Villagers 1"))
                .andExpect(jsonPath("$.upcomingMatches[0].awayTeamId").value(nullValue()))
                .andExpect(jsonPath("$.upcomingMatches[0].awayTeamName").value("Occasionals"))
                .andExpect(jsonPath("$.upcomingMatches[0].venue").value("Ground"))
                .andExpect(jsonPath("$.upcomingMatches[0].sectionId").value(s.w().seniors().getId().toString()))
                .andExpect(jsonPath("$.upcomingMatches[0].ownSides", hasSize(1)))
                .andExpect(jsonPath("$.upcomingMatches[0].ownSides[0].selectedCount").value(2))
                .andExpect(jsonPath("$.upcomingMatches[0].ownSides[0].maxSelected").value(12))
                .andExpect(jsonPath("$.upcomingMatches[0].ownSides[0].announced").value(true))
                // m2: a derby of two own sections, no side rows yet
                .andExpect(jsonPath("$.upcomingMatches[1].ownSides", hasSize(2)))
                .andExpect(jsonPath("$.upcomingMatches[1].ownSides[0].teamName").value("U15 A"))
                .andExpect(jsonPath("$.upcomingMatches[1].ownSides[0].selectedCount").value(0))
                .andExpect(jsonPath("$.upcomingMatches[1].ownSides[0].announced").value(false))
                // m6: league of 11 places, one selected, not announced
                .andExpect(jsonPath("$.upcomingMatches[2].ownSides[0].selectedCount").value(1))
                .andExpect(jsonPath("$.upcomingMatches[2].ownSides[0].maxSelected").value(11))
                .andExpect(jsonPath("$.openPolls", hasSize(2)))
                .andExpect(jsonPath("$.openPolls[0].kind").value("SQUAD"))
                .andExpect(jsonPath("$.openPolls[0].id").value(s.squad().getId().toString()))
                .andExpect(jsonPath("$.openPolls[0].matchId").value(s.m2().getId().toString()))
                .andExpect(jsonPath("$.openPolls[0].title").value(org.hamcrest.Matchers.startsWith("U15 A v Villagers 2")))
                .andExpect(jsonPath("$.openPolls[0].repliedCount").value(1))
                .andExpect(jsonPath("$.openPolls[0].totalCount").value(3))
                .andExpect(jsonPath("$.openPolls[0].scheduledCloseAt").exists())
                .andExpect(jsonPath("$.openPolls[1].kind").value("GROUP"))
                .andExpect(jsonPath("$.openPolls[1].id").value(s.group().getId().toString()))
                .andExpect(jsonPath("$.openPolls[1].matchId").value(nullValue()))
                .andExpect(jsonPath("$.openPolls[1].title").value("Weekend Seniors"))
                .andExpect(jsonPath("$.openPolls[1].repliedCount").value(1))
                .andExpect(jsonPath("$.openPolls[1].totalCount").value(2));
    }

    @Test
    void sectionManagerSeesOnlyTheirSectionsFigures() throws Exception {
        Seeded s = seed();

        overview(fixtures.sectionManager(s.w().juniors()), s.w())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchesThisWeek").value(1))
                .andExpect(jsonPath("$.teamsNotAnnounced").value(1))
                .andExpect(jsonPath("$.activePlayers").value(3))
                .andExpect(jsonPath("$.pollAnswersAwaited").value(2))
                .andExpect(jsonPath("$.upcomingMatches", hasSize(1)))
                .andExpect(jsonPath("$.upcomingMatches[0].matchId").value(s.m2().getId().toString()))
                .andExpect(jsonPath("$.upcomingMatches[0].sectionId").value(s.w().juniors().getId().toString()))
                .andExpect(jsonPath("$.upcomingMatches[0].ownSides", hasSize(1)))
                .andExpect(jsonPath("$.upcomingMatches[0].ownSides[0].teamName").value("U15 A"))
                .andExpect(jsonPath("$.openPolls", hasSize(1)))
                .andExpect(jsonPath("$.openPolls[0].kind").value("SQUAD"))
                .andExpect(jsonPath("$.quickActions.createMatch").value(true));

        overview(fixtures.sectionManager(s.w().seniors()), s.w())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchesThisWeek").value(3))
                .andExpect(jsonPath("$.teamsNotAnnounced").value(2))
                .andExpect(jsonPath("$.activePlayers").value(2))
                .andExpect(jsonPath("$.upcomingMatches[1].ownSides", hasSize(1)))
                .andExpect(jsonPath("$.upcomingMatches[1].ownSides[0].teamName").value("Villagers 2"));
    }

    @Test
    void anotherClubsManagerAndAPersonWithoutARoleAreForbidden() throws Exception {
        Seeded s = seed();
        World other = fixtures.world();

        overview(fixtures.clubAdmin(other), s.w()).andExpect(status().isForbidden());
        overview(fixtures.sectionManager(other.seniors()), s.w()).andExpect(status().isForbidden());
        overview(fixtures.nobody(), s.w()).andExpect(status().isForbidden());
        mockMvc.perform(get(OVERVIEW, s.w().club().getId())).andExpect(status().isUnauthorized());
    }

    @Test
    void emptyClubGivesZerosAndEmptyLists() throws Exception {
        World w = fixtures.world();

        overview(fixtures.clubAdmin(w), w)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchesThisWeek").value(0))
                .andExpect(jsonPath("$.teamsNotAnnounced").value(0))
                .andExpect(jsonPath("$.pollAnswersAwaited").value(0))
                .andExpect(jsonPath("$.activePlayers").value(0))
                .andExpect(jsonPath("$.upcomingMatches", hasSize(0)))
                .andExpect(jsonPath("$.openPolls", hasSize(0)))
                .andExpect(jsonPath("$.recentResults", hasSize(0)));
    }

    @Test
    void upcomingMatchesAreCappedAtFiveAndOpenPollsAtFive() throws Exception {
        World w = fixtures.world();
        for (int day = 0; day < 7; day++) {
            Match match = fixtures.match(w, w.seniors1(), null, today.plus(Duration.ofDays(day)).plusSeconds(60));
            fixtures.squadPoll(match, w.seniors1(), today.plus(Duration.ofDays(day)));
        }

        overview(fixtures.clubAdmin(w), w)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matchesThisWeek").value(7))
                .andExpect(jsonPath("$.upcomingMatches", hasSize(5)))
                .andExpect(jsonPath("$.openPolls", hasSize(5)));
    }
}
