package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Person;
import com.cricketlegend.dto.PlayerStatsDto;
import com.cricketlegend.dto.TeamStatsDto;
import com.cricketlegend.service.PlayerStatsService;
import com.cricketlegend.service.TeamStatsService;
import com.cricketlegend.service.support.StatsScope;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/147 Test Plan: the Player Hub stats show flagged published results only (a published result switched off, a
 * draft and an unpublished one are absent from My stats, the match drill, Team stats and other players' leaderboard
 * figures), and the numbers are the manager figures: parity with {@code PlayerStatsService}, {@code TeamStatsService}, the
 * Results summary, the drill rows and the leaderboard. Not transactional (the seed commits).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MePlayerStatsDataIntegrationTest extends AbstractHubStatsIntegrationTest {

    @Autowired private PlayerStatsService playerStatsService;
    @Autowired private TeamStatsService teamStatsService;

    private final Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

    private Person bea;
    private String bobKey;

    @BeforeEach
    void fixture() {
        seedHubFixture(true);
        bea = newAccount("Bea", "Parent");
        bobKey = hold(bea, seed.bob).getId().toString();
    }

    private JsonNode read(String k, String path, Person who) throws Exception {
        return json(mockMvc.perform(get(BASE + path, k).with(as(who))).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString());
    }

    private JsonNode tree(Object value) throws Exception {
        return objectMapper.readTree(objectMapper.writeValueAsString(value));
    }

    /** The flag of the one result in which this player's batting row scored exactly this. */
    private void setFlagOfResultWithBatterScore(UUID profileId, int runs, boolean flag) {
        List<UUID> ids = jdbc.queryForList("select distinct mi.match_result_id from batting_entry be"
                + " join match_innings mi on mi.id = be.match_innings_id"
                + " join result_player rp on rp.id = be.result_player_id"
                + " where rp.player_profile_id = ? and be.runs = ?",
                UUID.class, profileId, runs);
        assertThat(ids).as("a result in which the player scored " + runs).hasSize(1);
        jdbc.update("update match_result set visible_to_players = ? where id = ?", flag, ids.get(0));
    }

    // ---- flagged results only ----

    @Test
    void aSwitchedOffResultADraftAndAnUnpublishedResultAreAbsentFromMyStatsAndTheDrill() throws Exception {
        // Bob: a flagged draft (200), an unpublished result (77), a forfeit and two matches with no ball are never counted;
        // a no-result with play (10) and a win (11 not out) are; and a bowling-only abandoned match (6 balls).
        seed.setStatus(seed.unpublishMatch, "DRAFT");
        JsonNode all = read(bobKey, "/stats", bea);
        assertThat(all.at("/batting/runs").asLong()).isEqualTo(21);
        assertThat(all.at("/basis/resultsCounted").asLong()).isEqualTo(3);

        JsonNode drill = read(bobKey, "/stats/innings?kind=BATTING&size=100", bea);
        assertThat(drill.at("/page/totalElements").asLong()).isEqualTo(2);
        List<Integer> scores = new ArrayList<>();
        drill.get("rows").forEach(r -> scores.add(r.at("/batting/runs").asInt()));
        assertThat(scores).containsExactlyInAnyOrder(10, 11);

        // switch the win off: it vanishes from the figures, the drill and the matches drill
        setFlagOfResultWithBatterScore(seed.bob.getId(), 11, false);
        JsonNode after = read(bobKey, "/stats", bea);
        assertThat(after.at("/batting/runs").asLong()).isEqualTo(10);
        assertThat(after.at("/basis/resultsCounted").asLong()).isEqualTo(2);
        assertThat(read(bobKey, "/stats/innings?kind=BATTING", bea).at("/page/totalElements").asLong()).isEqualTo(1);
        assertThat(read(bobKey, "/stats/innings?kind=MATCHES", bea).at("/page/totalElements").asLong()).isEqualTo(2);
        assertThat(after.at("/series/battingInnings").size()).isEqualTo(1);
        assertThat(after.at("/rolling/points").size()).isEqualTo(1);
    }

    @Test
    void aPlayerWithEveryResultSwitchedOffHasEmptyFiguresNotAnError() throws Exception {
        jdbc.update("update match_result set visible_to_players = false where club_id = ?", seed.w.club().getId());
        JsonNode stats = read(key, "/stats", parent);
        assertThat(stats.at("/basis/resultsCounted").asLong()).isZero();
        assertThat(stats.at("/batting/runs").asLong()).isZero();
        assertThat(stats.at("/batting/average").isNull()).isTrue();
        assertThat(stats.at("/bands").size()).isEqualTo(4);
        assertThat(read(key, "/stats/innings?kind=BATTING", parent).at("/page/totalElements").asLong()).isZero();
        assertThat(read(key, "/stats/innings?kind=BATTING", parent).at("/rows").size()).isZero();
        assertThat(read(key, "/leaderboards/batting", parent).at("/rows").size()).isZero();
        JsonNode standing = read(key, "/leaderboards/standing", parent);
        assertThat(standing.at("/lines").size()).isEqualTo(8);
    }

    @Test
    void otherPlayersLeaderboardFiguresAlsoCountFlaggedPublishedResultsOnly() throws Exception {
        seed.setStatus(seed.unpublishMatch, "DRAFT");
        String path = "/leaderboards/batting?sort=runs&direction=desc&size=100&seasonId=" + seed.s1.getId() + "&leagueId="
                + seed.l1.getId();
        assertThat(rowRuns(read(key, path, parent), "Bob")).isEqualTo(21);

        setFlagOfResultWithBatterScore(seed.bob.getId(), 11, false);
        assertThat(rowRuns(read(key, path, parent), "Bob")).isEqualTo(10);

        jdbc.update("update match_result set visible_to_players = false where club_id = ?", seed.w.club().getId());
        assertThat(read(key, path, parent).at("/rows").size()).isZero();
    }

    private static long rowRuns(JsonNode table, String firstName) {
        for (JsonNode row : table.get("rows")) {
            if (firstName.equals(row.get("firstName").asText())) {
                return row.at("/values/runs/value").asLong();
            }
        }
        throw new AssertionError(firstName + " is not in the table");
    }

    @Test
    void teamStatsCountOnlyFlaggedPublishedResultsAndMatchTheManagerFigureForAnAllFlaggedScope() throws Exception {
        UUID team = seed.w.seniors1().getId();
        String path = "/team-stats?teamId=" + team;
        TeamStatsDto manager = teamStatsService.team(admin, seed.w.club().getId(), team, null, null, null);
        JsonNode hub = read(bobKey, path, bea);
        // everything published is flagged, so the Hub equals the manager's figure; the flagged draft is in neither
        assertThat(hub.at("/basis/resultsCounted").asLong()).isEqualTo(manager.basis().resultsCounted());
        assertThat(hub.get("record")).isEqualTo(tree(manager.record()));
        assertThat(hub.get("batting")).isEqualTo(tree(manager.batting()));
        assertThat(hub.get("bowling")).isEqualTo(tree(manager.bowling()));
        assertThat(hub.get("chasing")).isEqualTo(tree(manager.chasing()));
        assertThat(hub.get("extras")).isEqualTo(tree(manager.extras()));
        assertThat(hub.get("netRunRate")).isEqualTo(tree(manager.netRunRate()));

        // an unpublished result leaves both; a switched-off result leaves only the Hub
        long before = manager.basis().resultsCounted();
        seed.setStatus(seed.unpublishMatch, "DRAFT");
        assertThat(read(bobKey, path, bea).at("/basis/resultsCounted").asLong()).isEqualTo(before - 1);
        assertThat(teamStatsService.team(admin, seed.w.club().getId(), team, null, null, null).basis().resultsCounted())
                .isEqualTo(before - 1);

        setFlagOfResultWithBatterScore(seed.bob.getId(), 11, false);
        assertThat(read(bobKey, path, bea).at("/basis/resultsCounted").asLong()).isEqualTo(before - 2);
        assertThat(teamStatsService.team(admin, seed.w.club().getId(), team, null, null, null).basis().resultsCounted())
                .isEqualTo(before - 1);
    }

    // ---- parity ----

    private record Scope(String name, UUID season, UUID league, UUID team, String competition) {
        String query() {
            List<String> parts = new ArrayList<>();
            if (season != null) {
                parts.add("seasonId=" + season);
            }
            if (league != null) {
                parts.add("leagueId=" + league);
            }
            if (team != null) {
                parts.add("teamId=" + team);
            }
            if (competition != null) {
                parts.add("competition=" + competition);
            }
            return String.join("&", parts);
        }

        StatsScope.Competition comp() {
            return competition == null ? null : StatsScope.Competition.valueOf(competition);
        }
    }

    private List<Scope> scopes() {
        return List.of(
                new Scope("career", null, null, null, null),
                new Scope("season 1", seed.s1.getId(), null, null, null),
                new Scope("season 2", seed.s2.getId(), null, null, null),
                new Scope("league 1", null, seed.l1.getId(), null, null),
                new Scope("season 1 league 1", seed.s1.getId(), seed.l1.getId(), null, null),
                new Scope("team seniors 1", null, null, seed.w.seniors1().getId(), null),
                new Scope("friendly", null, null, null, "FRIENDLY"),
                new Scope("league games", null, null, null, "LEAGUE"));
    }

    @Test
    void theStatsBlocksEqualPlayerStatsServiceAndTheResultsSummaryForEveryScope() throws Exception {
        int checked = 0;
        for (Scope s : scopes()) {
            String q = s.query();
            JsonNode hub = read(key, "/stats" + (q.isEmpty() ? "" : "?" + q), parent);
            PlayerStatsDto manager = playerStatsService.getForHeldPlayer(
                    seed.w.club().getId(), seed.alice.getId(), s.season(), s.league(), s.team(), s.comp());

            assertThat(hub.get("batting")).as(s.name() + " batting").isEqualTo(tree(manager.batting()));
            assertThat(hub.get("bowling")).as(s.name() + " bowling").isEqualTo(tree(manager.bowling()));
            assertThat(hub.get("fielding")).as(s.name() + " fielding").isEqualTo(tree(manager.fielding()));
            assertThat(hub.get("awards")).as(s.name() + " awards").isEqualTo(tree(manager.awards()));
            assertThat(hub.get("record")).as(s.name() + " record").isEqualTo(tree(manager.record()));
            assertThat(hub.get("form")).as(s.name() + " form").isEqualTo(tree(manager.form()));
            assertThat(hub.at("/basis/resultsCounted").asLong()).isEqualTo(manager.basis().matchesCounted());
            assertThat(hub.at("/basis/resultsWithBattingCard").asLong()).isEqualTo(manager.basis().resultsWithBattingCard());
            assertThat(hub.at("/basis/resultsWithBowlingCard").asLong()).isEqualTo(manager.basis().resultsWithBowlingCard());

            JsonNode summary = read(key, "/results/summary" + (q.isEmpty() ? "" : "?" + q), parent);
            assertThat(summary.get("matches").asLong()).as(s.name() + " matches").isEqualTo(hub.at("/basis/resultsCounted").asLong());
            assertThat(summary.get("runs").asLong()).as(s.name() + " runs").isEqualTo(hub.at("/batting/runs").asLong());
            assertThat(summary.get("wickets").asLong()).as(s.name() + " wickets").isEqualTo(hub.at("/bowling/wickets").asLong());
            assertThat(summary.get("catches").asLong()).as(s.name() + " catches").isEqualTo(hub.at("/fielding/catches").asLong());
            assertThat(summary.get("won").asLong()).isEqualTo(hub.at("/record/won").asLong());
            assertThat(summary.get("lost").asLong()).isEqualTo(hub.at("/record/lost").asLong());
            assertThat(summary.get("playerOfTheMatch").asLong()).isEqualTo(hub.at("/awards/playerOfTheMatch").asLong());
            checked++;
        }
        assertThat(checked).isEqualTo(scopes().size());
        // non-vacuous: Alice has five results, 187 runs and a hundred in her career
        JsonNode career = read(key, "/stats", parent);
        assertThat(career.at("/basis/resultsCounted").asLong()).isEqualTo(5);
        assertThat(career.at("/batting/runs").asLong()).isEqualTo(187);
        assertThat(career.at("/summary/matchesPlayed").asLong()).isEqualTo(5);
    }

    @Test
    void theDrillRowsAddUpToTheFiguresTheyExplain() throws Exception {
        for (Scope s : scopes()) {
            String q = s.query().isEmpty() ? "" : "&" + s.query();
            JsonNode stats = read(key, "/stats" + (q.isEmpty() ? "" : "?" + q.substring(1)), parent);

            // batting: one row per innings; runs add up; bands and dismissal tokens come from the payload
            JsonNode batting = read(key, "/stats/innings?kind=BATTING&size=100" + q, parent);
            assertThat(batting.at("/page/totalElements").asLong()).as(s.name()).isEqualTo(stats.at("/batting/innings").asLong());
            long runs = 0;
            for (JsonNode r : batting.get("rows")) {
                runs += r.at("/batting/runs").asLong();
            }
            assertThat(runs).as(s.name() + " runs").isEqualTo(stats.at("/batting/runs").asLong());

            for (JsonNode band : stats.get("bands")) {
                JsonNode rows = read(key, "/stats/innings?kind=BATTING&filter=" + band.get("filter").asText() + q, parent);
                assertThat(rows.at("/page/totalElements").asLong()).as(s.name() + " " + band.get("key"))
                        .isEqualTo(band.get("innings").asLong());
            }
            for (JsonNode dismissal : stats.at("/series/dismissals")) {
                JsonNode rows = read(key, "/stats/innings?kind=BATTING&filter=" + dismissal.get("filter").asText() + q, parent);
                assertThat(rows.at("/page/totalElements").asLong()).as(s.name() + " " + dismissal.get("type"))
                        .isEqualTo(dismissal.get("count").asLong());
            }
            JsonNode first = read(key, "/stats/innings?kind=BATTING&filter=FIRST_INNINGS" + q, parent);
            assertThat(first.at("/page/totalElements").asLong()).isEqualTo(stats.at("/byInningsNumber/battingFirst/innings").asLong());
            JsonNode chasing = read(key, "/stats/innings?kind=BATTING&filter=SECOND_INNINGS" + q, parent);
            assertThat(chasing.at("/page/totalElements").asLong()).isEqualTo(stats.at("/byInningsNumber/chasing/innings").asLong());

            // bowling: one row per spell, wickets add up
            JsonNode bowling = read(key, "/stats/innings?kind=BOWLING&size=100" + q, parent);
            assertThat(bowling.at("/page/totalElements").asLong()).isEqualTo(stats.at("/bowling/inningsBowled").asLong());
            long wickets = 0;
            for (JsonNode r : bowling.get("rows")) {
                wickets += r.at("/bowling/wickets").asLong();
            }
            assertThat(wickets).isEqualTo(stats.at("/bowling/wickets").asLong());

            // fielding: catches add up
            JsonNode fielding = read(key, "/stats/innings?kind=FIELDING&size=100" + q, parent);
            long catches = 0;
            for (JsonNode r : fielding.get("rows")) {
                catches += r.at("/fielding/catches").asLong();
            }
            assertThat(catches).isEqualTo(stats.at("/fielding/catches").asLong());

            // matches: one row per counted match, split by the team record threshold
            JsonNode matches = read(key, "/stats/innings?kind=MATCHES&size=100" + q, parent);
            assertThat(matches.at("/page/totalElements").asLong()).isEqualTo(stats.at("/basis/resultsCounted").asLong());
            JsonNode scored = read(key, "/stats/innings?kind=MATCHES&filter=SCORED_30_PLUS" + q, parent);
            JsonNode under = read(key, "/stats/innings?kind=MATCHES&filter=UNDER_30" + q, parent);
            assertThat(scored.at("/page/totalElements").asLong() + under.at("/page/totalElements").asLong())
                    .isLessThanOrEqualTo(matches.at("/page/totalElements").asLong());
        }
    }

    @Test
    void thePagedDrillIsTheSameRowsAsOneBigPageNewestFirst() throws Exception {
        JsonNode whole = read(key, "/stats/innings?kind=BATTING&size=100", parent);
        List<String> expected = new ArrayList<>();
        whole.get("rows").forEach(r -> expected.add(r.get("matchId").asText() + "/" + r.at("/batting/runs").asText()));
        List<String> paged = new ArrayList<>();
        for (int page = 0; page < 10; page++) {
            JsonNode p = read(key, "/stats/innings?kind=BATTING&size=2&page=" + page, parent);
            p.get("rows").forEach(r -> paged.add(r.get("matchId").asText() + "/" + r.at("/batting/runs").asText()));
            if (!p.at("/page/hasMore").asBoolean()) {
                break;
            }
        }
        assertThat(paged).isEqualTo(expected).hasSize(5);
        // newest first
        List<String> dates = new ArrayList<>();
        whole.get("rows").forEach(r -> dates.add(r.get("matchDate").asText()));
        assertThat(dates).isSortedAccordingTo(java.util.Comparator.reverseOrder());
    }

    @Test
    void teamStatsEqualTheManagerFiguresForAnAllFlaggedScope() throws Exception {
        UUID season = seed.s1.getId();
        for (UUID team : List.of(seed.w.seniors1().getId(), seed.w.seniors2().getId())) {
            for (String q : List.of("", "&seasonId=" + season, "&seasonId=" + season + "&leagueId=" + seed.l1.getId(),
                    "&competition=LEAGUE", "&competition=FRIENDLY")) {
                String c = q.contains("competition=") ? q.substring(q.indexOf("competition=") + 12) : null;
                UUID s = q.contains("seasonId=") ? season : null;
                UUID l = q.contains("leagueId=") ? seed.l1.getId() : null;
                TeamStatsDto manager = teamStatsService.team(admin, seed.w.club().getId(), team, s, l, c);
                // Alice plays for seniors1 and seniors2: a team she has a flagged result for
                JsonNode hub = read(key, "/team-stats?teamId=" + team + q, parent);
                String who = team + q;
                assertThat(hub.at("/basis/resultsCounted").asLong()).as(who).isEqualTo(manager.basis().resultsCounted());
                assertThat(hub.get("record")).as(who + " record").isEqualTo(tree(manager.record()));
                assertThat(hub.get("batting")).as(who + " batting").isEqualTo(tree(manager.batting()));
                assertThat(hub.get("bowling")).as(who + " bowling").isEqualTo(tree(manager.bowling()));
                assertThat(hub.get("chasing")).as(who + " chasing").isEqualTo(tree(manager.chasing()));
                assertThat(hub.at("/teamName").asText()).isEqualTo(manager.teamName());
            }
        }
    }

    @Test
    void aLeaderboardRowEqualsTheSamePlayersMyStatsFigure() throws Exception {
        String scope = "seasonId=" + seed.s1.getId() + "&leagueId=" + seed.l1.getId();
        JsonNode stats = read(key, "/stats?" + scope, parent);
        JsonNode batting = read(key, "/leaderboards/batting?size=100&" + scope, parent);
        JsonNode mine = null;
        for (JsonNode row : batting.get("rows")) {
            if (row.get("mine").asBoolean()) {
                mine = row;
            }
        }
        assertThat(mine).as("the held player's own row is marked").isNotNull();
        assertThat(mine.get("firstName").asText()).isEqualTo("Alice");
        assertThat(mine.at("/values/runs/value").asLong()).isEqualTo(stats.at("/batting/runs").asLong());
        assertThat(mine.at("/values/matches/value").asLong()).isEqualTo(stats.at("/batting/matches").asLong());
        assertThat(mine.at("/values/innings/value").asLong()).isEqualTo(stats.at("/batting/innings").asLong());
        assertThat(mine.at("/values/fours/value").asLong()).isEqualTo(stats.at("/batting/fours").asLong());
        assertThat(mine.at("/values/sixes/value").asLong()).isEqualTo(stats.at("/batting/sixes").asLong());
        assertThat(mine.at("/values/average/value").decimalValue()).isEqualByComparingTo(stats.at("/batting/average").decimalValue());
        assertThat(batting.at("/me/row/mine").asBoolean()).isTrue();
        // only the held player's row is marked
        long marked = 0;
        for (JsonNode row : batting.get("rows")) {
            marked += row.get("mine").asBoolean() ? 1 : 0;
        }
        assertThat(marked).isEqualTo(1);

        JsonNode bowling = read(key, "/leaderboards/bowling?size=100&" + scope, parent);
        for (JsonNode row : bowling.get("rows")) {
            if (row.get("mine").asBoolean()) {
                assertThat(row.at("/values/wickets/value").asLong()).isEqualTo(stats.at("/bowling/wickets").asLong());
            }
        }
        JsonNode fielding = read(key, "/leaderboards/fielding?size=100&" + scope, parent);
        for (JsonNode row : fielding.get("rows")) {
            if (row.get("mine").asBoolean()) {
                assertThat(row.at("/values/catches/value").asLong()).isEqualTo(stats.at("/fielding/catches").asLong());
            }
        }

        // the standing card ranks the same figures: runs 87 puts her where the table does
        JsonNode standing = read(key, "/leaderboards/standing?" + scope, parent);
        assertThat(standing.at("/lines").size()).isEqualTo(8);
        assertThat(standing.at("/lines/0/key").asText()).isEqualTo("runs");
        assertThat(standing.at("/lines/0/rank").asInt()).isEqualTo(mine.get("rank").asInt());
        assertThat(standing.at("/lines/0/value/value").asLong()).isEqualTo(stats.at("/batting/runs").asLong());
    }

    @Test
    void theLeaderboardOnlyReachesLeaguesTheHeldPlayersTeamsPlayedIn() throws Exception {
        // Alice played league 1 and league 2 (season 1); a league she never played in, in the same club, is not in her reach
        UUID otherLeague = seed.fixtures.league(seed.w, 11).getId();
        JsonNode filters = read(key, "/leaderboards/filters", parent);
        List<String> leagues = new ArrayList<>();
        filters.get("leagues").forEach(l -> leagues.add(l.get("id").asText()));
        assertThat(leagues).contains(seed.l1.getId().toString()).doesNotContain(otherLeague.toString());
    }
}
