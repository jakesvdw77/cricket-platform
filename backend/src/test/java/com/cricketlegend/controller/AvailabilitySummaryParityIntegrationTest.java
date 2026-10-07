package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
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
 * deactivated matches, whose squad polls are hidden in both. League and team parity comes with
 * slice 3, when the lists gain those filters.
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

    private World seed() {
        World w = fixtures.world();
        Instant now = Instant.now();
        PlayerProfile r1 = fixtures.rosterPlayer(w, w.seniors1(), "R1");
        PlayerProfile j1 = fixtures.rosterPlayer(w, w.juniorsTeam(), "J1");
        PlayerProfile ann = fixtures.player(w, "Ann", true);
        fixtures.tag(w.seniors(), ann);
        fixtures.tag(w.juniors(), fixtures.player(w, "Jay", true));

        fixtures.squadPoll(fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(3))), w.seniors1(), null, r1);
        fixtures.squadPoll(fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(4))), w.seniors1(), null);
        fixtures.squadPoll(fixtures.match(w, w.juniorsTeam(), null, now.plus(Duration.ofDays(6))), w.juniorsTeam(), null, j1);
        fixtures.groupPoll(w, w.seniors(), null, ann);
        fixtures.groupPoll(w, w.juniors(), null);
        // closed history
        fixtures.closeSquadPoll(fixtures.squadPoll(
                fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(5))), w.seniors1(), null, r1));
        fixtures.closeSquadPoll(fixtures.squadPoll(
                fixtures.match(w, w.juniorsTeam(), null, now.minus(Duration.ofDays(6))), w.juniorsTeam(), null));
        SectionAvailabilityRound closedRound = fixtures.groupPoll(w, w.seniors(), null, ann);
        fixtures.closeGroupPoll(closedRound);
        // deactivated matches: their squad polls (open and closed) are hidden everywhere
        Match off = fixtures.match(w, w.seniors1(), null, now.plus(Duration.ofDays(9)), false, null);
        fixtures.squadPoll(off, w.seniors1(), null);
        Match offPast = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(9)), false, null);
        fixtures.closeSquadPoll(fixtures.squadPoll(offPast, w.seniors1(), null));
        return w;
    }

    private int count(JwtRequestPostProcessor caller, String url, UUID clubId, String... params) throws Exception {
        var request = get(url, clubId).with(caller);
        for (int i = 0; i < params.length; i += 2) {
            request = request.param(params[i], params[i + 1]);
        }
        String body = mockMvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).isArray() ? objectMapper.readTree(body).size()
                : objectMapper.readTree(body).path("openPolls").asInt();
    }

    private int summaryCount(JwtRequestPostProcessor caller, World w, String sectionId, String type, boolean closed)
            throws Exception {
        String[] params = sectionId == null
                ? new String[] {"type", type, "includeClosed", String.valueOf(closed)}
                : new String[] {"type", type, "includeClosed", String.valueOf(closed), "sectionId", sectionId};
        return count(caller, "/api/v1/manage/clubs/{clubId}/availability/summary", w.club().getId(), params);
    }

    private int listed(JwtRequestPostProcessor caller, World w, String sectionId, String type, boolean closed)
            throws Exception {
        UUID clubId = w.club().getId();
        String[] section = sectionId == null ? new String[0] : new String[] {"sectionId", sectionId};
        int total = 0;
        if (!"GROUP".equals(type)) {
            total += count(caller, "/api/v1/manage/clubs/{clubId}/availability-polls/open", clubId, section);
            if (closed) {
                total += count(caller, "/api/v1/manage/clubs/{clubId}/availability-polls/closed", clubId, section);
            }
        }
        if (!"SQUAD".equals(type)) {
            String[] open = concat(section, "open", "true");
            total += count(caller, "/api/v1/manage/clubs/{clubId}/section-availability-rounds", clubId, open);
            if (closed) {
                String[] shut = concat(section, "open", "false");
                total += count(caller, "/api/v1/manage/clubs/{clubId}/section-availability-rounds", clubId, shut);
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

    @Test
    void theSummaryCounterEqualsTheListedPollsForEverySectionTypeAndClosedToggle() throws Exception {
        World w = seed();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(w);
        String[] sections = {null, w.seniors().getId().toString(), w.juniors().getId().toString()};

        for (String section : sections) {
            for (String type : new String[] {"ALL", "SQUAD", "GROUP"}) {
                for (boolean closed : new boolean[] {false, true}) {
                    int expected = listed(admin, w, section, type, closed);
                    assertThat(summaryCount(admin, w, section, type, closed))
                            .as("section=%s type=%s includeClosed=%s", section, type, closed)
                            .isEqualTo(expected);
                }
            }
        }
        // sanity: the fixtures produce something to compare, and closed polls add to it
        assertThat(summaryCount(admin, w, null, "ALL", false)).isEqualTo(5);
        assertThat(summaryCount(admin, w, null, "ALL", true)).isEqualTo(8);
    }
}
