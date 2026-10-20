package com.cricketlegend.support;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.support.ManagerOverviewFixtures.World;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The seeded club of the docs/specs/103 statistics integration tests. Results, innings, rows and entries are inserted with
 * plain SQL (a draft, a forfeit, an abandoned match with no ball bowled and a super-over entry cannot be captured through
 * the app, but the statistics must still ignore them). Every scenario has its own player so the expected figures stay
 * hand-checkable; see the comment above each block. Removes what it created in {@link #cleanUp()} because the tests that
 * use it are deliberately not {@code @Transactional}.
 *
 * <pre>
 * sections  Seniors > Seniors A > Seniors A1 (grandchild)      Juniors (sibling of Seniors)
 * teams     seniors1, seniors2 (Seniors) / gcTeam (Seniors A1) / juniorsTeam (Juniors)
 * seasons   s1 (2031, the world's), s2 (2032);  leagues l1, l2;  no league = friendly
 * </pre>
 */
public final class PlayerStatsSeed {

    public final ManagerOverviewFixtures fixtures;
    public final World w;
    public final World other;
    public final Season s1;
    public final Season s2;
    public final League l1;
    public final League l2;
    public final Section seniorsA;
    public final Section seniorsA1;
    public final Team gcTeam;

    public final PlayerProfile alice;
    public final PlayerProfile bob;
    public final PlayerProfile cara;
    public final PlayerProfile dan;
    public final PlayerProfile erin;
    public final PlayerProfile eve;
    public final PlayerProfile fay;
    public final PlayerProfile grace;
    /** Eligible for seniors1 and with no appearance until the guest of {@link #garyRowResultPlayer} is linked to them. */
    public final PlayerProfile frank;
    /** Never appears on any result. */
    public final PlayerProfile gina;
    /** The other club's player, with a 500-run innings in the other club. */
    public final PlayerProfile xavier;

    /** The match whose result is a DRAFT (Bob, 200 runs). */
    public Match draftMatch;
    /** The match whose published result is unpublished by the unpublish scenario (Bob, 77). */
    public Match unpublishMatch;
    /** The match of the guest, the substitute and the opposition row. */
    public Match guestMatch;
    /** The guest row (Gary Guest, 77 runs) of {@link #guestMatch}. */
    public UUID garyRowResultPlayer;

    private final JdbcTemplate jdbc;
    private final List<UUID> clubIds;
    private int day;

    public PlayerStatsSeed(ApplicationContext ctx) {
        fixtures = new ManagerOverviewFixtures(ctx);
        jdbc = ctx.getBean(JdbcTemplate.class);
        w = fixtures.world();
        other = fixtures.world();
        clubIds = List.of(w.club().getId(), other.club().getId());
        s1 = w.season();
        s2 = fixtures.season(w.club(), "2032");
        l1 = fixtures.league(w, 11);
        l2 = fixtures.league(w, 11);
        seniorsA = fixtures.childSection(w.club(), w.seniors(), "Seniors A");
        seniorsA1 = fixtures.childSection(w.club(), seniorsA, "Seniors A1");
        gcTeam = fixtures.team(w.club(), seniorsA1, "GC Team");

        alice = fixtures.player(w, "Alice", true);
        bob = fixtures.player(w, "Bob", true);
        cara = fixtures.player(w, "Cara", true);
        dan = fixtures.player(w, "Dan", true);
        erin = fixtures.player(w, "Erin", true);
        eve = fixtures.player(w, "Eve", true);
        fay = fixtures.player(w, "Fay", true);
        grace = fixtures.player(w, "Grace", true);
        frank = fixtures.eligiblePlayer(w, w.seniors1(), "Frank");
        gina = fixtures.player(w, "Gina", true);
        xavier = fixtures.player(other, "Xavier", true);

        seedAlice();
        seedBob();
        seedCara();
        seedDerby();
        seedEve();
        seedOtherClub();
    }

    // ---- scenarios ----

    /**
     * Alice: the filter player. Five counted results, one per filter cell.
     * R1 s1/l1 seniors1 WON home: 50 (40 balls, 5 fours, 1 six) bowled, bowls 24 balls 20 runs 3 wickets (10 dots, 2 wides),
     *    2 catches, player of the match; also a team award to a free-text name (counts for nobody).
     * R2 s1/l2 seniors1 TIE: 0 off 1 ball (golden duck), team player of the match.
     * R3 s2/friendly seniors2 DRAW: 100 not out (80 balls, 10 fours, 2 sixes).
     * R4 s1/l1 gcTeam WON: 30 caught (25 balls, 3 fours).
     * R5 s1/l1 juniorsTeam WON: 7 bowled (10 balls, 1 four).
     * Career: 5 matches, 187 runs, 5 innings, 1 not out, HS 100*.
     */
    private void seedAlice() {
        Res r1 = published(match(w.seniors1(), null, s1, l1, true), "WON", "HOME");
        UUID a1 = r1.ours("HOME", alice);
        UUID opp = r1.opposition("AWAY", "Opp One");
        r1.bat(a1, 1, "BOWLED", 50, 40, 5, 1);
        r1.bat(opp, 1, "CAUGHT", 33, 30, 4, 0);
        r1.bowl(a1, 24, 0, 20, 3, 2, 0, 10);
        r1.field(a1, 2, 0, 0);
        r1.award("PLAYER_OF_MATCH", "HOME", a1);
        r1.namedAward("TEAM_PLAYER_OF_MATCH", "AWAY", "Opp Star");

        Res r2 = published(match(w.seniors1(), null, s1, l2, true), "TIE", null);
        UUID a2 = r2.ours("HOME", alice);
        r2.bat(a2, 1, "BOWLED", 0, 1, 0, 0);
        r2.award("TEAM_PLAYER_OF_MATCH", "HOME", a2);

        Res r3 = published(match(w.seniors2(), null, s2, null, true), "DRAW", null);
        r3.bat(r3.ours("HOME", alice), 1, "NOT_OUT", 100, 80, 10, 2);

        Res r4 = published(match(gcTeam, null, s1, l1, true), "WON", "HOME");
        r4.bat(r4.ours("HOME", alice), 1, "CAUGHT", 30, 25, 3, 0);

        Res r5 = published(match(w.juniorsTeam(), null, s1, l1, true), "WON", "HOME");
        r5.bat(r5.ours("HOME", alice), 1, "BOWLED", 7, 10, 1, 0);
    }

    /**
     * Bob: what must never count, and what counts only because a ball was bowled (decision 17).
     * Never: a DRAFT (200), a FORFEIT (99), an ABANDONED and a NO_RESULT with no ball bowled (40, 41).
     * Unpublished later: a published WON (77), see {@link #unpublishMatch}.
     * Counts: a NO_RESULT with innings balls (10 bowled, 12 balls), an ABANDONED whose only ball is a bowling entry
     * (6 balls, 4 runs, no wicket), and a plain WON (11 not out off 9).
     * With the unpublished result gone: 3 matches, 2 innings, 21 runs, 1 bowling innings.
     */
    private void seedBob() {
        draftMatch = match(w.seniors1(), null, s1, l1, true);
        Res draft = result(draftMatch, "DRAFT", "WON", "HOME");
        draft.bat(draft.ours("HOME", bob), 1, "BOWLED", 200, 100, 0, 0);

        unpublishMatch = match(w.seniors1(), null, s1, l1, true);
        Res toUnpublish = published(unpublishMatch, "WON", "HOME");
        toUnpublish.bat(toUnpublish.ours("HOME", bob), 1, "BOWLED", 77, 60, 0, 0);

        Res forfeit = published(match(w.seniors1(), null, s1, l1, true), "FORFEIT", "HOME");
        forfeit.bat(forfeit.ours("HOME", bob), 1, "NOT_OUT", 99, 50, 0, 0);

        Res abandonedNoBall = published(match(w.seniors1(), null, s1, l1, true), "ABANDONED", null);
        abandonedNoBall.inningsBalls(0, 0);
        abandonedNoBall.bat(abandonedNoBall.ours("HOME", bob), 1, "NOT_OUT", 40, null, 0, 0);

        Res noResultNoBall = published(match(w.seniors1(), null, s1, l1, true), "NO_RESULT", null);
        noResultNoBall.inningsBalls(0, 0);
        noResultNoBall.bat(noResultNoBall.ours("HOME", bob), 1, "NOT_OUT", 41, null, 0, 0);

        Res noResultPlay = published(match(w.seniors1(), null, s1, l1, true), "NO_RESULT", null);
        noResultPlay.inningsBalls(30, 0);
        noResultPlay.bat(noResultPlay.ours("HOME", bob), 1, "BOWLED", 10, 12, 1, 0);

        Res abandonedBowled = published(match(w.seniors1(), null, s1, l1, true), "ABANDONED", null);
        abandonedBowled.inningsBalls(0, 0);
        abandonedBowled.bowl(abandonedBowled.ours("HOME", bob), 6, 0, 4, 0, null, null, null);

        Res won = published(match(w.seniors1(), null, s1, l1, true), "WON", "HOME");
        won.bat(won.ours("HOME", bob), 1, "NOT_OUT", 11, 9, 1, 0);
    }

    /**
     * Cara: a player who moved teams in season s1/l1 (10 for seniors1, 20 for seniors2), and the shared match of a
     * substitute (Cara 88, never counted), a guest (Gary 77, counted for nobody until linked), an opposition row (99)
     * and a registered Grace (15, counted).
     */
    private void seedCara() {
        Res moved1 = published(match(w.seniors1(), null, s1, l1, true), "WON", "HOME");
        moved1.bat(moved1.ours("HOME", cara), 1, "BOWLED", 10, 15, 1, 0);
        Res moved2 = published(match(w.seniors2(), null, s1, l1, true), "WON", "HOME");
        moved2.bat(moved2.ours("HOME", cara), 1, "CAUGHT", 20, 18, 2, 0);

        guestMatch = match(w.seniors1(), null, s1, l1, true);
        Res shared = published(guestMatch, "WON", "HOME");
        UUID sub = shared.substitute("HOME", cara);
        garyRowResultPlayer = shared.guest("HOME", "Gary Guest");
        UUID g = shared.ours("HOME", grace);
        UUID opp = shared.opposition("AWAY", "Opp Big Hitter");
        shared.bat(sub, 1, "BOWLED", 88, 40, 0, 0);
        shared.bat(garyRowResultPlayer, 2, "BOWLED", 77, 40, 0, 0);
        shared.bat(g, 3, "BOWLED", 15, 20, 1, 0);
        shared.bat(opp, 1, "BOWLED", 99, 50, 0, 0);
    }

    /**
     * A derby (seniors1 v seniors2, s1/l1). Dan is on both sides: one match, innings of 40 (home) and 5 (away), bowling 1
     * wicket for home (6 balls, 5 runs) and 2 for away (12 balls, 18 runs). Erin (home, 12 not out), Fay (away, 9).
     */
    private void seedDerby() {
        Res derby = published(match(w.seniors1(), w.seniors2(), s1, l1, true), "WON", "HOME");
        UUID danHome = derby.ours("HOME", dan);
        UUID danAway = derby.ours("AWAY", dan);
        UUID erinHome = derby.ours("HOME", erin);
        UUID fayAway = derby.ours("AWAY", fay);
        derby.bat(danHome, 1, "BOWLED", 40, 30, 4, 0);
        derby.bat(erinHome, 2, "NOT_OUT", 12, 10, 1, 0);
        derby.bat(danAway, 1, "BOWLED", 5, 6, 0, 0);
        derby.bat(fayAway, 2, "CAUGHT", 9, 8, 1, 0);
        derby.bowl(danAway, 12, 0, 18, 2, null, null, null);
        derby.bowl(danHome, 6, 0, 5, 1, null, null, null);
    }

    /**
     * Eve: a result with a team list and no cards (matches only), a WON with 20 plus a super-over innings that must not
     * count (6 runs, 2 wickets), and a match deactivated after its result was published (10, decision 21). A
     * summary-level result (no player rows) also exists for the club. Counted: 3 matches, 2 innings, 30 runs, no wickets.
     */
    private void seedEve() {
        Res teamListOnly = published(match(w.seniors1(), null, s1, l1, true), "WON", "HOME");
        teamListOnly.ours("HOME", eve);

        Res superOver = published(match(w.seniors1(), null, s1, l1, true), "WON", "HOME");
        UUID e = superOver.ours("HOME", eve);
        superOver.bat(e, 1, "BOWLED", 20, 25, 2, 0);
        UUID so1 = superOver.innings(3, "SUPER_OVER", "HOME", 8, 1, 6);
        UUID so2 = superOver.innings(4, "SUPER_OVER", "AWAY", 7, 2, 6);
        superOver.batIn(so1, e, 1, "NOT_OUT", 6, 3, 1, 0);
        superOver.bowlIn(so2, e, 6, 0, 7, 2, null, null, null);

        Res deactivated = published(match(w.seniors1(), null, s1, l1, false), "WON", "HOME");
        deactivated.bat(deactivated.ours("HOME", eve), 1, "BOWLED", 10, 12, 1, 0);

        published(match(w.seniors1(), null, s1, l1, true), "WON", "HOME"); // summary level: no player rows
    }

    /** The other club: Xavier scored 500 in a published result of its own season, league and team. */
    private void seedOtherClub() {
        Match m = fixtures.match(other, other.seniors1(), null, Instant.parse("2031-06-01T10:00:00Z"));
        Res r = published(m, other.club().getId(), "WON", "HOME");
        r.bat(r.ours("HOME", xavier), 1, "NOT_OUT", 500, 300, 40, 10);
    }

    // ---- scaling (query-count guard) ----

    /** {@code n} more published results of the world's club, each with three new players batting and bowling. */
    public void addBulk(int n) {
        for (int i = 0; i < n; i++) {
            Res r = published(match(w.seniors1(), null, s1, l1, true), "WON", "HOME");
            for (int p = 0; p < 3; p++) {
                PlayerProfile pl = fixtures.player(w, "Bulk" + i + "x" + p, true);
                UUID rp = r.ours("HOME", pl);
                r.bat(rp, p + 1, "BOWLED", 10 + p, 10, 1, 0);
                r.bowl(rp, 12, 0, 20, p, null, null, null);
            }
        }
    }

    // ---- building blocks ----

    public Match match(Team home, Team away, Season season, League league, boolean active) {
        Match m = fixtures.match(w, home, away, Instant.parse("2031-06-01T10:00:00Z").plus(day++, ChronoUnit.DAYS),
                active, league);
        if (!season.getId().equals(w.season().getId())) {
            jdbc.update("update match set season_id = ? where id = ?", season.getId(), m.getId());
        }
        return m;
    }

    public Res published(Match match, String outcome, String winningSide) {
        return result(match, "PUBLISHED", outcome, winningSide);
    }

    private Res published(Match match, UUID clubId, String outcome, String winningSide) {
        return result(match, clubId, "PUBLISHED", outcome, winningSide);
    }

    public Res result(Match match, String status, String outcome, String winningSide) {
        return result(match, w.club().getId(), status, outcome, winningSide);
    }

    private Res result(Match match, UUID clubId, String status, String outcome, String winningSide) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into match_result (id, club_id, match_id, status, detail_level, outcome_type, winning_side,"
                        + " balls_per_over, published_at) values (?, ?, ?, ?, 'FULL', ?, ?, 6, ?)",
                id, clubId, match.getId(), status, outcome, winningSide,
                "PUBLISHED".equals(status) ? Timestamp.from(Instant.now()) : null);
        Res res = new Res(id);
        res.inn1 = res.innings(1, "REGULAR", "HOME", 150, 5, 120);
        res.inn2 = res.innings(2, "REGULAR", "AWAY", 100, 8, 120);
        return res;
    }

    /** Unpublishes by SQL (the HTTP route is exercised by the tests that need it). */
    public void setStatus(Match match, String status) {
        jdbc.update("update match_result set status = ? where match_id = ?", status, match.getId());
    }

    public void cleanUp() {
        String clubs = clubIds.stream().map(id -> "'" + id + "'").collect(Collectors.joining(","));
        jdbc.update("delete from club_profile where club_id in (" + clubs + ")");
        fixtures.cleanUp();
    }

    /** One result under construction: its innings 1 (HOME bats) and 2 (AWAY bats) and its rows. */
    public final class Res {
        public final UUID id;
        public UUID inn1;
        public UUID inn2;
        private final Map<UUID, String> sides = new HashMap<>();

        private Res(UUID id) {
            this.id = id;
        }

        public UUID innings(int sequence, String kind, String battingSide, int runs, int wickets, int balls) {
            UUID inn = UUID.randomUUID();
            jdbc.update("insert into match_innings (id, match_result_id, sequence, kind, batting_side, runs, wickets,"
                            + " balls, all_out) values (?, ?, ?, ?, ?, ?, ?, ?, false)",
                    inn, id, sequence, kind, battingSide, runs, wickets, balls);
            return inn;
        }

        /** Sets the balls of the two regular innings (0 and 0 means no ball was bowled in the match). */
        public void inningsBalls(int first, int second) {
            jdbc.update("update match_innings set balls = ? where id = ?", first, inn1);
            jdbc.update("update match_innings set balls = ? where id = ?", second, inn2);
        }

        public UUID ours(String side, PlayerProfile player) {
            return row(side, player.getId(), null, false, false);
        }

        public UUID substitute(String side, PlayerProfile player) {
            return row(side, player.getId(), null, false, true);
        }

        public UUID guest(String side, String name) {
            return row(side, null, name, false, false);
        }

        public UUID opposition(String side, String name) {
            return row(side, null, name, true, false);
        }

        private UUID row(String side, UUID profileId, String name, boolean opposition, boolean substitute) {
            UUID rp = UUID.randomUUID();
            jdbc.update("insert into result_player (id, match_result_id, side, player_profile_id, display_name,"
                            + " substitute, opposition) values (?, ?, ?, ?, ?, ?, ?)",
                    rp, id, side, profileId, name, substitute, opposition);
            sides.put(rp, side);
            return rp;
        }

        /** A batting row in the innings that this row's side batted. */
        public void bat(UUID rp, Integer position, String howOut, Integer runs, Integer balls, Integer fours, Integer sixes) {
            batIn("HOME".equals(sides.get(rp)) ? inn1 : inn2, rp, position, howOut, runs, balls, fours, sixes);
        }

        public void batIn(UUID innings, UUID rp, Integer position, String howOut, Integer runs, Integer balls,
                Integer fours, Integer sixes) {
            jdbc.update("insert into batting_entry (id, match_innings_id, result_player_id, position, how_out, runs,"
                            + " balls, fours, sixes) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), innings, rp, position, howOut, runs, balls, fours, sixes);
        }

        /** A bowling row in the innings that the other side batted. */
        public void bowl(UUID rp, int balls, int maidens, int runs, int wickets, Integer wides, Integer noBalls,
                Integer dots) {
            bowlIn("HOME".equals(sides.get(rp)) ? inn2 : inn1, rp, balls, maidens, runs, wickets, wides, noBalls, dots);
        }

        public void bowlIn(UUID innings, UUID rp, int balls, int maidens, int runs, int wickets, Integer wides,
                Integer noBalls, Integer dots) {
            jdbc.update("insert into bowling_entry (id, match_innings_id, result_player_id, balls, maidens, runs,"
                            + " wickets, wides, no_balls, dots) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), innings, rp, balls, maidens, runs, wickets, wides, noBalls, dots);
        }

        public void field(UUID rp, int catches, int stumpings, int runOuts) {
            jdbc.update("insert into fielding_entry (id, match_innings_id, result_player_id, catches, stumpings, run_outs)"
                            + " values (?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), "HOME".equals(sides.get(rp)) ? inn2 : inn1, rp, catches, stumpings, runOuts);
        }

        public void award(String type, String side, UUID rp) {
            jdbc.update("insert into match_award (id, match_result_id, award_type, side, result_player_id)"
                    + " values (?, ?, ?, ?, ?)", UUID.randomUUID(), id, type, side, rp);
        }

        public void namedAward(String type, String side, String name) {
            jdbc.update("insert into match_award (id, match_result_id, award_type, side, display_name)"
                    + " values (?, ?, ?, ?, ?)", UUID.randomUUID(), id, type, side, name);
        }
    }
}
