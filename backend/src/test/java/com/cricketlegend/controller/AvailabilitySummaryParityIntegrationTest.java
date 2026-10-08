package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import com.fasterxml.jackson.databind.ObjectMapper;
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

/**
 * Parity between the availability summary counter {@code openPolls} (docs/specs/083) and the poll
 * lists it describes: for the same section (with descendants), poll type toggles and closed
 * toggle, the counter equals the squad poll list(s) plus the group round list(s). Includes
 * deactivated matches, whose squad polls are hidden in both. League and team (docs/specs/083 slice
 * 3) are part of the combinations: the lists and the summary share one AvailabilityPollFilter. The
 * players list (docs/specs/084) must also have totalElements equal to playersResponded and
 * playersStillToAnswer under the same filters.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class AvailabilitySummaryParityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    private ManagerOverviewFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private record Seeded(World w, League league) {
    }

    private Seeded seed() {
        World w = fixtures.world();
        League league = fixtures.league(w, 11);
        Instant now = Instant.now();
        PlayerProfile r1 = fixtures.rosterPlayer(w, w.seniors1(), "R1");
        PlayerProfile j1 = fixtures.rosterPlayer(w, w.juniorsTeam(), "J1");
        PlayerProfile ann = fixtures.player(w, "Ann", true);
        fixtures.tag(w.seniors(), ann);
        fixtures.tag(w.juniors(), fixtures.player(w, "Jay", true));

        Match seniorsLeague = fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(3)), true, league);
        fixtures.squadPoll(seniorsLeague, w.seniors1(), null, r1);
        fixtures.squadPoll(fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(4))), w.seniors1(), null);
        Match juniorsMatch = fixtures.match(w, w.juniorsTeam(), null, now.plus(Duration.ofDays(6)));
        fixtures.squadPoll(juniorsMatch, w.juniorsTeam(), null, j1);
        fixtures.linkMatch(fixtures.groupPoll(w, w.seniors(), null, ann), seniorsLeague);
        fixtures.linkMatch(fixtures.groupPoll(w, w.juniors(), null), juniorsMatch);
        fixtures.groupPoll(w, w.seniors(), null); // no slot matches at all
        // closed history
        Match closedLeague = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(5)), true, league);
        fixtures.closeSquadPoll(fixtures.squadPoll(closedLeague, w.seniors1(), null, r1));
        fixtures.closeSquadPoll(fixtures.squadPoll(
                fixtures.match(w, w.juniorsTeam(), null, now.minus(Duration.ofDays(6))), w.juniorsTeam(), null));
        SectionAvailabilityRound closedRound = fixtures.groupPoll(w, w.seniors(), null, ann);
        fixtures.linkMatch(closedRound, closedLeague);
        fixtures.closeGroupPoll(closedRound);
        // deactivated league matches: their squad polls are hidden, and as slot matches they satisfy nothing
        Match off = fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(9)), false, league);
        fixtures.squadPoll(off, w.seniors1(), null);
        fixtures.linkMatch(fixtures.groupPoll(w, w.juniors(), null), off);
        Match offPast = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(9)), false, league);
        fixtures.closeSquadPoll(fixtures.squadPoll(offPast, w.seniors1(), null));
        return new Seeded(w, league);
    }

    private int count(JwtRequestPostProcessor caller, String url, UUID clubId, String... params) throws Exception {
        var request = get(url, clubId).with(caller);
        for (int i = 0; i < params.length; i += 2) {
            request = request.param(params[i], params[i + 1]);
        }
        String body = mockMvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var json = objectMapper.readTree(body);
        return json.isArray() ? json.size() : json.path("openPolls").asInt();
    }

    /** Counter values {responded, stillToAnswer} of the summary for the filters. */
    private int[] summaryPlayers(JwtRequestPostProcessor caller, World w, String[] filters, String type, boolean closed)
            throws Exception {
        String body = mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/availability/summary", w.club().getId())
                        .with(caller)
                        .params(toParams(concat(filters, "type", type, "includeClosed", String.valueOf(closed)))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var json = objectMapper.readTree(body);
        return new int[] {json.path("playersResponded").asInt(), json.path("playersStillToAnswer").asInt()};
    }

    private int playersTotal(
            JwtRequestPostProcessor caller, World w, String[] filters, String type, boolean closed, String kind)
            throws Exception {
        String body = mockMvc.perform(
                        get("/api/v1/manage/clubs/{clubId}/availability/summary/players", w.club().getId())
                                .with(caller)
                                .params(toParams(concat(filters, "type", type, "includeClosed", String.valueOf(closed),
                                        "kind", kind, "closingSoon", "false"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("totalElements").asInt();
    }

    private static org.springframework.util.MultiValueMap<String, String> toParams(String[] pairs) {
        var params = new org.springframework.util.LinkedMultiValueMap<String, String>();
        for (int i = 0; i < pairs.length; i += 2) {
            params.add(pairs[i], pairs[i + 1]);
        }
        return params;
    }

    private int summaryCount(JwtRequestPostProcessor caller, World w, String[] filters, String type, boolean closed)
            throws Exception {
        return count(caller, "/api/v1/manage/clubs/{clubId}/availability/summary", w.club().getId(),
                concat(filters, "type", type, "includeClosed", String.valueOf(closed)));
    }

    private int listed(JwtRequestPostProcessor caller, World w, String[] filters, String type, boolean closed)
            throws Exception {
        UUID clubId = w.club().getId();
        int total = 0;
        if (!"GROUP".equals(type)) {
            total += count(caller, "/api/v1/manage/clubs/{clubId}/availability-polls/open", clubId, filters);
            if (closed) {
                total += count(caller, "/api/v1/manage/clubs/{clubId}/availability-polls/closed", clubId, filters);
            }
        }
        if (!"SQUAD".equals(type)) {
            total += count(caller, "/api/v1/manage/clubs/{clubId}/section-availability-rounds", clubId,
                    concat(filters, "open", "true"));
            if (closed) {
                total += count(caller, "/api/v1/manage/clubs/{clubId}/section-availability-rounds", clubId,
                        concat(filters, "open", "false"));
            }
        }
        return total;
    }

    private static String[] concat(String[] base, String... more) {
        String[] result = new String[base.length + more.length];
        System.arraycopy(base, 0, result, 0, base.length);
        System.arraycopy(more, 0, result, base.length, more.length);
        return result;
    }

    private static String[] filters(String section, String league, String team) {
        java.util.List<String> pairs = new java.util.ArrayList<>();
        if (section != null) {
            pairs.add("sectionId");
            pairs.add(section);
        }
        if (league != null) {
            pairs.add("leagueId");
            pairs.add(league);
        }
        if (team != null) {
            pairs.add("teamId");
            pairs.add(team);
        }
        return pairs.toArray(new String[0]);
    }

    @Test
    void theSummaryCounterEqualsTheListedPollsForEverySectionLeagueTeamTypeAndClosedToggle() throws Exception {
        Seeded seeded = seed();
        World w = seeded.w();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        String[] sections = {null, w.seniors().getId().toString(), w.juniors().getId().toString()};
        String[] leagues = {null, seeded.league().getId().toString()};
        String[] teams = {null, w.seniors1().getId().toString(), w.juniorsTeam().getId().toString()};

        int nonZero = 0;
        for (String section : sections) {
            for (String league : leagues) {
                for (String team : teams) {
                    for (String type : new String[] {"ALL", "SQUAD", "GROUP"}) {
                        for (boolean closed : new boolean[] {false, true}) {
                            String[] filters = filters(section, league, team);
                            int expected = listed(admin, w, filters, type, closed);
                            assertThat(summaryCount(admin, w, filters, type, closed))
                                    .as("section=%s league=%s team=%s type=%s includeClosed=%s",
                                            section, league, team, type, closed)
                                    .isEqualTo(expected);
                            nonZero += expected > 0 ? 1 : 0;
                            int[] counters = summaryPlayers(admin, w, filters, type, closed);
                            assertThat(playersTotal(admin, w, filters, type, closed, "responded"))
                                    .as("responded players: section=%s league=%s team=%s type=%s closed=%s",
                                            section, league, team, type, closed)
                                    .isEqualTo(counters[0]);
                            assertThat(playersTotal(admin, w, filters, type, closed, "awaiting"))
                                    .as("awaiting players: section=%s league=%s team=%s type=%s closed=%s",
                                            section, league, team, type, closed)
                                    .isEqualTo(counters[1]);
                        }
                    }
                }
            }
        }
        // sanity: the fixtures produce something to compare, and closed polls and league narrowing show up
        assertThat(nonZero).isPositive();
        assertThat(summaryCount(admin, w, filters(null, null, null), "ALL", false)).isEqualTo(7);
        assertThat(summaryCount(admin, w, filters(null, null, null), "ALL", true)).isEqualTo(10);
        assertThat(summaryCount(admin, w, filters(null, seeded.league().getId().toString(), null), "ALL", true))
                .isEqualTo(4);
        assertThat(summaryCount(admin, w, filters(null, null, w.juniorsTeam().getId().toString()), "ALL", false))
                .isEqualTo(2);
    }
}
