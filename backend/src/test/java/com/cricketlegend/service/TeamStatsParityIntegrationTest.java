package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.PlayerStatsDto;
import com.cricketlegend.dto.TeamStatsDto;
import com.cricketlegend.dto.TeamStatsTableDto;
import com.cricketlegend.dto.TeamStatsTableDto.TeamStatsCell;
import com.cricketlegend.dto.TeamStatsTableDto.TeamStatsTableRow;
import com.cricketlegend.support.PlayerStatsSeed;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/116-team-stats.md, "Parity test": every cell of the team table equals the same team's page figure for the
 * same filters. The table and the page are two read paths over the same counters; this fails when a counting rule or a
 * definition makes them drift. Also the sum checks against what the seed was built with and the cross-check against the
 * player record of 103 and the match list of 115. Not {@code @Transactional}.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class TeamStatsParityIntegrationTest {

    @Autowired
    private TeamStatsService teamStatsService;

    @Autowired
    private PlayerStatsService playerStatsService;

    @Autowired
    private PlayerMatchListService matchListService;

    @Autowired
    private ApplicationContext context;

    private PlayerStatsSeed seed;
    private UUID clubId;
    private final Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

    @BeforeEach
    void setUp() {
        seed = new PlayerStatsSeed(context);
        seed.seedMatchList();
        seed.seedTeamStats();
        clubId = seed.w.club().getId();
    }

    @AfterEach
    void cleanUp() {
        seed.cleanUp();
    }

    /** season, league, competition; any of them null for "no filter". */
    private record Filters(String name, UUID season, UUID league, String competition) {
    }

    private List<Filters> filterSets() {
        return List.of(
                new Filters("none", null, null, null),
                new Filters("season 1", seed.s1.getId(), null, null),
                new Filters("season 2", seed.s2.getId(), null, null),
                new Filters("league 1", null, seed.l1.getId(), null),
                new Filters("league 2", null, seed.l2.getId(), null),
                new Filters("league games", null, null, "LEAGUE"),
                new Filters("friendlies", null, null, "FRIENDLY"),
                new Filters("season 1, league 1", seed.s1.getId(), seed.l1.getId(), null),
                new Filters("season 2, league 1, LEAGUE", seed.s2.getId(), seed.l1.getId(), "LEAGUE"),
                new Filters("season 2 friendlies", seed.s2.getId(), null, "FRIENDLY"));
    }

    private List<Team> everyTeam() {
        return List.of(seed.w.seniors1(), seed.w.seniors2(), seed.w.juniorsTeam(), seed.gcTeam, seed.tsHawks,
                seed.tsKites, seed.tsOwls, seed.tsSwifts, seed.tsDoves, seed.tsWrens);
    }

    private TeamStatsTableDto table(Filters f, String sort) {
        return teamStatsService.table(admin, clubId, sort, null, f.season(), f.league(), null, f.competition(), null, 0, 100);
    }

    private TeamStatsDto page(Team team, Filters f) {
        return teamStatsService.team(admin, clubId, team.getId(), f.season(), f.league(), f.competition());
    }

    @Test
    void everyCellOfTheTeamTableEqualsTheTeamPageFigureForTheSameFilters() {
        int cells = 0;
        int partial = 0;
        int notShown = 0;
        int derbyRows = 0;
        for (Filters f : filterSets()) {
            Map<UUID, TeamStatsDto> pages = new LinkedHashMap<>();
            for (Team t : everyTeam()) {
                pages.put(t.getId(), page(t, f));
            }
            for (String sort : List.of("won", "runRate", "netRunRate", "bowlingAverage")) {
                TeamStatsTableDto table = table(f, sort);
                List<String> problems = new ArrayList<>();
                for (TeamStatsTableRow row : table.rows()) {
                    TeamStatsDto page = pages.get(row.teamId());
                    assertThat(page).as(f.name() + ": " + row.teamName() + " is a club team").isNotNull();
                    compare(row, page, f.name() + "/" + sort + "/" + row.teamName(), problems);
                    cells += row.values().size();
                    if (page.extras().conceded() == null || page.basis().resultsNoBallBowled() > 0
                            || page.batting().coverage().inningsClassifiable() < page.batting().coverage().inningsUsable()) {
                        partial++;
                    }
                    if (!"SHOWN".equals(page.netRunRate().status())) {
                        notShown++;
                    }
                    if (page.basis().internalResults() > 0) {
                        derbyRows++;
                    }
                }
                assertThat(problems).as(f.name() + " sorted by " + sort).isEmpty();
                // a team is listed exactly when it has a counted result
                List<UUID> listed = table.rows().stream().map(TeamStatsTableRow::teamId).toList();
                pages.values().forEach(p -> assertThat(listed.contains(p.teamId()))
                        .as(f.name() + ": " + p.teamName() + " listed")
                        .isEqualTo(p.basis().resultsCounted() > 0));
            }
        }
        assertThat(cells).as("non-vacuous: cells compared").isGreaterThan(1500);
        assertThat(partial).as("partial-data teams were compared").isGreaterThan(20);
        assertThat(notShown).as("teams with a net run rate that is not shown were compared").isGreaterThan(20);
        assertThat(derbyRows).as("derby teams were compared").isGreaterThan(10);
    }

    @Test
    void theTablesPlayedWonLostSumsEqualWhatTheSeedWasBuiltWith() {
        TeamStatsTableDto t = table(filterSets().get(0), "won");
        Map<UUID, TeamStatsTableRow> byId = new LinkedHashMap<>();
        t.rows().forEach(r -> byId.put(r.teamId(), r));
        List<Team> mine = List.of(seed.tsHawks, seed.tsKites, seed.tsOwls, seed.tsSwifts, seed.tsDoves);
        long played = 0;
        long won = 0;
        long lost = 0;
        long tied = 0;
        long drawn = 0;
        long noResult = 0;
        for (Team team : mine) {
            TeamStatsTableRow r = byId.get(team.getId());
            played += r.values().get("played").value().longValue();
            won += r.values().get("won").value().longValue();
            lost += r.values().get("lost").value().longValue();
            tied += r.values().get("tied").value().longValue();
            drawn += r.values().get("drawn").value().longValue();
            noResult += r.values().get("noResult").value().longValue();
        }
        // Hawks 16 + Kites 2 + Owls 1 + Swifts 2 + Doves 3: the two derbies count once for each of their two teams
        assertThat(played).isEqualTo(24);
        assertThat(won).isEqualTo(14);
        assertThat(lost).isEqualTo(5);
        assertThat(tied).isEqualTo(3);
        assertThat(drawn).isEqualTo(1);
        assertThat(noResult).isEqualTo(1);
        assertThat(won + lost + tied + drawn + noResult).isEqualTo(played);

        // club-wide: one team result per our-side team of every distinct counted result, so a derby counts twice
        long allPlayed = t.rows().stream().mapToLong(r -> r.values().get("played").value().longValue()).sum();
        assertThat(allPlayed).isEqualTo(t.basis().resultsCounted() + t.basis().internalResults());
        assertThat(t.basis().internalResults()).as("the two seeded derbies and the 115 derby").isGreaterThanOrEqualTo(3);
    }

    @Test
    void aPlayerPresentInEveryMatchOfATeamHasTheTeamsRecordWithoutTheForfeits() {
        int compared = 0;
        for (Filters f : filterSets()) {
            TeamStatsDto team = page(seed.tsHawks, f);
            PlayerStatsDto tess = playerStatsService.get(
                    admin, clubId, seed.tess.getId(), f.season(), f.league(), null, null, f.competition());
            long received = team.basis().forfeits().received();
            long conceded = team.basis().forfeits().conceded();

            String who = f.name();
            // 103 files a derby (both sides ours) under "internal", never won/lost/tied/drawn, whichever side the player
            // was on; the team counts it as a win/loss/tie. D1 is a Hawks win (s1, league 1), D2 a tie (s2, friendly).
            boolean d1 = (f.season() == null || f.season().equals(seed.s1.getId()))
                    && (f.league() == null || f.league().equals(seed.l1.getId()))
                    && !"FRIENDLY".equals(f.competition());
            boolean d2 = (f.season() == null || f.season().equals(seed.s2.getId())) && f.league() == null
                    && !"LEAGUE".equals(f.competition());
            assertThat(tess.record().won()).as(who + " won").isEqualTo(team.record().won() - received - (d1 ? 1 : 0));
            assertThat(tess.record().lost()).as(who + " lost").isEqualTo(team.record().lost() - conceded);
            assertThat(tess.record().tied()).as(who + " tied").isEqualTo(team.record().tied() - (d2 ? 1 : 0));
            assertThat(tess.record().drawn()).as(who + " drawn").isEqualTo(team.record().drawn());
            assertThat(tess.record().internal()).as(who + " internal").isEqualTo(team.basis().internalResults());
            assertThat(tess.record().internal()).as(who + " internal known").isEqualTo((d1 ? 1 : 0) + (d2 ? 1 : 0));
            assertThat(tess.basis().matchesCounted()).as(who + " matches")
                    .isEqualTo(team.record().played() - received - conceded);
            long listed = matchListService.list(admin, clubId, seed.tess.getId(), f.season(), f.league(), null, null,
                    f.competition(), null, 0, 100).rows().size();
            assertThat(listed).as(who + " match list length").isEqualTo(team.record().played() - received - conceded);
            compared++;
        }
        assertThat(compared).isEqualTo(filterSets().size());
    }

    // ---- comparison ----

    private static void compare(TeamStatsTableRow row, TeamStatsDto p, String who, List<String> problems) {
        var r = p.record();
        var b = p.batting();
        var w = p.bowling();
        num(problems, who, row, "played", r.played());
        num(problems, who, row, "won", r.won());
        num(problems, who, row, "lost", r.lost());
        num(problems, who, row, "tied", r.tied());
        num(problems, who, row, "drawn", r.drawn());
        num(problems, who, row, "noResult", r.noResult());
        num(problems, who, row, "winPercent", r.winPercent());
        num(problems, who, row, "runs", b.runs() == null ? null : BigDecimal.valueOf(b.runs()));
        num(problems, who, row, "battingAverage", b.battingAverage());
        num(problems, who, row, "runRate", b.runRate());
        num(problems, who, row, "wicketsTaken", w.wicketsTaken() == null ? null : BigDecimal.valueOf(w.wicketsTaken()));
        num(problems, who, row, "bowlingAverage", w.bowlingAverage());
        num(problems, who, row, "economy", w.economy());
        TeamStatsCell high = row.values().get("highTotal");
        if (b.highestTotal() == null) {
            check(problems, who + " highTotal undefined", high.value() == null && high.runs() == null);
        } else {
            check(problems, who + " highTotal runs", Long.valueOf(b.highestTotal().runs()).equals(high.runs()));
            check(problems, who + " highTotal wickets", Long.valueOf(b.highestTotal().wickets()).equals(high.wickets()));
        }
        TeamStatsCell nrr = row.values().get("netRunRate");
        var n = p.netRunRate();
        check(problems, who + " nrr status " + nrr.status() + " vs " + n.status(), n.status().equals(nrr.status()));
        check(problems, who + " nrr rule", n.rule().equals(nrr.rule()));
        check(problems, who + " nrr used", Long.valueOf(n.matchesUsed()).equals(nrr.matchesUsed()));
        check(problems, who + " nrr counted", Long.valueOf(n.matchesCounted()).equals(nrr.matchesCounted()));
        num(problems, who, row, "netRunRate", n.value());
    }

    private static void num(List<String> problems, String who, TeamStatsTableRow row, String column, long expected) {
        num(problems, who, row, column, BigDecimal.valueOf(expected));
    }

    private static void num(List<String> problems, String who, TeamStatsTableRow row, String column, BigDecimal expected) {
        BigDecimal actual = row.values().get(column).value();
        boolean same = expected == null ? actual == null : actual != null && expected.compareTo(actual) == 0;
        check(problems, who + " " + column + ": table " + actual + " vs team page " + expected, same);
    }

    private static void check(List<String> problems, String message, boolean ok) {
        if (!ok) {
            problems.add(message);
        }
    }
}
