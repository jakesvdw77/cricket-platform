package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.dto.LeaderboardTableDto;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardCell;
import com.cricketlegend.dto.LeaderboardTableDto.LeaderboardTableRow;
import com.cricketlegend.dto.PlayerStatsDto;
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
 * docs/specs/103-player-stats.md, Goal B and the parity test of the Test Plan: for the seeded club, every row of every
 * standings table carries, on every column, the same figure as the same player's {@code PlayerStatsDto} for the same
 * filters. Not {@code @Transactional}.
 */
@SpringBootTest
@Import(AbstractIntegrationTest.class)
class LeaderboardParityIntegrationTest {

    @Autowired
    private PlayerStatsService playerStatsService;

    @Autowired
    private LeaderboardService leaderboardService;

    @Autowired
    private ApplicationContext context;

    private PlayerStatsSeed seed;
    private UUID clubId;
    private final Authentication admin = new TestingAuthenticationToken("ops", "n/a", "ROLE_platform_admin");

    @BeforeEach
    void setUp() {
        seed = new PlayerStatsSeed(context);
        clubId = seed.w.club().getId();
    }

    @AfterEach
    void cleanUp() {
        seed.cleanUp();
    }

    /** season, league, team, section; any of them null for "no filter". */
    private record Filters(String name, UUID season, UUID league, UUID team, UUID section) {
    }

    private List<Filters> filterSets() {
        return List.of(
                new Filters("career", null, null, null, null),
                new Filters("season 1", seed.s1.getId(), null, null, null),
                new Filters("season 2", seed.s2.getId(), null, null, null),
                new Filters("league 1", null, seed.l1.getId(), null, null),
                new Filters("league 2", null, seed.l2.getId(), null, null),
                new Filters("team seniors1", null, null, seed.w.seniors1().getId(), null),
                new Filters("team seniors2", null, null, seed.w.seniors2().getId(), null),
                new Filters("section seniors", null, null, null, seed.w.seniors().getId()),
                new Filters("section seniors A", null, null, null, seed.seniorsA.getId()),
                new Filters("section juniors", null, null, null, seed.w.juniors().getId()),
                new Filters("season 1, league 1, section seniors", seed.s1.getId(), seed.l1.getId(), null,
                        seed.w.seniors().getId()),
                new Filters("everything", seed.s1.getId(), seed.l1.getId(), seed.w.seniors1().getId(),
                        seed.w.seniors().getId()),
                new Filters("inconsistent", null, null, seed.w.juniorsTeam().getId(), seed.w.seniors().getId()));
    }

    private List<PlayerProfile> everyone() {
        return List.of(seed.alice, seed.bob, seed.cara, seed.dan, seed.erin, seed.eve, seed.fay, seed.grace,
                seed.frank, seed.gina);
    }

    private PlayerStatsDto stats(PlayerProfile player, Filters f) {
        return playerStatsService.get(admin, clubId, player.getId(), f.season(), f.league(), f.team(), f.section(), null);
    }

    private LeaderboardTableDto table(String group, String sort, Filters f) {
        return leaderboardService.table(
                admin, clubId, group, sort, null, f.season(), f.league(), f.team(), f.section(), null, 0, 100);
    }

    @Test
    void everyCellOfEveryStandingsTableEqualsThePlayerPageFigureForTheSameFilters() {
        Map<UUID, PlayerProfile> byId = new LinkedHashMap<>();
        everyone().forEach(p -> byId.put(p.getId(), p));
        int cells = 0;
        for (Filters f : filterSets()) {
            Map<UUID, PlayerStatsDto> pages = new LinkedHashMap<>();
            for (PlayerProfile p : everyone()) {
                pages.put(p.getId(), stats(p, f));
            }
            for (String group : List.of("batting", "bowling", "fielding")) {
                LeaderboardTableDto table = table(group, null, f);
                List<String> problems = new ArrayList<>();
                for (LeaderboardTableRow row : table.rows()) {
                    PlayerStatsDto page = pages.get(row.playerId());
                    assertThat(page).as(f.name() + " " + group + ": " + row.firstName() + " is a club player").isNotNull();
                    compare(group, row, page, f, problems);
                    cells += row.values().size();
                }
                assertThat(problems).as(f.name() + " " + group).isEmpty();

                // and nobody who has figures for the group on their page is missing from the table
                List<UUID> listed = table.rows().stream().map(LeaderboardTableRow::playerId).toList();
                for (PlayerStatsDto page : pages.values()) {
                    boolean hasFigures = switch (group) {
                        case "batting" -> page.batting().innings() > 0;
                        case "bowling" -> page.bowling().inningsBowled() > 0;
                        default -> page.basis().matchesCounted() > 0;
                    };
                    assertThat(listed.contains(page.playerId()))
                            .as(f.name() + " " + group + ": " + byId.get(page.playerId()).getId() + " listed")
                            .isEqualTo(hasFigures);
                }
            }
        }
        assertThat(cells).isGreaterThan(500);
    }

    @Test
    void theParityHoldsWhicheverColumnTheTableIsSortedBy() {
        Filters career = filterSets().get(0);
        Map<UUID, PlayerStatsDto> pages = new LinkedHashMap<>();
        everyone().forEach(p -> pages.put(p.getId(), stats(p, career)));
        Map<String, List<String>> sorts = Map.of(
                "batting", List.of("matches", "innings", "balls", "highestScore", "average", "strikeRate", "outs",
                        "fours", "sixes", "fiftyPlus", "hundredPlus"),
                "bowling", List.of("matches", "overs", "maidens", "dots", "runs", "average", "economy", "strikeRate",
                        "best", "threeW", "fourW", "fiveW"),
                "fielding", List.of("matches", "catches", "stumpings", "runOuts"));
        sorts.forEach((group, codes) -> codes.forEach(code -> {
            LeaderboardTableDto table = table(group, code, career);
            List<String> problems = new ArrayList<>();
            table.rows().forEach(row -> compare(group, row, pages.get(row.playerId()), career, problems));
            assertThat(problems).as(group + " sorted by " + code).isEmpty();
        }));
    }

    // ---- comparison ----

    private static void compare(
            String group, LeaderboardTableRow row, PlayerStatsDto page, Filters f, List<String> problems) {
        String who = f.name() + "/" + group + "/" + row.firstName();
        var bat = page.batting();
        var bowl = page.bowling();
        var field = page.fielding();
        long matches = page.basis().matchesCounted();
        switch (group) {
            case "batting" -> {
                num(problems, who, row, "matches", matches);
                num(problems, who, row, "innings", bat.innings());
                num(problems, who, row, "runs", bat.runs());
                num(problems, who, row, "balls", bat.ballsFaced());
                num(problems, who, row, "average", bat.average());
                num(problems, who, row, "strikeRate", bat.strikeRate());
                num(problems, who, row, "outs", bat.dismissals());
                num(problems, who, row, "fours", bat.fours());
                num(problems, who, row, "sixes", bat.sixes());
                num(problems, who, row, "fiftyPlus", bat.fiftyPlus());
                num(problems, who, row, "hundredPlus", bat.hundredPlus());
                LeaderboardCell hs = row.values().get("highestScore");
                if (bat.highestScore() == null) {
                    check(problems, who + " highestScore defined", hs.runs() == null);
                } else {
                    check(problems, who + " highestScore runs", Long.valueOf(bat.highestScore().runs()).equals(hs.runs()));
                    check(problems, who + " highestScore notOut", Boolean.valueOf(bat.highestScore().notOut()).equals(hs.notOut()));
                }
            }
            case "bowling" -> {
                num(problems, who, row, "matches", matches);
                num(problems, who, row, "maidens", bowl.maidens());
                num(problems, who, row, "runs", bowl.runsConceded());
                num(problems, who, row, "wickets", bowl.wickets());
                num(problems, who, row, "average", bowl.average());
                num(problems, who, row, "economy", bowl.economy());
                num(problems, who, row, "strikeRate", bowl.strikeRate());
                num(problems, who, row, "threeW", bowl.threeWicketHauls());
                num(problems, who, row, "fourW", bowl.fourWicketHauls());
                num(problems, who, row, "fiveW", bowl.fiveWicketHauls());
                LeaderboardCell overs = row.values().get("overs");
                check(problems, who + " overs balls", Long.valueOf(bowl.ballsBowled()).equals(overs.balls()));
                if (bowl.coverage().inningsWithDots() > 0) {
                    num(problems, who, row, "dots", bowl.dots());
                } else {
                    check(problems, who + " dots dash", row.values().get("dots").value() == null);
                }
                LeaderboardCell best = row.values().get("best");
                if (bowl.best() == null) {
                    check(problems, who + " best defined", best.wickets() == null);
                } else {
                    check(problems, who + " best wickets", Long.valueOf(bowl.best().wickets()).equals(best.wickets()));
                    check(problems, who + " best runs", Long.valueOf(bowl.best().runs()).equals(best.runs()));
                }
            }
            default -> {
                num(problems, who, row, "matches", matches);
                num(problems, who, row, "catches", field.catches());
                num(problems, who, row, "stumpings", field.stumpings());
                num(problems, who, row, "runOuts", field.runOuts());
                num(problems, who, row, "total", field.dismissals());
            }
        }
    }

    private static void num(List<String> problems, String who, LeaderboardTableRow row, String column, long expected) {
        num(problems, who, row, column, BigDecimal.valueOf(expected));
    }

    private static void num(
            List<String> problems, String who, LeaderboardTableRow row, String column, BigDecimal expected) {
        BigDecimal actual = row.values().get(column).value();
        boolean same = expected == null ? actual == null : actual != null && expected.compareTo(actual) == 0;
        check(problems, who + " " + column + ": board " + actual + " vs player page " + expected, same);
    }

    private static void check(List<String> problems, String message, boolean ok) {
        if (!ok) {
            problems.add(message);
        }
    }
}
