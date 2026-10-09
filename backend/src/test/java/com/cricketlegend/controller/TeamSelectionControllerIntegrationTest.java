package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayingRole;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import com.cricketlegend.repository.MatchSideRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Integration test for {@code GET /api/v1/manage/clubs/{clubId}/team-selection}
 * (docs/specs/093-team-selection-hub.md) against a real Postgres: the response shape, the pick
 * markers and order, a derby, every refusal reason, the past filter, the counters equalling their
 * filters, section scope and access, and above all PARITY with the spec 076 apply endpoint — a cell
 * reported pickable is accepted by {@code PUT .../sides/{sideId}/selection} and a blocked one is
 * refused with the same reason. Deliberately NOT {@code @Transactional} (docs/standards/backend.md):
 * the service's own read-only transaction must be enough to map the response. The statement-count
 * guard is {@code TeamSelectionQueryCountIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class TeamSelectionControllerIntegrationTest {

    private static final String URL = "/api/v1/manage/clubs/{clubId}/team-selection";
    private static final String SELECTION = "/api/v1/manage/clubs/{clubId}/matches/{matchId}/sides/{sideId}/selection";
    private static final ZoneId ZONE = ZoneId.systemDefault();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private LeagueRepository leagueRepository;

    @Autowired
    private MatchSideRepository matchSideRepository;

    @Autowired
    private MatchSidePlayerRepository matchSidePlayerRepository;

    @Autowired
    private MatchAvailabilityPollRepository pollRepository;

    @Autowired
    private PlayerAvailabilityRepository playerAvailabilityRepository;

    private ManagerOverviewFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private static Instant at(int day, int hour) {
        return LocalDateTime.of(LocalDate.of(2031, 6, 7).plusDays(day), LocalTime.of(hour, 0)).atZone(ZONE).toInstant();
    }

    /**
     * Seniors: ann (picked for A), bob (picked for B, same slot as A), cat (no answer), dan
     * (unavailable), eve (unsure), fay (not on the poll), gus (inactive: no row). Jay is a Juniors
     * player. Matches: A (Villagers 1, squad poll) and B (Villagers 2) share Saturday morning; C is a
     * derby of both on the next Saturday (Villagers 1 has a side, Villagers 2 none yet); D is in a
     * league with a maximum age of 20 (everyone is older); J is a Juniors match.
     */
    private record Seeded(World w, Match a, Match b, Match c, Match d, Match j, MatchSide sideA, MatchSide sideB,
            MatchSide sideC1, PlayerProfile ann, PlayerProfile bob, PlayerProfile cat, PlayerProfile dan,
            PlayerProfile eve, PlayerProfile fay, PlayerProfile jay) {
    }

    private Seeded seed() {
        World w = fixtures.world();
        PlayerProfile ann = fixtures.rosterPlayer(w, w.seniors1(), "Ann");
        PlayerProfile bob = fixtures.rosterPlayer(w, w.seniors1(), "Bob");
        PlayerProfile cat = fixtures.rosterPlayer(w, w.seniors1(), "Cat");
        PlayerProfile dan = fixtures.rosterPlayer(w, w.seniors1(), "Dan");
        PlayerProfile eve = fixtures.rosterPlayer(w, w.seniors1(), "Eve");
        PlayerProfile fay = fixtures.player(w, "Fay", true);
        PlayerProfile gus = fixtures.player(w, "Gus", false);
        PlayerProfile jay = fixtures.player(w, "Jay", true);
        List.of(ann, bob, cat, dan, eve, fay, gus).forEach(player -> fixtures.tag(w.seniors(), player));
        fixtures.tag(w.juniors(), jay);

        Match a = fixtures.match(w, w.seniors1(), null, at(0, 10));
        Match b = fixtures.match(w, w.seniors2(), null, at(0, 11));
        Match c = fixtures.match(w, w.seniors1(), w.seniors2(), at(7, 10));
        League old = leagueRepository.save(League.builder().clubId(w.club().getId()).name("Under 20s")
                .source(com.cricketlegend.domain.LeagueSource.INTERNAL).maxPlayingXiSize(11).maxAge(20).active(true)
                .build());
        Match d = fixtures.match(w, w.seniors1(), null, at(14, 10), true, old);
        Match j = fixtures.match(w, w.juniorsTeam(), null, at(21, 10));

        var poll = fixtures.squadPoll(a, w.seniors1(), null, ann, bob);
        answer(poll.getId(), dan, AvailabilityStatus.UNAVAILABLE);
        answer(poll.getId(), eve, AvailabilityStatus.UNSURE);

        MatchSide sideA = fixtures.side(a, w.seniors1(), false, ann);
        MatchSide sideB = fixtures.side(b, w.seniors2(), false, bob);
        MatchSide sideC1 = fixtures.side(c, w.seniors1(), false);
        return new Seeded(w, a, b, c, d, j, sideA, sideB, sideC1, ann, bob, cat, dan, eve, fay, jay);
    }

    private void answer(UUID pollId, PlayerProfile player, AvailabilityStatus status) {
        playerAvailabilityRepository.save(PlayerAvailability.builder().pollId(pollId)
                .playerProfileId(player.getId()).status(status).build());
    }

    private String overview(JwtRequestPostProcessor caller, World w, String query) throws Exception {
        return mockMvc.perform(get(URL + query, w.club().getId()).with(caller))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    private String cell(String body, PlayerProfile player, Match match, UUID teamId, String field) {
        List<Object> found = JsonPath.read(body, "$.players[?(@.playerId=='" + player.getId() + "')].cells[?(@.matchId=='"
                + match.getId() + "' && @.teamId=='" + teamId + "')]." + field);
        assertThat(found).as("cell %s of %s", field, player.getId()).hasSize(1);
        return String.valueOf(found.get(0));
    }

    private void assertReason(String body, PlayerProfile player, Match match, UUID teamId, String reason) {
        assertThat(cell(body, player, match, teamId, "reasonCode")).isEqualTo(reason);
        assertThat(cell(body, player, match, teamId, "pickable")).isEqualTo(String.valueOf(reason.equals("null")));
    }

    // --- shape, markers, order ---

    @Test
    void matchesCarryTheirSidesPicksMarkersAndStatusInBattingOrder() throws Exception {
        Seeded s = seed();
        PlayerProfile zoe = fixtures.player(s.w(), "Zoe", true);
        fixtures.tag(s.w().seniors(), zoe);
        // ann at 1, bob at 2, cat picked without a position, dan the 12th man, zoe at 3
        matchSidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(s.sideA().getId())
                .playerProfileId(s.bob().getId()).battingOrder(2).role(PlayingRole.BOWLER).build());
        matchSidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(s.sideA().getId())
                .playerProfileId(zoe.getId()).battingOrder(3).role(PlayingRole.BATSMAN).build());
        matchSidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(s.sideA().getId())
                .playerProfileId(s.cat().getId()).role(PlayingRole.BATSMAN).build());
        matchSidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(s.sideA().getId())
                .playerProfileId(s.dan().getId()).role(PlayingRole.BATSMAN).build());
        MatchSide sideA = matchSideRepository.findById(s.sideA().getId()).orElseThrow();
        sideA.setCaptainPlayerId(s.bob().getId());
        sideA.setWicketKeeperPlayerId(s.ann().getId());
        sideA.setTwelfthManPlayerId(s.dan().getId());
        matchSideRepository.save(sideA);

        String body = overview(fixtures.clubAdmin(s.w()), s.w(), "?seasonId=" + s.w().season().getId());

        String m = "$.matches[?(@.matchId=='" + s.a().getId() + "')]";
        assertThat((List<String>) JsonPath.read(body, m + ".sides[0].picks[*].firstName"))
                .containsExactly("Ann", "Bob", "Zoe", "Cat", "Dan");
        assertThat((List<Boolean>) JsonPath.read(body, m + ".sides[0].picks[?(@.firstName=='Bob')].captain"))
                .containsExactly(true);
        assertThat((List<Boolean>) JsonPath.read(body, m + ".sides[0].picks[?(@.firstName=='Ann')].wicketKeeper"))
                .containsExactly(true);
        assertThat((List<Boolean>) JsonPath.read(body, m + ".sides[0].picks[?(@.firstName=='Dan')].twelfthMan"))
                .containsExactly(true);
        assertThat((List<String>) JsonPath.read(body, m + ".sides[0].picks[?(@.firstName=='Bob')].role"))
                .containsExactly("BOWLER");
        assertThat((List<Integer>) JsonPath.read(body, m + ".sides[0].pickedCount")).containsExactly(5);
        assertThat((List<Integer>) JsonPath.read(body, m + ".sides[0].limits.maxSelected")).containsExactly(12);
        assertThat((List<String>) JsonPath.read(body, m + ".sides[0].status")).containsExactly("IN_PROGRESS");
        assertThat((List<String>) JsonPath.read(body, m + ".sides[0].opponentName")).containsExactly("Occasionals");
        assertThat((List<Boolean>) JsonPath.read(body, m + ".sides[0].home")).containsExactly(true);
        assertThat((List<String>) JsonPath.read(body, m + ".label")).containsExactly("Villagers 1 v Occasionals");
        // matches ascend by date
        assertThat((List<String>) JsonPath.read(body, "$.matches[*].matchId")).containsExactly(
                s.a().getId().toString(), s.b().getId().toString(), s.c().getId().toString(),
                s.d().getId().toString(), s.j().getId().toString());
    }

    @Test
    void aDerbyHasTwoOwnSidesAndEveryPlayerTwoCellsForIt() throws Exception {
        Seeded s = seed();

        String body = overview(fixtures.clubAdmin(s.w()), s.w(), "");

        String m = "$.matches[?(@.matchId=='" + s.c().getId() + "')]";
        assertThat((List<String>) JsonPath.read(body, m + ".sides[*].teamName"))
                .containsExactly("Villagers 1", "Villagers 2");
        assertThat((List<Boolean>) JsonPath.read(body, m + ".sides[*].home")).containsExactly(true, false);
        assertThat((List<String>) JsonPath.read(body, m + ".sides[*].opponentName"))
                .containsExactly("Villagers 2", "Villagers 1");
        // Villagers 1 has a side, Villagers 2 has none yet (sideId null; the first pick creates it)
        assertThat((List<Object>) JsonPath.read(body, m + ".sides[0].sideId")).containsExactly(s.sideC1().getId().toString());
        assertThat((List<Object>) JsonPath.read(body, m + ".sides[1].sideId")).containsExactly((Object) null);
        List<Object> annCells = JsonPath.read(body, "$.players[?(@.firstName=='Ann')].cells[?(@.matchId=='"
                + s.c().getId() + "')]");
        assertThat(annCells).hasSize(2);
    }

    @Test
    void rowsAreTheActivePlayersOfTheShownPoolsInNameOrderAndPickedCountsCells() throws Exception {
        Seeded s = seed();

        String body = overview(fixtures.clubAdmin(s.w()), s.w(), "");

        // Gus is inactive and never a row; Jay (Juniors) is a row because of the Juniors match
        assertThat((List<String>) JsonPath.read(body, "$.players[*].firstName"))
                .containsExactly("Ann", "Bob", "Cat", "Dan", "Eve", "Fay", "Jay");
        assertThat((List<Integer>) JsonPath.read(body, "$.players[?(@.firstName=='Ann')].pickedCount"))
                .containsExactly(1);
        assertThat((List<Integer>) JsonPath.read(body, "$.players[?(@.firstName=='Cat')].pickedCount"))
                .containsExactly(0);
    }

    // --- refusal reasons ---

    @Test
    void cellsExplainWhyAPlayerCannotBePicked() throws Exception {
        Seeded s = seed();
        String body = overview(fixtures.clubAdmin(s.w()), s.w(), "");
        UUID v1 = s.w().seniors1().getId();
        UUID v2 = s.w().seniors2().getId();

        // A: ann picked; bob is held by B in the same slot; cat never answered; dan unavailable; eve unsure
        assertThat(cell(body, s.ann(), s.a(), v1, "picked")).isEqualTo("true");
        assertReason(body, s.ann(), s.a(), v1, "null");
        assertReason(body, s.bob(), s.a(), v1, "TAKEN_FOR_SLOT");
        assertReason(body, s.cat(), s.a(), v1, "NOT_CONFIRMED");
        assertReason(body, s.dan(), s.a(), v1, "SAID_UNAVAILABLE");
        assertReason(body, s.eve(), s.a(), v1, "NOT_CONFIRMED");
        assertReason(body, s.fay(), s.a(), v1, "null"); // not on the poll: not blocked
        // B has no poll; ann is held by A
        assertReason(body, s.ann(), s.b(), v2, "TAKEN_FOR_SLOT");
        assertReason(body, s.dan(), s.b(), v2, "null");
        // the league's maximum age
        assertReason(body, s.fay(), s.d(), v1, "AGE_INELIGIBLE");
        // a Juniors player is not in the Seniors pool and the other way round
        assertReason(body, s.jay(), s.a(), v1, "NOT_IN_POOL");
        assertReason(body, s.fay(), s.j(), s.w().juniorsTeam().getId(), "NOT_IN_POOL");
        assertReason(body, s.jay(), s.j(), s.w().juniorsTeam().getId(), "null");
    }

    @Test
    void cellsReportThePlayersAvailabilityAnswerForEachValue() throws Exception {
        Seeded s = seed();
        String body = overview(fixtures.clubAdmin(s.w()), s.w(), "");
        UUID v1 = s.w().seniors1().getId();
        UUID v2 = s.w().seniors2().getId();

        assertThat(cell(body, s.ann(), s.a(), v1, "availability")).isEqualTo("AVAILABLE");
        assertThat(cell(body, s.eve(), s.a(), v1, "availability")).isEqualTo("UNSURE");
        assertThat(cell(body, s.dan(), s.a(), v1, "availability")).isEqualTo("UNAVAILABLE");
        assertThat(cell(body, s.cat(), s.a(), v1, "availability")).isEqualTo("NO_RESPONSE");
        // not on the poll's audience, and a match with no poll at all
        assertThat(cell(body, s.fay(), s.a(), v1, "availability")).isEqualTo("NOT_POLLED");
        assertThat(cell(body, s.dan(), s.b(), v2, "availability")).isEqualTo("NOT_POLLED");
        // the picked cell keeps its answer too
        assertThat(cell(body, s.ann(), s.a(), v1, "picked")).isEqualTo("true");
    }

    @Test
    void aPickedCellStillReportsAnUnavailableAnswer() throws Exception {
        Seeded s = seed();
        matchSidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(s.sideA().getId())
                .playerProfileId(s.dan().getId()).battingOrder(2).role(PlayingRole.BATSMAN).build());

        String body = overview(fixtures.clubAdmin(s.w()), s.w(), "");

        UUID v1 = s.w().seniors1().getId();
        assertThat(cell(body, s.dan(), s.a(), v1, "picked")).isEqualTo("true");
        assertThat(cell(body, s.dan(), s.a(), v1, "availability")).isEqualTo("UNAVAILABLE");
        assertThat(cell(body, s.dan(), s.a(), v1, "reasonCode")).isEqualTo("null");
    }

    @Test
    void aFullSideRefusesFurtherPicksWithTeamFull() throws Exception {
        World w = fixtures.world();
        List<PlayerProfile> eleven = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            PlayerProfile p = fixtures.player(w, "P" + (char) ('a' + i), true);
            fixtures.tag(w.seniors(), p);
            eleven.add(p);
        }
        Match match = fixtures.match(w, w.seniors1(), null, at(0, 10));
        fixtures.side(match, w.seniors1(), false, eleven.subList(0, 11).toArray(new PlayerProfile[0]));
        MatchSide side = matchSideRepository.findByMatchIdAndTeamId(match.getId(), w.seniors1().getId()).orElseThrow();
        // the 12th selection row (no position) fills the side to maxSelected
        matchSidePlayerRepository.save(MatchSidePlayer.builder().matchSideId(side.getId())
                .playerProfileId(eleven.get(11).getId()).role(PlayingRole.BATSMAN).build());
        PlayerProfile extra = fixtures.player(w, "Extra", true);
        fixtures.tag(w.seniors(), extra);

        String body = overview(fixtures.clubAdmin(w), w, "");

        assertReason(body, extra, match, w.seniors1().getId(), "TEAM_FULL");
    }

    // --- parity with the apply endpoint ---

    @Test
    void everyPickableCellIsAcceptedByTheApplyEndpointAndEveryBlockedOneRefusedWithTheSameReason() throws Exception {
        Seeded s = seed();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(s.w());
        String body = overview(admin, s.w(), "");
        int checked = 0;

        List<Map<String, Object>> players = JsonPath.read(body, "$.players[*]");
        for (Map<String, Object> player : players) {
            List<Map<String, Object>> cells = (List<Map<String, Object>>) player.get("cells");
            for (Map<String, Object> cell : cells) {
                if (cell.get("sideId") == null || Boolean.TRUE.equals(cell.get("picked"))) {
                    continue;
                }
                String matchId = (String) cell.get("matchId");
                String sideId = (String) cell.get("sideId");
                List<Map<String, Object>> picks = JsonPath.read(body, "$.matches[?(@.matchId=='" + matchId
                        + "')].sides[?(@.sideId=='" + sideId + "')].picks[*]");
                String original = applyBody(picks, null);
                String withPlayer = applyBody(picks, (String) player.get("playerId"));
                if (Boolean.TRUE.equals(cell.get("pickable"))) {
                    mockMvc.perform(apply(admin, s.w(), matchId, sideId, withPlayer)).andExpect(status().isOk());
                    mockMvc.perform(apply(admin, s.w(), matchId, sideId, original)).andExpect(status().isOk());
                } else {
                    mockMvc.perform(apply(admin, s.w(), matchId, sideId, withPlayer))
                            .andExpect(status().isConflict())
                            .andExpect(jsonPath("$.rejections[?(@.reason=='" + cell.get("reasonCode") + "')]")
                                    .isNotEmpty());
                }
                checked++;
            }
        }
        assertThat(checked).isGreaterThan(15);
    }

    private static String applyBody(List<Map<String, Object>> picks, String extraPlayerId) {
        List<String> entries = new ArrayList<>();
        for (Map<String, Object> pick : picks) {
            entries.add("{\"playerProfileId\": \"" + pick.get("playerId") + "\", \"role\": \"" + pick.get("role")
                    + "\", \"battingOrder\": " + pick.get("battingOrder") + "}");
        }
        if (extraPlayerId != null) {
            entries.add("{\"playerProfileId\": \"" + extraPlayerId + "\"}");
        }
        return "{\"players\": [" + String.join(",", entries) + "]}";
    }

    private org.springframework.test.web.servlet.RequestBuilder apply(
            JwtRequestPostProcessor caller, World w, String matchId, String sideId, String body) {
        return put(SELECTION, w.club().getId(), matchId, sideId)
                .with(caller).contentType(MediaType.APPLICATION_JSON).content(body);
    }

    // --- filters and counters ---

    @Test
    void pastMatchesAreOnlyShownWithIncludePastAndAreNotUpcoming() throws Exception {
        World w = fixtures.world();
        Match past = fixtures.match(w, w.seniors1(), null, Instant.parse("2020-05-02T10:00:00Z"));
        Match future = fixtures.match(w, w.seniors1(), null, at(0, 10));
        Match inactive = fixtures.match(w, w.seniors1(), null, at(1, 10), false, null);

        String upcoming = overview(fixtures.clubAdmin(w), w, "");
        String all = overview(fixtures.clubAdmin(w), w, "?includePast=true");

        assertThat((List<String>) JsonPath.read(upcoming, "$.matches[*].matchId"))
                .containsExactly(future.getId().toString());
        assertThat((List<String>) JsonPath.read(all, "$.matches[*].matchId"))
                .containsExactly(past.getId().toString(), future.getId().toString());
        assertThat((List<Boolean>) JsonPath.read(all, "$.matches[*].upcoming")).containsExactly(false, true);
        assertThat((Integer) JsonPath.read(all, "$.counts.upcoming")).isEqualTo(1);
        assertThat(all).doesNotContain(inactive.getId().toString());
    }

    @Test
    void eachCounterEqualsTheNumberOfMatchesItsFilterShows() throws Exception {
        World w = fixtures.world();
        PlayerProfile[] eleven = new PlayerProfile[11];
        for (int i = 0; i < 11; i++) {
            eleven[i] = fixtures.rosterPlayer(w, w.seniors1(), "R" + (char) ('a' + i));
        }
        fixtures.match(w, w.seniors1(), null, at(0, 10)); // not started
        Match started = fixtures.match(w, w.seniors1(), null, at(1, 10)); // in progress
        fixtures.side(started, w.seniors1(), false, eleven[0], eleven[1]);
        Match ready = fixtures.match(w, w.seniors1(), null, at(2, 10)); // all places filled
        fixtures.side(ready, w.seniors1(), false, eleven);
        Match announced = fixtures.match(w, w.seniors1(), null, at(3, 10));
        fixtures.side(announced, w.seniors1(), true, eleven);
        fixtures.match(w, w.seniors1(), null, Instant.parse("2020-05-02T10:00:00Z")); // past, not started

        String body = overview(fixtures.clubAdmin(w), w, "?includePast=true");

        assertThat((Integer) JsonPath.read(body, "$.counts.upcoming")).isEqualTo(4);
        assertThat((Integer) JsonPath.read(body, "$.counts.notStarted")).isEqualTo(2);
        assertThat((Integer) JsonPath.read(body, "$.counts.inProgress")).isEqualTo(1);
        assertThat((Integer) JsonPath.read(body, "$.counts.readyToAnnounce")).isEqualTo(1);
        assertThat((Integer) JsonPath.read(body, "$.counts.announced")).isEqualTo(1);
        assertThat(JsonPath.<List<Object>>read(body, "$.matches[?(@.status=='NOT_STARTED')]")).hasSize(2);
        assertThat(JsonPath.<List<Object>>read(body, "$.matches[?(@.status=='IN_PROGRESS')]")).hasSize(1);
        assertThat(JsonPath.<List<Object>>read(body, "$.matches[?(@.status=='READY_TO_ANNOUNCE')]")).hasSize(1);
        assertThat(JsonPath.<List<Object>>read(body, "$.matches[?(@.status=='ANNOUNCED')]")).hasSize(1);
        assertThat(JsonPath.<List<Object>>read(body, "$.matches[?(@.upcoming==true)]")).hasSize(4);
    }

    @Test
    void theSeasonLeagueAndTeamFiltersNarrowTheMatches() throws Exception {
        Seeded s = seed();

        String byTeam = overview(fixtures.clubAdmin(s.w()), s.w(), "?teamId=" + s.w().seniors2().getId());
        String byLeague = overview(fixtures.clubAdmin(s.w()), s.w(), "?leagueId=" + s.d().getLeagueId());
        String otherSeason = overview(fixtures.clubAdmin(s.w()), s.w(), "?seasonId=" + UUID.randomUUID());

        // Villagers 2 plays B and the derby; only its own side is shown for the derby
        assertThat((List<String>) JsonPath.read(byTeam, "$.matches[*].matchId"))
                .containsExactly(s.b().getId().toString(), s.c().getId().toString());
        assertThat((List<String>) JsonPath.read(byTeam, "$.matches[?(@.matchId=='" + s.c().getId() + "')].sides[*].teamName"))
                .containsExactly("Villagers 2");
        assertThat((List<String>) JsonPath.read(byLeague, "$.matches[*].matchId"))
                .containsExactly(s.d().getId().toString());
        assertThat((List<Object>) JsonPath.read(otherSeason, "$.matches")).isEmpty();
    }

    // --- access ---

    @Test
    void aSectionManagerSeesOnlyTheirSectionsMatchesAndOtherCallersAreRefused() throws Exception {
        Seeded s = seed();

        String body = overview(fixtures.sectionManager(s.w().juniors()), s.w(), "");

        assertThat((List<String>) JsonPath.read(body, "$.matches[*].matchId")).containsExactly(s.j().getId().toString());
        assertThat((List<String>) JsonPath.read(body, "$.players[*].firstName")).containsExactly("Jay");

        mockMvc.perform(get(URL, s.w().club().getId()).with(fixtures.nobody())).andExpect(status().isForbidden());
        World other = fixtures.world();
        mockMvc.perform(get(URL, s.w().club().getId()).with(fixtures.clubAdmin(other))).andExpect(status().isForbidden());
        // out-of-scope filters: 403 for a section the caller cannot administer, 404 for another club's team
        mockMvc.perform(get(URL, s.w().club().getId()).param("sectionId", s.w().seniors().getId().toString())
                        .with(fixtures.sectionManager(s.w().juniors())))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(URL, s.w().club().getId()).param("teamId", s.w().seniors1().getId().toString())
                        .with(fixtures.sectionManager(s.w().juniors())))
                .andExpect(status().isForbidden());
        mockMvc.perform(get(URL, s.w().club().getId()).param("teamId", other.seniors1().getId().toString())
                        .with(fixtures.clubAdmin(s.w())))
                .andExpect(status().isNotFound());
    }

    @Test
    void anEmptyClubGivesAnEmptyOverview() throws Exception {
        World w = fixtures.world();

        mockMvc.perform(get(URL, w.club().getId()).with(fixtures.clubAdmin(w)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.matches", hasSize(0)))
                .andExpect(jsonPath("$.players", hasSize(0)))
                .andExpect(jsonPath("$.counts.upcoming").value(0))
                .andExpect(jsonPath("$.truncated").value(false));
    }

    // --- caps ---

    @Test
    void moreThanTheMatchCapIsTruncatedKeepingTheSoonest() throws Exception {
        World w = fixtures.world();
        for (int i = 0; i < 151; i++) {
            fixtures.match(w, w.seniors1(), null, at(i, 10));
        }

        String body = overview(fixtures.clubAdmin(w), w, "");

        assertThat((Boolean) JsonPath.read(body, "$.truncated")).isTrue();
        assertThat((List<Object>) JsonPath.read(body, "$.matches")).hasSize(150);
    }

    @Test
    void moreThanThePlayerCapIsTruncatedKeepingNameOrder() throws Exception {
        World w = fixtures.world();
        fixtures.match(w, w.seniors1(), null, at(0, 10));
        for (int i = 0; i < 501; i++) {
            fixtures.tag(w.seniors(), fixtures.player(w, String.format("N%03d", i), true));
        }

        String body = overview(fixtures.clubAdmin(w), w, "");

        assertThat((Boolean) JsonPath.read(body, "$.truncated")).isTrue();
        List<String> names = JsonPath.read(body, "$.players[*].firstName");
        assertThat(names).hasSize(500).startsWith("N000").endsWith("N499");
    }
}
