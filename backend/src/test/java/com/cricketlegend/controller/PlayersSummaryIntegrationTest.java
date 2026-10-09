package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerVerificationStatus;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.support.ManagerOverviewFixtures;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import com.fasterxml.jackson.databind.JsonNode;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * docs/specs/088-players-polls-alignment.md: the Players counters ({@code GET /players/summary}), the list's {@code
 * includeInactive}, {@code focus} and {@code seasonId}, and the verify and reject endpoints, through real HTTP against
 * real Postgres. Proves the definitions, that each counter equals the list's size for the same filters, section scoping,
 * the other-club 403, the 400s and the status transitions. Not {@code @Transactional}; {@link ManagerOverviewFixtures}
 * removes what it seeds.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class PlayersSummaryIntegrationTest {

    private static final String PLAYERS = "/api/v1/manage/clubs/{clubId}/players";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext context;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PlayerProfileRepository playerProfileRepository;

    private ManagerOverviewFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ManagerOverviewFixtures(context);
    }

    @AfterEach
    void cleanUp() {
        fixtures.cleanUp();
    }

    private record Seeded(World w, World other, PlayerProfile unverified, PlayerProfile rejected) {
    }

    private PlayerProfile withStatus(PlayerProfile profile, PlayerVerificationStatus status) {
        profile.setVerificationStatus(status);
        return playerProfileRepository.save(profile);
    }

    /**
     * Seniors: p1 (squad, selected in an active match), p2 (squad only), p3 (unverified), p4 (rejected). Juniors: p5
     * (suspended), p6 (squad; selected only in a deactivated match, which does not count).
     */
    private Seeded seed() {
        World w = fixtures.world();
        World other = fixtures.world();
        Instant now = Instant.now();

        PlayerProfile p1 = fixtures.rosterPlayer(w, w.seniors1(), "P1");
        fixtures.tag(w.seniors(), p1);
        PlayerProfile p2 = fixtures.rosterPlayer(w, w.seniors1(), "P2");
        fixtures.tag(w.seniors(), p2);
        PlayerProfile p3 = fixtures.player(w, "P3", true);
        fixtures.tag(w.seniors(), p3);
        withStatus(p3, PlayerVerificationStatus.UNVERIFIED);
        PlayerProfile p4 = fixtures.player(w, "P4", true);
        fixtures.tag(w.seniors(), p4);
        withStatus(p4, PlayerVerificationStatus.REJECTED);
        PlayerProfile p5 = fixtures.player(w, "P5", false);
        fixtures.tag(w.juniors(), p5);
        PlayerProfile p6 = fixtures.rosterPlayer(w, w.juniorsTeam(), "P6");
        fixtures.tag(w.juniors(), p6);

        Match played = fixtures.match(w, w.seniors1(), null, now.minus(Duration.ofDays(3)));
        fixtures.side(played, w.seniors1(), true, p1);
        Match off = fixtures.match(w, w.juniorsTeam(), null, now.plus(Duration.ofDays(3)), false, null);
        fixtures.side(off, w.juniorsTeam(), false, p6);
        return new Seeded(w, other, p3, p4);
    }

    private MockHttpServletRequestBuilder request(String url, UUID clubId, JwtRequestPostProcessor caller, String... params) {
        MockHttpServletRequestBuilder request = get(url, clubId).with(caller);
        for (int i = 0; i < params.length; i += 2) {
            request = request.param(params[i], params[i + 1]);
        }
        return request;
    }

    private JsonNode summary(JwtRequestPostProcessor caller, UUID clubId, String... params) throws Exception {
        String body = mockMvc.perform(request(PLAYERS + "/summary", clubId, caller, params))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(body);
    }

    private int listSize(JwtRequestPostProcessor caller, UUID clubId, String... params) throws Exception {
        String body = mockMvc.perform(request(PLAYERS, clubId, caller, params))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(body).size();
    }

    private static String[] with(String[] base, String... extra) {
        String[] merged = new String[base.length + extra.length];
        System.arraycopy(base, 0, merged, 0, base.length);
        System.arraycopy(extra, 0, merged, base.length, extra.length);
        return merged;
    }

    @Test
    void countsTheDefinitionsForAClubAdmin() throws Exception {
        Seeded s = seed();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(s.w());
        String season = s.w().season().getId().toString();
        UUID clubId = s.w().club().getId();

        // without suspended and rejected players: P1, P2, P3, P6
        JsonNode hidden = summary(admin, clubId, "includeInactive", "false", "seasonId", season);
        assertThat(hidden.path("playersShown").asLong()).isEqualTo(4);
        assertThat(hidden.path("inSquad").asLong()).isEqualTo(3); // P1, P2, P6
        assertThat(hidden.path("selected").asLong()).isEqualTo(1); // P1; P6's match is deactivated
        assertThat(hidden.path("unverified").asLong()).isEqualTo(1); // P3

        JsonNode everyone = summary(admin, clubId, "seasonId", season);
        assertThat(everyone.path("playersShown").asLong()).isEqualTo(6);
        assertThat(everyone.path("inSquad").asLong()).isEqualTo(3);
        assertThat(everyone.path("selected").asLong()).isEqualTo(1);
        assertThat(everyone.path("unverified").asLong()).isEqualTo(1);

        // no season: the two season figures are 0
        JsonNode noSeason = summary(admin, clubId, "includeInactive", "false");
        assertThat(noSeason.path("playersShown").asLong()).isEqualTo(4);
        assertThat(noSeason.path("inSquad").asLong()).isZero();
        assertThat(noSeason.path("selected").asLong()).isZero();
    }

    @Test
    void eachCounterEqualsTheListSizeForTheSameFilters() throws Exception {
        Seeded s = seed();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(s.w());
        UUID clubId = s.w().club().getId();
        String season = s.w().season().getId().toString();

        String[][] filters = {
            {},
            {"sectionId", s.w().seniors().getId().toString()},
            {"sectionId", s.w().juniors().getId().toString()},
        };
        for (String[] filter : filters) {
            for (String includeInactive : new String[] {"true", "false"}) {
                String[] base = with(filter, "includeInactive", includeInactive);
                JsonNode counters = summary(admin, clubId, with(base, "seasonId", season));
                String label = String.join(",", base);

                assertThat(listSize(admin, clubId, base)).as("shown %s", label).isEqualTo(counters.path("playersShown").asInt());
                assertThat(listSize(admin, clubId, with(base, "focus", "in-squad", "seasonId", season)))
                        .as("in-squad %s", label).isEqualTo(counters.path("inSquad").asInt());
                assertThat(listSize(admin, clubId, with(base, "focus", "selected", "seasonId", season)))
                        .as("selected %s", label).isEqualTo(counters.path("selected").asInt());
                assertThat(listSize(admin, clubId, with(base, "focus", "unverified")))
                        .as("unverified %s", label).isEqualTo(counters.path("unverified").asInt());
            }
        }
    }

    @Test
    void aSectionManagerOnlySeesTheirOwnSectionsPlayers() throws Exception {
        Seeded s = seed();
        UUID clubId = s.w().club().getId();
        JwtRequestPostProcessor juniors = fixtures.sectionManager(s.w().juniors());
        String season = s.w().season().getId().toString();

        JsonNode everyone = summary(juniors, clubId, "seasonId", season);
        assertThat(everyone.path("playersShown").asLong()).isEqualTo(2); // P5, P6
        JsonNode active = summary(juniors, clubId, "includeInactive", "false", "seasonId", season);
        assertThat(active.path("playersShown").asLong()).isEqualTo(1); // P6
        assertThat(active.path("unverified").asLong()).isZero(); // the unverified player is a Seniors one
        assertThat(listSize(juniors, clubId, "includeInactive", "false")).isEqualTo(1);
    }

    @Test
    void anotherClubsAdminIsForbidden() throws Exception {
        Seeded s = seed();

        mockMvc.perform(request(PLAYERS + "/summary", s.w().club().getId(), fixtures.clubAdmin(s.other())))
                .andExpect(status().isForbidden());
        mockMvc.perform(request(PLAYERS, s.w().club().getId(), fixtures.clubAdmin(s.other()), "focus", "unverified"))
                .andExpect(status().isForbidden());
    }

    @Test
    void badFocusAndASeasonFocusWithoutASeasonAreA400AndTheDtoCarriesTheStatus() throws Exception {
        Seeded s = seed();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(s.w());
        UUID clubId = s.w().club().getId();

        mockMvc.perform(request(PLAYERS, clubId, admin, "focus", "everyone")).andExpect(status().isBadRequest());
        mockMvc.perform(request(PLAYERS, clubId, admin, "focus", "in-squad")).andExpect(status().isBadRequest());
        mockMvc.perform(request(PLAYERS, clubId, admin, "focus", "unverified"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].verificationStatus").value("UNVERIFIED"));
        // a manager-created player and every untouched one is verified
        String visible = mockMvc.perform(request(PLAYERS, clubId, admin, "includeInactive", "false"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        int verified = 0;
        for (JsonNode player : objectMapper.readTree(visible)) {
            if ("VERIFIED".equals(player.path("verificationStatus").asText())) {
                verified++;
            }
        }
        assertThat(verified).isEqualTo(3); // P1, P2, P6; P3 is the unverified one
    }

    @Test
    void verifyAndRejectFollowTheAllowedTransitionsAndScopeToTheCallersSections() throws Exception {
        Seeded s = seed();
        UUID clubId = s.w().club().getId();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(s.w());
        UUID waiting = s.unverified().getId();

        // a Juniors manager cannot act on a Seniors player
        mockMvc.perform(post(PLAYERS + "/{playerId}/reject", clubId, waiting).with(fixtures.sectionManager(s.w().juniors())))
                .andExpect(status().isForbidden());
        // another club's admin is shut out
        mockMvc.perform(post(PLAYERS + "/{playerId}/verify", clubId, waiting).with(fixtures.clubAdmin(s.other())))
                .andExpect(status().isForbidden());

        mockMvc.perform(post(PLAYERS + "/{playerId}/reject", clubId, waiting).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verificationStatus").value("REJECTED"));
        // a rejected player cannot be rejected again, but can be verified (undo)
        mockMvc.perform(post(PLAYERS + "/{playerId}/reject", clubId, waiting).with(admin)).andExpect(status().isConflict());
        mockMvc.perform(post(PLAYERS + "/{playerId}/verify", clubId, waiting).with(admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verificationStatus").value("VERIFIED"));
        // a verified player cannot be verified or rejected
        mockMvc.perform(post(PLAYERS + "/{playerId}/verify", clubId, waiting).with(admin)).andExpect(status().isConflict());
        mockMvc.perform(post(PLAYERS + "/{playerId}/reject", clubId, waiting).with(admin)).andExpect(status().isConflict());
        // unknown id
        mockMvc.perform(post(PLAYERS + "/{playerId}/verify", clubId, UUID.randomUUID()).with(admin))
                .andExpect(status().isNotFound());
        // the counters moved with it
        assertThat(summary(admin, clubId, "includeInactive", "false").path("unverified").asLong()).isZero();
    }

    @Test
    void aRejectedPlayerLeavesTheDefaultListAndComesBackWithTheSwitch() throws Exception {
        Seeded s = seed();
        JwtRequestPostProcessor admin = fixtures.clubAdmin(s.w());
        UUID clubId = s.w().club().getId();

        assertThat(listSize(admin, clubId, "includeInactive", "false")).isEqualTo(4);
        assertThat(listSize(admin, clubId, "includeInactive", "true")).isEqualTo(6);
        // the original rejected player is among the hidden ones
        String everyone = mockMvc.perform(request(PLAYERS, clubId, admin)).andReturn().getResponse().getContentAsString();
        assertThat(everyone).contains(s.rejected().getId().toString());
    }
}
