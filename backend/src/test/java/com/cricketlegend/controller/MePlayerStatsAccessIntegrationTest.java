package com.cricketlegend.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * docs/specs/147 Test Plan, the access matrix of the Player Hub stats routes: a key that is not held, malformed or has
 * dropped out is a 404 (never a 403), a suspended caller a 403, no login a 401, another club's ids and a team that is not
 * the player's a 404, and every bad query value a 400. Not transactional (the seed commits); see
 * {@link AbstractHubStatsIntegrationTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MePlayerStatsAccessIntegrationTest extends AbstractHubStatsIntegrationTest {

    @BeforeEach
    void fixture() {
        seedHubFixture(false);
    }

    /** One route per read, with a team that is the player's own where the route needs one. */
    private List<String> routes(String k) {
        String team = seed.w.seniors1().getId().toString();
        return List.of(
                "/api/v1/me/players/" + k + "/stats",
                "/api/v1/me/players/" + k + "/stats/innings?kind=BATTING",
                "/api/v1/me/players/" + k + "/team-stats?teamId=" + team,
                "/api/v1/me/players/" + k + "/leaderboards/batting",
                "/api/v1/me/players/" + k + "/leaderboards/bowling",
                "/api/v1/me/players/" + k + "/leaderboards/fielding",
                "/api/v1/me/players/" + k + "/leaderboards/standing",
                "/api/v1/me/players/" + k + "/leaderboards/awards",
                "/api/v1/me/players/" + k + "/leaderboards/filters");
    }

    private void expectEverywhere(String k, Person who, int expected) throws Exception {
        for (String url : routes(k)) {
            mockMvc.perform(get(url).with(as(who))).andExpect(result -> {
                if (result.getResponse().getStatus() != expected) {
                    throw new AssertionError(url + " answered " + result.getResponse().getStatus() + ", expected " + expected);
                }
            });
        }
    }

    @Test
    void theHeldPlayerReadsEveryRoute() throws Exception {
        expectEverywhere(key, parent, 200);
    }

    @Test
    void noLoginIsA401OnEveryRoute() throws Exception {
        for (String url : routes(key)) {
            mockMvc.perform(get(url)).andExpect(status().isUnauthorized());
        }
    }

    @Test
    void aKeyThatIsNotHeldMalformedOrFromAnotherAccountIs404OnEveryRoute() throws Exception {
        Person stranger = newAccount("Sue", "Stranger");
        expectEverywhere(key, stranger, 404); // someone else's link id
        expectEverywhere("nonsense", parent, 404);
        expectEverywhere(UUID.randomUUID().toString(), parent, 404);
        expectEverywhere("self:" + UUID.randomUUID(), parent, 404);
        expectEverywhere("self:" + seed.alice.getId(), parent, 404); // a profile of the club, not the caller's own
        Person manager = track(clubAdmin(seed.w.club()));
        expectEverywhere(key, manager, 404); // a club manager holds no link to the player
    }

    @Test
    void aPlayerWhoHasDroppedOutIs404OnEveryRoute() throws Exception {
        jdbc.update("update player_profile set active = false where id = ?", seed.alice.getId());
        expectEverywhere(key, parent, 404);
        jdbc.update("update player_profile set active = true where id = ?", seed.alice.getId());
        expectEverywhere(key, parent, 200);
        jdbc.update("update player_profile set verification_status = 'REJECTED' where id = ?", seed.alice.getId());
        expectEverywhere(key, parent, 404);
    }

    @Test
    void aRevokedLinkIs404() throws Exception {
        jdbc.update("update person_link set status = 'REVOKED' where id = ?", link.getId());
        expectEverywhere(key, parent, 404);
    }

    @Test
    void aSuspendedCallerIs403OnEveryRoute() throws Exception {
        parent.setStatus(PersonStatus.SUSPENDED);
        personRepository.save(parent);
        expectEverywhere(key, parent, 403);
    }

    // ---- scope ids ----

    @Test
    void anotherClubsSeasonLeagueOrTeamIs404() throws Exception {
        UUID foreignSeason = seed.other.season().getId();
        UUID foreignTeam = seed.other.seniors1().getId();
        UUID foreignLeague = seed.fixtures.league(seed.other, 11).getId();
        String stats = "/api/v1/me/players/" + key;
        for (String param : List.of("seasonId=" + foreignSeason, "leagueId=" + foreignLeague, "teamId=" + foreignTeam)) {
            for (String path : List.of("/stats?", "/stats/innings?kind=BATTING&", "/leaderboards/batting?",
                    "/leaderboards/standing?", "/leaderboards/awards?")) {
                mockMvc.perform(get(stats + path + param).with(as(parent))).andExpect(status().isNotFound());
            }
        }
        for (String param : List.of("seasonId=" + foreignSeason, "leagueId=" + foreignLeague)) {
            mockMvc.perform(get(stats + "/team-stats?teamId=" + seed.w.seniors1().getId() + "&" + param).with(as(parent)))
                    .andExpect(status().isNotFound());
        }
        mockMvc.perform(get(stats + "/team-stats?teamId=" + foreignTeam).with(as(parent))).andExpect(status().isNotFound());
    }

    @Test
    void aTeamThatIsNotOneOfThePlayersTeamsIs404() throws Exception {
        UUID unrelated = seed.fixtures.team(seed.w.club(), seed.w.seniors(), "Not Alice's Team").getId();
        mockMvc.perform(get(BASE + "/team-stats?teamId=" + unrelated, key).with(as(parent))).andExpect(status().isNotFound());
        mockMvc.perform(get(BASE + "/team-stats?teamId=" + UUID.randomUUID(), key).with(as(parent)))
                .andExpect(status().isNotFound());
        // a real team of the club that the player has no flagged result for is also a 404 (Bob's, Dan's...)
        mockMvc.perform(get(BASE + "/team-stats?teamId=" + seed.w.seniors1().getId(), key).with(as(parent)))
                .andExpect(status().isOk());
    }

    @Test
    void teamStatsNeedsATeamId() throws Exception {
        mockMvc.perform(get(BASE + "/team-stats", key).with(as(parent))).andExpect(status().isBadRequest());
    }

    // ---- bad values ----

    @Test
    void aBadCompetitionIs400() throws Exception {
        String team = seed.w.seniors1().getId().toString();
        for (String path : List.of("/stats?competition=CUP", "/stats/innings?kind=BATTING&competition=CUP",
                "/team-stats?teamId=" + team + "&competition=CUP")) {
            mockMvc.perform(get(BASE + path, key).with(as(parent))).andExpect(status().isBadRequest());
        }
    }

    @Test
    void anUnknownDrillKindOrFilterIs400() throws Exception {
        for (String path : List.of(
                "/stats/innings", // no kind
                "/stats/innings?kind=",
                "/stats/innings?kind=WICKETS",
                "/stats/innings?kind=BATTING&filter=BAND_1000",
                "/stats/innings?kind=BOWLING&filter=BAND_0_9", // a filter of another kind
                "/stats/innings?kind=FIELDING&filter=WICKETS",
                "/stats/innings?kind=MATCHES&filter=CATCHES",
                "/stats/innings?kind=BATTING&page=-1",
                "/stats/innings?kind=BATTING&size=0",
                "/stats/innings?kind=BATTING&size=101")) {
            mockMvc.perform(get(BASE + path, key).with(as(parent))).andExpect(status().isBadRequest());
        }
        mockMvc.perform(get(BASE + "/stats/innings?kind=batting&filter=band_50_plus&page=0&size=100", key).with(as(parent)))
                .andExpect(status().isOk());
    }

    @Test
    void aBadLeaderboardGroupSortDirectionMinimumPageOrSizeIs400() throws Exception {
        for (String path : List.of(
                "/leaderboards/nonsense",
                "/leaderboards/awards2",
                "/leaderboards/batting?sort=nonsense",
                "/leaderboards/batting?sort=wickets", // a bowling column on the batting table
                "/leaderboards/batting?direction=sideways",
                "/leaderboards/batting?minimum=abc",
                "/leaderboards/batting?page=-1",
                "/leaderboards/batting?size=0",
                "/leaderboards/bowling?sort=runs2")) {
            mockMvc.perform(get(BASE + path, key).with(as(parent))).andExpect(status().isBadRequest());
        }
        mockMvc.perform(get(BASE + "/leaderboards/batting?sort=runs&direction=desc&page=0&size=5", key).with(as(parent)))
                .andExpect(status().isOk());
    }
}
