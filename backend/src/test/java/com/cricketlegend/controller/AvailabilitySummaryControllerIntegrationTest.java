package com.cricketlegend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Team;
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
 * Integration test for {@code GET /api/v1/manage/clubs/{clubId}/availability/summary}
 * (docs/specs/081-plain-page-header-and-counters.md, filters per docs/specs/083) against a real Postgres: the response shape and
 * figures for a club admin, a section manager's narrower totals, 403 for another club's admin and a
 * person with no role, zeros for an empty club, and that another club's polls never count.
 * Deliberately NOT {@code @Transactional} (docs/standards/backend.md). The statement-count guard
 * lives in {@code AvailabilitySummaryQueryCountIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class AvailabilitySummaryControllerIntegrationTest {

    private static final String SUMMARY = "/api/v1/manage/clubs/{clubId}/availability/summary";

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

    /**
     * Seniors squad poll (squad of 2, one answered, closes in 1 day), Juniors squad poll (squad of 3,
     * one answered, closes in 5 days) and a Seniors group poll (2 tagged, one answered, closes in 10
     * hours). Distinct players: 2 + 3 + 2 asked, 3 answered.
     */
    private World seed() {
        World w = fixtures.world();
        Instant now = Instant.now();
        PlayerProfile r1 = fixtures.rosterPlayer(w, w.seniors1(), "R1");
        fixtures.rosterPlayer(w, w.seniors1(), "R2");
        PlayerProfile j1 = fixtures.rosterPlayer(w, w.juniorsTeam(), "J1");
        fixtures.rosterPlayer(w, w.juniorsTeam(), "J2");
        fixtures.rosterPlayer(w, w.juniorsTeam(), "J3");
        PlayerProfile ann = fixtures.player(w, "Ann", true);
        PlayerProfile bob = fixtures.player(w, "Bob", true);
        fixtures.tag(w.seniors(), ann);
        fixtures.tag(w.seniors(), bob);

        Match seniorsMatch = fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(3)));
        fixtures.squadPoll(seniorsMatch, w.seniors1(), now.plus(Duration.ofDays(1)), r1);
        Match juniorsMatch = fixtures.match(w, w.juniorsTeam(), null, now.plus(Duration.ofDays(6)));
        fixtures.squadPoll(juniorsMatch, w.juniorsTeam(), now.plus(Duration.ofDays(5)), j1);
        fixtures.groupPoll(w, w.seniors(), now.plus(Duration.ofHours(10)), ann);
        return w;
    }

    private ResultActions summary(JwtRequestPostProcessor caller, World w) throws Exception {
        return mockMvc.perform(get(SUMMARY, w.club().getId()).with(caller));
    }

    private ResultActions summary(JwtRequestPostProcessor caller, World w, String... paramPairs) throws Exception {
        var request = get(SUMMARY, w.club().getId()).with(caller);
        for (int i = 0; i < paramPairs.length; i += 2) {
            request = request.param(paramPairs[i], paramPairs[i + 1]);
        }
        return mockMvc.perform(request);
    }

    /**
     * Over {@link #seed()}: a league with a Seniors match (squad poll for seniors1 answered by R1)
     * and a Seniors group poll slot-linked to a second league match of seniors2, plus a closed
     * juniors squad poll and a closed seniors group poll.
     */
    private record Leagued(World w, League league, Team team) {
    }

    private Leagued seedLeague() {
        World w = seed();
        Instant now = Instant.now();
        League league = fixtures.league(w, 11);
        fixtures.rosterPlayer(w, w.seniors2(), "S2A");
        Match leagueMatch = fixtures.match(w, w.seniors2(), null, now.plus(Duration.ofDays(8)), true, league);
        MatchAvailabilityPoll squad = fixtures.squadPoll(leagueMatch, w.seniors2(), now.plus(Duration.ofDays(3)));
        SectionAvailabilityRound group = fixtures.groupPoll(w, w.seniors(), now.plus(Duration.ofDays(4)));
        fixtures.linkMatch(group, leagueMatch);
        Match juniorsMatch = fixtures.match(w, w.juniorsTeam(), null, now.minus(Duration.ofDays(9)));
        MatchAvailabilityPoll closedSquad = fixtures.squadPoll(juniorsMatch, w.juniorsTeam(), null);
        fixtures.closeSquadPoll(closedSquad);
        return new Leagued(w, league, w.seniors2());
    }

    @Test
    void clubAdminGetsTheWholeClubsCounters() throws Exception {
        World w = seed();
        World other = fixtures.world();
        fixtures.squadPoll(
                fixtures.match(other, other.seniors1(), null, Instant.now().plus(Duration.ofDays(1))),
                other.seniors1(), Instant.now().plus(Duration.ofHours(1)),
                fixtures.rosterPlayer(other, other.seniors1(), "Elsewhere"));

        summary(fixtures.clubAdmin(w), w)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openPolls").value(3))
                .andExpect(jsonPath("$.playersInAudience").value(7))
                .andExpect(jsonPath("$.playersResponded").value(3))
                .andExpect(jsonPath("$.playersStillToAnswer").value(4))
                .andExpect(jsonPath("$.closingSoon").value(2));
    }

    @Test
    void sectionManagerSeesOnlyTheirSectionsCounters() throws Exception {
        World w = seed();

        summary(fixtures.sectionManager(w.juniors()), w)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openPolls").value(1))
                .andExpect(jsonPath("$.playersInAudience").value(3))
                .andExpect(jsonPath("$.playersResponded").value(1))
                .andExpect(jsonPath("$.playersStillToAnswer").value(2))
                .andExpect(jsonPath("$.closingSoon").value(0));

        summary(fixtures.sectionManager(w.seniors()), w)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openPolls").value(2))
                .andExpect(jsonPath("$.playersInAudience").value(4))
                .andExpect(jsonPath("$.playersResponded").value(2))
                .andExpect(jsonPath("$.playersStillToAnswer").value(2))
                .andExpect(jsonPath("$.closingSoon").value(2));
    }

    @Test
    void anotherClubsAdminAndAPersonWithoutARoleAreForbidden() throws Exception {
        World w = seed();
        World other = fixtures.world();

        summary(fixtures.clubAdmin(other), w).andExpect(status().isForbidden());
        summary(fixtures.sectionManager(other.seniors()), w).andExpect(status().isForbidden());
        summary(fixtures.nobody(), w).andExpect(status().isForbidden());
        mockMvc.perform(get(SUMMARY, w.club().getId())).andExpect(status().isUnauthorized());
    }

    @Test
    void emptyClubGivesZeros() throws Exception {
        World w = fixtures.world();

        summary(fixtures.clubAdmin(w), w)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openPolls").value(0))
                .andExpect(jsonPath("$.playersResponded").value(0))
                .andExpect(jsonPath("$.playersInAudience").value(0))
                .andExpect(jsonPath("$.playersStillToAnswer").value(0))
                .andExpect(jsonPath("$.closingSoon").value(0));
    }

    @Test
    void typeNarrowsToSquadOrGroupPolls() throws Exception {
        World w = seed();

        summary(fixtures.clubAdmin(w), w, "type", "SQUAD")
                .andExpect(jsonPath("$.openPolls").value(2))
                .andExpect(jsonPath("$.playersInAudience").value(5))
                .andExpect(jsonPath("$.playersResponded").value(2))
                .andExpect(jsonPath("$.playersStillToAnswer").value(3))
                .andExpect(jsonPath("$.closingSoon").value(1));
        summary(fixtures.clubAdmin(w), w, "type", "GROUP")
                .andExpect(jsonPath("$.openPolls").value(1))
                .andExpect(jsonPath("$.playersInAudience").value(2))
                .andExpect(jsonPath("$.playersResponded").value(1))
                .andExpect(jsonPath("$.playersStillToAnswer").value(1))
                .andExpect(jsonPath("$.closingSoon").value(1));
        summary(fixtures.clubAdmin(w), w, "type", "ALL").andExpect(jsonPath("$.openPolls").value(3));
        summary(fixtures.clubAdmin(w), w, "type", "NONSENSE").andExpect(status().isBadRequest());
    }

    @Test
    void sectionNarrowsLikeASectionManagerWouldSeeIt() throws Exception {
        World w = seed();

        summary(fixtures.clubAdmin(w), w, "sectionId", w.juniors().getId().toString())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openPolls").value(1))
                .andExpect(jsonPath("$.playersInAudience").value(3))
                .andExpect(jsonPath("$.playersStillToAnswer").value(2));
        summary(fixtures.clubAdmin(w), w, "sectionId", w.seniors().getId().toString())
                .andExpect(jsonPath("$.openPolls").value(2))
                .andExpect(jsonPath("$.playersStillToAnswer").value(2));
    }

    @Test
    void aSectionManagerCannotFilterBySectionTheyDoNotAdminister() throws Exception {
        World w = seed();

        summary(fixtures.sectionManager(w.juniors()), w, "sectionId", w.seniors().getId().toString())
                .andExpect(status().isForbidden());
        summary(fixtures.sectionManager(w.juniors()), w, "teamId", w.seniors1().getId().toString())
                .andExpect(status().isForbidden());
    }

    @Test
    void leagueNarrowsSquadPollsByMatchAndGroupPollsByTheirSlotMatches() throws Exception {
        Leagued l = seedLeague();

        summary(fixtures.clubAdmin(l.w()), l.w(), "leagueId", l.league().getId().toString())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openPolls").value(2))
                .andExpect(jsonPath("$.playersInAudience").value(3))
                .andExpect(jsonPath("$.playersResponded").value(0))
                .andExpect(jsonPath("$.playersStillToAnswer").value(3));
    }

    @Test
    void teamNarrowsSquadPollsByTeamAndGroupPollsByASideOfASlotMatch() throws Exception {
        Leagued l = seedLeague();

        // seniors2: its squad poll and the group poll linked to its match
        summary(fixtures.clubAdmin(l.w()), l.w(), "teamId", l.team().getId().toString())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openPolls").value(2));
        // seniors1 has a squad poll and no slot-linked group poll
        summary(fixtures.clubAdmin(l.w()), l.w(), "teamId", l.w().seniors1().getId().toString())
                .andExpect(jsonPath("$.openPolls").value(1))
                .andExpect(jsonPath("$.playersInAudience").value(2));
    }

    @Test
    void includeClosedAddsClosedPollsButNotToClosingSoon() throws Exception {
        Leagued l = seedLeague();

        summary(fixtures.clubAdmin(l.w()), l.w())
                .andExpect(jsonPath("$.openPolls").value(5));
        summary(fixtures.clubAdmin(l.w()), l.w(), "includeClosed", "true")
                .andExpect(jsonPath("$.openPolls").value(6))
                .andExpect(jsonPath("$.closingSoon").value(2));
    }

    @Test
    void aLeagueOrTeamOfAnotherClubIsNotFound() throws Exception {
        World w = seed();
        World other = fixtures.world();
        League foreignLeague = fixtures.league(other, 11);

        summary(fixtures.clubAdmin(w), w, "leagueId", foreignLeague.getId().toString())
                .andExpect(status().isNotFound());
        summary(fixtures.clubAdmin(w), w, "teamId", other.seniors1().getId().toString())
                .andExpect(status().isNotFound());
        summary(fixtures.clubAdmin(w), w, "leagueId", java.util.UUID.randomUUID().toString())
                .andExpect(status().isNotFound());
    }

    @Test
    void filtersNeverLeakAnotherClubsPollsAndForbiddenStillWinsOverFilters() throws Exception {
        World w = seed();
        World other = fixtures.world();

        summary(fixtures.clubAdmin(other), w, "type", "SQUAD").andExpect(status().isForbidden());
    }
}
