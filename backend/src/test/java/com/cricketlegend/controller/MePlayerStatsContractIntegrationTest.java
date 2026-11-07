package com.cricketlegend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * docs/specs/147 Test Plan: the exact JSON key sets of the Player Hub stats payloads (a key added or dropped fails here
 * until the client and {@code openapi.yaml} are updated on purpose), and that no internal id reaches a payload: the only
 * ids are match ids and the scope ids.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MePlayerStatsContractIntegrationTest extends AbstractHubStatsIntegrationTest {

    /** Field names that carry an id; everything else must not look like one. */
    private static final Set<String> ALLOWED_ID_FIELDS =
            Set.of("matchId", "seasonId", "leagueId", "teamId", "currentSeasonId", "id", "venueKey");

    @BeforeEach
    void fixture() {
        seedHubFixture(true);
        // a season that has ended, so the Awards payload is the revealed shape
        jdbc.update("update season set start_date = '2020-01-01', end_date = '2020-12-31' where id = ?", seed.s1.getId());
    }

    private JsonNode read(String path) throws Exception {
        return json(mockMvc.perform(get(BASE + path, key).with(as(parent))).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString());
    }

    private static Set<String> set(String... names) {
        return new TreeSet<>(List.of(names));
    }

    // ---- My stats ----

    @Test
    void myStatsHasExactlyTheDocumentedKeys() throws Exception {
        JsonNode stats = read("/stats");
        assertThat(keys(stats)).isEqualTo(set(
                "scope", "playerFirstName", "ageBand", "basis", "batting", "bowling", "fielding", "awards", "record", "form",
                "series", "rolling", "guides", "bands", "byInningsNumber", "byOpposition", "dismissedBy", "wicketsByPosition",
                "milestones", "teamRecordWhenScoring", "homeAway", "bySeason", "bowlingDiscipline", "availability",
                "teamFielding", "teamFieldingRank", "standing", "notCaptured", "summary", "battingPositionGroups",
                "battingVenues", "bowlingHomeAway", "bowlingVenues"));
        assertThat(keys(stats.get("scope"))).isEqualTo(set("seasonId", "leagueId", "teamId", "competition"));
        assertThat(keys(stats.get("basis"))).isEqualTo(set("resultsCounted", "resultsWithBattingCard",
                "resultsWithBowlingCard", "resultsWithFieldingCard", "fixturesRemaining", "truncated", "historyCap"));
        assertThat(keys(stats.get("series"))).isEqualTo(set("window", "battingInnings", "battingSummary", "dismissals",
                "battingTrend", "bowlingMatches", "wicketTypes", "economySummary"));
        assertThat(keys(stats.at("/series/battingInnings/0"))).isEqualTo(set(
                "matchId", "matchDate", "opponentName", "derby", "runs", "balls", "notOut", "howOut"));
        assertThat(keys(stats.at("/series/dismissals/0"))).isEqualTo(set("type", "label", "count", "percent", "filter"));
        assertThat(keys(stats.get("rolling"))).isEqualTo(set("span", "points", "hint"));
        assertThat(keys(stats.get("guides"))).isEqualTo(set("low", "high", "basis"));
        assertThat(keys(stats.at("/bands/0"))).isEqualTo(set("key", "label", "innings", "percent", "filter"));
        assertThat(keys(stats.get("byInningsNumber"))).isEqualTo(set("battingFirst", "chasing"));
        assertThat(keys(stats.at("/byInningsNumber/battingFirst"))).isEqualTo(set("innings", "notOuts", "runs", "average", "filter"));
        assertThat(keys(stats.get("dismissedBy"))).isEqualTo(set("bowlers", "notRecorded", "total"));
        assertThat(keys(stats.get("wicketsByPosition"))).isEqualTo(set("groups", "notRecorded", "total", "caughtBy"));
        assertThat(keys(stats.get("milestones"))).isEqualTo(set("runs", "wickets", "catches", "personalBests"));
        assertThat(keys(stats.at("/milestones/runs"))).isEqualTo(set("current", "target", "toGo"));
        assertThat(keys(stats.at("/milestones/personalBests"))).isEqualTo(set(
                "highestScore", "bestBowling", "mostCatches", "bestStrikeRate", "minimumBalls"));
        assertThat(keys(stats.get("teamRecordWhenScoring"))).isEqualTo(set(
                "threshold", "scored", "notScored", "scoredFilter", "notScoredFilter"));
        assertThat(keys(stats.at("/teamRecordWhenScoring/scored"))).isEqualTo(set(
                "matches", "won", "lost", "tied", "drawn", "winPercent"));
        assertThat(keys(stats.get("homeAway"))).isEqualTo(set("home", "away", "unknownFieldMatches"));
        assertThat(keys(stats.at("/homeAway/home"))).isEqualTo(set("innings", "dismissals", "runs", "average"));
        assertThat(keys(stats.at("/bySeason/0"))).isEqualTo(set("seasonId", "label", "matches", "innings", "runs", "average", "wickets"));
        assertThat(keys(stats.get("bowlingDiscipline"))).isEqualTo(set(
                "wides", "noBalls", "widesPerOver", "noBallsPerOver", "inningsRecorded", "inningsCounted", "byInnings"));
        assertThat(keys(stats.get("availability"))).isEqualTo(set(
                "pollsTotal", "pollsAnswered", "answeredAvailable", "matchesSelected", "matchesPlayed"));
        assertThat(keys(stats.get("teamFielding"))).isEqualTo(set("catches", "runOuts", "stumpings"));
        assertThat(keys(stats.get("summary"))).isEqualTo(set("leaguesPlayed", "teamsRepresented", "matchesPlayed",
                "runsScored", "ballsFaced", "ballsBowled", "ballsPerOver", "catchesTaken"));
        assertThat(keys(stats.at("/summary/leaguesPlayed/0"))).isEqualTo(set("leagueId", "name", "matches"));
        assertThat(keys(stats.at("/summary/teamsRepresented/0"))).isEqualTo(set("teamId", "name", "matches"));
        assertThat(keys(stats.at("/battingPositionGroups/0"))).isEqualTo(set(
                "key", "label", "innings", "runs", "notOuts", "dismissals", "average", "highest"));
        assertThat(keys(stats.at("/battingVenues/0"))).isEqualTo(set(
                "venueKey", "name", "home", "innings", "notOuts", "dismissals", "runs", "average"));
        assertThat(keys(stats.get("bowlingHomeAway"))).isEqualTo(set("home", "away", "unknownVenueSpells"));
        assertThat(keys(stats.at("/bowlingHomeAway/home"))).isEqualTo(set(
                "spells", "balls", "ballsPerOver", "maidens", "runs", "wickets", "economy", "average"));
        // non-vacuous: the payload under test carries the rows the nested assertions look at
        assertThat(stats.get("bands")).hasSize(4);
        assertThat(stats.get("bySeason")).isNotEmpty();
        assertThat(stats.get("battingPositionGroups")).isNotEmpty();
    }

    @Test
    void theMatchDrillHasExactlyTheDocumentedKeys() throws Exception {
        JsonNode page = read("/stats/innings?kind=BATTING");
        assertThat(keys(page)).isEqualTo(set("kind", "filter", "title", "filterLabel", "truncated", "page", "rows"));
        assertThat(keys(page.get("page"))).isEqualTo(set("number", "size", "totalElements", "hasMore"));
        assertThat(keys(page.at("/rows/0"))).isEqualTo(set(
                "matchId", "matchDate", "opponentName", "derby", "ourTeamName", "result", "batting", "bowling", "fielding"));
        assertThat(keys(page.at("/rows/0/batting"))).isEqualTo(set(
                "inningsNumber", "runs", "balls", "fours", "sixes", "notOut", "howOut", "bowlerName", "strikeRate"));
        JsonNode bowling = read("/stats/innings?kind=BOWLING");
        assertThat(keys(bowling.at("/rows/0/bowling"))).isEqualTo(set(
                "balls", "ballsPerOver", "maidens", "runs", "wickets", "economy", "wides", "noBalls", "dots"));
        JsonNode fielding = read("/stats/innings?kind=FIELDING");
        assertThat(keys(fielding.at("/rows/0/fielding"))).isEqualTo(set("catches", "stumpings", "runOuts"));
    }

    // ---- Team stats ----

    @Test
    void teamStatsHasExactlyTheDocumentedKeys() throws Exception {
        JsonNode team = read("/team-stats?teamId=" + seed.w.seniors1().getId());
        assertThat(keys(team)).isEqualTo(set(
                "scope", "teamName", "basis", "record", "form", "batting", "chasing", "bowling", "extras", "netRunRate",
                "series", "contribution", "battingOrder", "tossWon", "headToHead", "squad", "closeGames", "extrasCard",
                "notCaptured", "dismissals", "battingPositionGroups", "boundaries", "venues", "wicketTypes", "fielding",
                "byInningsNumber"));
        assertThat(keys(team.get("scope"))).isEqualTo(set("seasonId", "leagueId", "teamId", "competition"));
        assertThat(keys(team.get("basis"))).isEqualTo(set("resultsCounted", "internalResults", "resultsNoBallBowled",
                "forfeits", "resultsWithBothInnings", "truncated", "historyCap", "coverage"));
        assertThat(keys(team.at("/basis/coverage"))).isEqualTo(set(
                "battingOrder", "toss", "availability", "runCards", "wicketCards", "closeMargins"));
        assertThat(keys(team.at("/form/0"))).isEqualTo(set("matchId", "matchDate", "opponentName", "derby", "result", "forfeit"));
        assertThat(keys(team.get("series"))).isEqualTo(set("window", "results", "resultsSummary", "runRateTrend",
                "netRunRateTrend", "extrasConceded", "extrasSummary", "dotBalls", "dotBallsSummary"));
        assertThat(keys(team.at("/series/results/0"))).isEqualTo(set("matchId", "matchDate", "opponentName", "derby", "forfeit",
                "result", "ownRuns", "ownWickets", "ownBalls", "oppRuns", "oppWickets", "oppBalls", "ownRunRate", "oppRunRate"));
        assertThat(keys(team.get("contribution"))).isEqualTo(set("runs", "wickets"));
        assertThat(keys(team.at("/contribution/runs"))).isEqualTo(set("total", "lines", "inningsWithCard", "inningsCounted"));
        assertThat(keys(team.get("battingOrder"))).isEqualTo(set("battingFirst", "chasing", "recorded", "counted"));
        assertThat(keys(team.get("tossWon"))).isEqualTo(set("won", "known", "counted", "partly"));
        assertThat(keys(team.get("squad"))).isEqualTo(set(
                "playersUsed", "guestAppearances", "averageAvailable", "matchesWithPoll", "counted", "partly"));
        assertThat(keys(team.get("closeGames"))).isEqualTo(set("played", "won", "closeRuns", "closeWickets", "decided", "withMargin"));
        assertThat(keys(team.get("extrasCard"))).isEqualTo(set("gaveAway", "received", "partly"));
        assertThat(keys(team.get("dismissals"))).isEqualTo(set("notOut", "wickets", "types", "notRecorded", "coverage"));
        assertThat(keys(team.get("boundaries"))).isEqualTo(set(
                "fours", "sixes", "boundaryRuns", "boundaryPercent", "ballsPerBoundary", "inningsRecorded", "inningsCounted"));
        assertThat(keys(team.get("wicketTypes"))).isEqualTo(set("total", "types", "notItemised", "coverage"));
        assertThat(keys(team.get("fielding"))).isEqualTo(set(
                "catches", "stumpings", "runOuts", "dismissals", "dismissalsPerMatch", "byFielder", "others", "coverage"));
        assertThat(keys(team.get("byInningsNumber"))).isEqualTo(set("first", "chasing"));
        assertThat(keys(team.at("/byInningsNumber/first"))).isEqualTo(set("played", "won", "innings", "runs", "average"));
        if (team.get("headToHead").size() > 0) {
            assertThat(keys(team.at("/headToHead/0"))).isEqualTo(set(
                    "opponentName", "played", "won", "lost", "tied", "drawn", "noResult", "results"));
            assertThat(keys(team.at("/headToHead/0/results/0"))).isEqualTo(set("matchId", "matchDate", "result", "forfeit"));
        }
        assertThat(team.get("series").get("results")).isNotEmpty();
    }

    // ---- Leaderboards ----

    @Test
    void theLeaderboardTableHasExactlyTheDocumentedKeys() throws Exception {
        JsonNode table = read("/leaderboards/batting");
        assertThat(keys(table)).isEqualTo(set("group", "columns", "sort", "scope", "minimum", "basis", "page", "rows", "me"));
        assertThat(keys(table.at("/columns/0"))).isEqualTo(set(
                "code", "label", "longLabel", "sortable", "direction", "minimumKind", "more"));
        assertThat(keys(table.get("scope"))).isEqualTo(set("seasonId", "leagueId", "teamId"));
        assertThat(keys(table.get("sort"))).isEqualTo(set("code", "direction"));
        assertThat(keys(table.get("minimum"))).isEqualTo(set("applies", "value", "suggestedDefault", "unit"));
        assertThat(keys(table.get("basis"))).isEqualTo(set(
                "resultsCounted", "playersListed", "playersRanked", "belowMinimum", "coverage"));
        assertThat(keys(table.get("page"))).isEqualTo(set("number", "size", "totalElements", "hasMore"));
        assertThat(keys(table.at("/rows/0"))).isEqualTo(set(
                "rank", "mine", "firstName", "lastName", "teamName", "smallSample", "values"));
        assertThat(keys(table.get("me"))).isEqualTo(set("position", "page", "row"));
        assertThat(table.get("rows")).isNotEmpty();
        // the folded columns are flagged by the server
        List<String> more = new java.util.ArrayList<>();
        table.get("columns").forEach(c -> {
            if (c.get("more").asBoolean()) {
                more.add(c.get("code").asText());
            }
        });
        assertThat(more).containsExactlyInAnyOrder("balls", "strikeRate", "outs", "hundredPlus");
    }

    @Test
    void theStandingFiltersAndAwardsHaveExactlyTheDocumentedKeys() throws Exception {
        JsonNode standing = read("/leaderboards/standing");
        assertThat(keys(standing)).isEqualTo(set("scope", "playerFirstName", "resultsCounted", "playersInReach", "lines"));
        assertThat(keys(standing.get("scope"))).isEqualTo(set("seasonId", "leagueId", "teamId"));
        assertThat(keys(standing.at("/lines/0"))).isEqualTo(set(
                "key", "group", "label", "rank", "playersListed", "playersRanked", "value", "sample", "minimum", "belowMinimum"));
        assertThat(keys(standing.at("/lines/0/sample"))).isEqualTo(set(
                "matches", "innings", "ballsFaced", "balls", "overs", "ballsPerOver"));
        assertThat(keys(standing.at("/lines/1/minimum"))).isEqualTo(set("unit", "value"));
        assertThat(standing.get("lines")).hasSize(8);

        JsonNode filters = read("/leaderboards/filters");
        assertThat(keys(filters)).isEqualTo(set("currentSeasonId", "seasons", "teams", "leagues", "combos"));
        assertThat(keys(filters.at("/seasons/0"))).isEqualTo(set("id", "name"));
        assertThat(keys(filters.at("/combos/0"))).isEqualTo(set("seasonId", "leagueId", "teamId"));

        JsonNode awards = read("/leaderboards/awards?seasonId=" + seed.s1.getId());
        assertThat(keys(awards)).isEqualTo(set(
                "scope", "revealed", "reason", "message", "seasonEndDate", "basis", "minimums", "categories", "omitted"));
        assertThat(awards.get("revealed").asBoolean()).as("the season ended in 2020").isTrue();
        assertThat(keys(awards.at("/categories/0"))).isEqualTo(set("board", "leaders"));
        assertThat(keys(awards.at("/categories/0/leaders/0"))).isEqualTo(set(
                "rank", "mine", "firstName", "lastName", "figure", "matches", "innings", "sample", "smallSample", "detail"));
    }

    @Test
    void awardsOfASeasonThatHasNotEndedAreHeldBackWithTheReasonOnly() throws Exception {
        jdbc.update("update season set start_date = '2020-01-01', end_date = '2999-12-31' where id = ?", seed.s1.getId());
        JsonNode awards = read("/leaderboards/awards?seasonId=" + seed.s1.getId());
        assertThat(awards.get("revealed").asBoolean()).isFalse();
        assertThat(awards.get("reason").asText()).isEqualTo("SEASON_NOT_ENDED");
        assertThat(awards.get("message").asText()).isNotBlank();
        assertThat(awards.get("seasonEndDate").asText()).isEqualTo("2999-12-31");
        assertThat(awards.get("categories")).isEmpty();
        assertThat(keys(awards)).isEqualTo(set(
                "scope", "revealed", "reason", "message", "seasonEndDate", "basis", "minimums", "categories", "omitted"));
    }

    // ---- no internal ids ----

    @Test
    void noPayloadCarriesAnInternalIdOnlyMatchAndScopeIds() throws Exception {
        Set<String> internal = internalIds();
        String team = seed.w.seniors1().getId().toString();
        List<String> paths = List.of(
                "/stats", "/stats?seasonId=" + seed.s1.getId() + "&leagueId=" + seed.l1.getId(),
                "/stats/innings?kind=BATTING", "/stats/innings?kind=BOWLING", "/stats/innings?kind=FIELDING",
                "/stats/innings?kind=MATCHES", "/team-stats?teamId=" + team, "/leaderboards/batting",
                "/leaderboards/bowling", "/leaderboards/fielding", "/leaderboards/standing",
                "/leaderboards/awards?seasonId=" + seed.s1.getId(), "/leaderboards/filters");
        int scanned = 0;
        for (String path : paths) {
            JsonNode body = read(path);
            for (String name : allFieldNames(body)) {
                boolean looksLikeId = name.equals("id") || name.endsWith("Id") || name.endsWith("Ids");
                if (looksLikeId) {
                    assertThat(ALLOWED_ID_FIELDS).as(path + " field " + name).contains(name);
                }
                assertThat(name).as(path).isNotIn("playerId", "personId", "clubId", "resultId", "resultPlayerId", "inningsId",
                        "profileId", "playerProfileId", "accountId", "email", "phone", "dateOfBirth");
            }
            Set<String> texts = allTextValues(body);
            for (String forbidden : internal) {
                assertThat(texts).as(path + " must not contain internal id " + forbidden).doesNotContain(forbidden);
            }
            scanned += texts.size();
        }
        assertThat(scanned).as("non-vacuous: values were scanned").isGreaterThan(200);
        assertThat(internal).as("non-vacuous: ids to look for").hasSizeGreaterThan(20);
    }
}
