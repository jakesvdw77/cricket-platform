package com.cricketlegend.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
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
 * Integration test for docs/specs/082-poll-card-improvements.md's reopen rule against a real
 * Postgres: the open endpoints answer 409 once the latest match began more than 24 hours ago (squad
 * poll and group round), still work inside the grace, and the closed/open listings carry a matching
 * {@code canReopen}. Deliberately NOT {@code @Transactional} (docs/standards/backend.md).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class ReopenWindowIntegrationTest {

    private static final String MESSAGE = "This poll can no longer be reopened because its matches are in the past.";
    private static final String CLOSED = "/api/v1/manage/clubs/{clubId}/availability-polls/closed";
    private static final String OPEN = "/api/v1/manage/clubs/{clubId}/availability-polls/open";
    private static final String ROUNDS = "/api/v1/manage/clubs/{clubId}/section-availability-rounds";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private MatchAvailabilityPollRepository pollRepository;

    @Autowired
    private SectionAvailabilityRoundRepository roundRepository;

    @Autowired
    private SectionAvailabilityWindowRepository windowRepository;

    @Autowired
    private SectionAvailabilityWindowMatchRepository windowMatchRepository;

    private ManagerOverviewFixtures fixtures;
    private World world;
    private JwtRequestPostProcessor admin;
    private int dateCounter;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
        world = fixtures.world();
        admin = fixtures.clubAdmin(world);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private MatchAvailabilityPoll closedSquadPoll(Instant matchDate, boolean open) {
        Match match = fixtures.match(world, world.seniors1(), null, matchDate);
        MatchAvailabilityPoll poll = fixtures.squadPoll(match, world.seniors1(), null);
        poll.setAutoClose(false);
        poll.setScheduledCloseAt(null);
        poll.setOpen(open);
        return pollRepository.save(poll);
    }

    /** A round (Autoclose off) with one window per entry; an empty entry is a window with no match. */
    private SectionAvailabilityRound groupRound(boolean open, List<Instant>... matchDatesPerWindow) {
        LocalDate lastDate = LocalDate.of(2020, 1, 1);
        SectionAvailabilityRound round = roundRepository.save(SectionAvailabilityRound.builder()
                .clubId(world.club().getId()).sectionId(world.seniors().getId()).description("Weekend")
                .firstMatchDate(lastDate).lastMatchDate(lastDate).autoClose(false).open(open).build());
        for (List<Instant> dates : matchDatesPerWindow) {
            SectionAvailabilityWindow window = windowRepository.save(SectionAvailabilityWindow.builder()
                    .clubId(world.club().getId()).sectionId(world.seniors().getId()).roundId(round.getId())
                    .windowDate(lastDate.plusDays(dateCounter++)).dayPart(DayPart.MORNING).open(open).build());
            for (Instant date : dates) {
                Match match = fixtures.match(world, world.seniors1(), null, date);
                windowMatchRepository.save(SectionAvailabilityWindowMatch.builder()
                        .windowId(window.getId()).matchId(match.getId()).build());
            }
        }
        return round;
    }

    private String openSquad(MatchAvailabilityPoll poll) {
        return "/api/v1/manage/clubs/" + world.club().getId() + "/matches/" + poll.getMatchId() + "/polls/"
                + poll.getId() + "/open";
    }

    private String openRound(SectionAvailabilityRound round) {
        return "/api/v1/manage/clubs/" + world.club().getId() + "/section-availability-rounds/" + round.getId()
                + "/open";
    }

    @Test
    void reopeningASquadPollWhoseMatchWasMoreThan24HoursAgoIs409WithTheMessage() throws Exception {
        MatchAvailabilityPoll poll = closedSquadPoll(Instant.now().minus(Duration.ofHours(30)), false);

        mockMvc.perform(post(openSquad(poll)).with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MESSAGE));
    }

    @Test
    void reopeningASquadPollInsideTheGraceOrForAFutureMatchWorks() throws Exception {
        MatchAvailabilityPoll recent = closedSquadPoll(Instant.now().minus(Duration.ofHours(3)), false);
        MatchAvailabilityPoll future = closedSquadPoll(Instant.now().plus(Duration.ofDays(2)), false);

        mockMvc.perform(post(openSquad(recent)).with(admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.open").value(true))
                .andExpect(jsonPath("$.canReopen").value(true));
        mockMvc.perform(post(openSquad(future)).with(admin)).andExpect(status().isOk());
    }

    @Test
    void closedSquadListingCarriesCanReopenPerPoll() throws Exception {
        MatchAvailabilityPoll past = closedSquadPoll(Instant.now().minus(Duration.ofDays(4)), false);
        MatchAvailabilityPoll recent = closedSquadPoll(Instant.now().minus(Duration.ofHours(2)), false);

        // The closed listing is ordered by match date, most recent first.
        mockMvc.perform(get(CLOSED, world.club().getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].pollId").value(recent.getId().toString()))
                .andExpect(jsonPath("$[0].canReopen").value(true))
                .andExpect(jsonPath("$[1].pollId").value(past.getId().toString()))
                .andExpect(jsonPath("$[1].canReopen").value(false));
    }

    @Test
    void openSquadListingAlsoCarriesTheFlag() throws Exception {
        closedSquadPoll(Instant.now().minus(Duration.ofDays(4)), true);

        mockMvc.perform(get(OPEN, world.club().getId()).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].canReopen").value(false));
    }

    @Test
    void reopeningAGroupRoundUsesTheLatestMatchOfAllItsWindows() throws Exception {
        Instant old = Instant.now().minus(Duration.ofDays(9));
        SectionAvailabilityRound allPast = groupRound(false, List.of(old), List.of(Instant.now().minus(Duration.ofHours(40))));
        SectionAvailabilityRound oneRecent = groupRound(false, List.of(old), List.of(Instant.now().minus(Duration.ofHours(2))));

        mockMvc.perform(post(openRound(allPast)).with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MESSAGE));
        mockMvc.perform(post(openRound(oneRecent)).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.open").value(true))
                .andExpect(jsonPath("$.canReopen").value(true));
    }

    @Test
    void reopeningAGroupRoundForAFutureMatchWorks() throws Exception {
        SectionAvailabilityRound future = groupRound(false, List.of(Instant.now().plus(Duration.ofDays(3))));

        mockMvc.perform(post(openRound(future)).with(admin)).andExpect(status().isOk());
    }

    @Test
    void closedRoundListingCarriesCanReopenPerRound() throws Exception {
        SectionAvailabilityRound past = groupRound(false, List.of(Instant.now().minus(Duration.ofDays(5))));
        SectionAvailabilityRound recent = groupRound(false, List.of(Instant.now().minus(Duration.ofHours(5))));

        String body = mockMvc.perform(get(ROUNDS, world.club().getId()).param("open", "false").with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andReturn().getResponse().getContentAsString();
        com.jayway.jsonpath.DocumentContext json = com.jayway.jsonpath.JsonPath.parse(body);
        org.assertj.core.api.Assertions.assertThat(
                        json.read("$[?(@.id=='" + past.getId() + "')].canReopen", List.class))
                .containsExactly(false);
        org.assertj.core.api.Assertions.assertThat(
                        json.read("$[?(@.id=='" + recent.getId() + "')].canReopen", List.class))
                .containsExactly(true);
    }

    @Test
    void aRoundWindowWithoutAMatchFallsBackToItsDate() throws Exception {
        // windowDate is 2020-01-01 + n: long past, so the date fallback refuses the reopen.
        SectionAvailabilityRound matchless = groupRound(false, List.of());

        mockMvc.perform(post(openRound(matchless)).with(admin))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value(MESSAGE));
        mockMvc.perform(get(ROUNDS, world.club().getId()).param("open", "false").with(admin))
                .andExpect(jsonPath("$[0].canReopen").value(false));
    }
}
