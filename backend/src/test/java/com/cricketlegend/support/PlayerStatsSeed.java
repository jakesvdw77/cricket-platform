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

    // ---- docs/specs/115 match-list scenarios: created only by seedMatchList(), so the 103 tests' club is unchanged ----

    /** A batting card and no bowling card in one match, a team-list-only-on-a-captured-card match, a loss, a club opponent. */
    public PlayerProfile hank;
    /** A multi-innings DRAW in which the same player bats and bowls in two REGULAR innings. */
    public PlayerProfile ivy;
    /** Hank's captured card: batted 25 and bowled in the match where Hank did not play a part. */
    public PlayerProfile jill;
    /** Innings with balls = 0 and runs > 0, blank fours and sixes, a DID_NOT_BAT entry. */
    public PlayerProfile kim;
    /** A NO_RESULT and an ABANDONED match with a ball bowled, and the ones with no ball and a forfeit that never count. */
    public PlayerProfile leo;
    /** A bowling row with 0 balls, 0 runs and 1 wicket (spec 115 gap, see seedMona). */
    public PlayerProfile mona;
    /** Five matches, three of them on exactly the same date (the match-id tie-break and stable paging). */
    public PlayerProfile nina;
    /** A second derby with the player on both sides, awards and fielding on both. */
    public PlayerProfile pia;
    /** A team of the other club, the club-team opponent of Hank's matches. */
    public Team rivals;
    /** Nina's matches in creation order; the first three share one date. */
    public final List<Match> ninaMatches = new java.util.ArrayList<>();

    /** The match whose result is a DRAFT (Bob, 200 runs). */
    public Match draftMatch;
    /** The match whose published result is unpublished by the unpublish scenario (Bob, 77). */
    public Match unpublishMatch;
    /** The match of the guest, the substitute and the opposition row. */
    public Match guestMatch;
    /** The guest row (Gary Guest, 77 runs) of {@link #guestMatch}. */
    public UUID garyRowResultPlayer;

    // ---- docs/specs/116 team-stats scenarios: created only by seedTeamStats(), so the 103/115 tests' club is unchanged ----

    /** The main team: 17 published results of every kind (see {@link #seedTeamStats()}). In Seniors A. */
    public Team tsHawks;
    /** The derby opponent of {@link #tsHawks}, in the grandchild section Seniors A1. */
    public Team tsKites;
    /** A team whose only result is a draw (Seniors). */
    public Team tsOwls;
    /** Two identical wins, one against a free-text opponent and one against a team of another club (Juniors). */
    public Team tsSwifts;
    /** Three Duckworth-Lewis results (Seniors A). */
    public Team tsDoves;
    /** A team with no match at all (Juniors). */
    public Team tsWrens;
    /** A team of the OTHER club, the away side of one of the Swifts' wins. */
    public Team tsRivals;
    /** Present in every non-forfeit Hawks result, on the Hawks side (the cross-check against the player record of 103). */
    public PlayerProfile tess;
    /** The matches of {@link #seedTeamStats()} by their scenario key (H1, D1, X2...). */
    public final Map<String, Match> tsMatches = new java.util.LinkedHashMap<>();

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

    // ---- docs/specs/115 match-list scenarios (opt-in) ----

    /**
     * Adds the spec 115 players and results to the club. NOT called by the constructor: the 103 tests assert club-wide
     * figures (players listed, results counted, filter options) that these extra players would change.
     *
     * <pre>
     * Hank  H1 s1/l1 seniors1 WON: 40 (30b 4x4 1x6), batting card only (no bowling entry anywhere)
     *       H2 s1/l1 seniors1 WON: on the list only, Jill batted and bowled (DID_NOT_BAT, DID_NOT_BOWL, fielding 0)
     *       H3 s1/l1 seniors2 (AWAY) v Rivals CC (HOME, other club's team) LOST: 12 (10b 1x4), 1 catch
     *       H4 s1 friendly seniors1 v Rivals CC TIE: 5 not out (4b); a club team opponent, friendly
     * Ivy   one DRAW s2 friendly seniors2, four REGULAR innings: bats 30 (20b 3x4) and 15* (12b 1x4), bowls 12b 1m 14r 2w
     *       (5 dots, 1 wide) and 18b 0m 20r 1w; catches 1 + 2, stumping 1
     * Jill  H2 only: 25 (20b), bowls 12b 1m 10r 1w
     * Kim   K1 s1/l1 22 off 0 balls (3 fours, 0 sixes); K2 s1/l2 5 off 8 balls (fours, sixes blank);
     *       K3 s1/l1 a DID_NOT_BAT entry
     * Leo   L1 NO_RESULT 8 (10b); L2 ABANDONED, bowling entry only (12b 1m 9r 1w); never: a NO_RESULT with no ball
     *       bowled (3), a FORFEIT (50)
     * Mona  M1 WON 10 (8b 1x4) and a bowling row of 0 balls 0 runs 1 wicket; M2 WON bowling 12b 8r 2w, no batting card
     * Nina  N1..N3 on 2031-12-01T10:00Z (11, 12, 13), N4 earlier (14), N5 later (15), all s1/l1 seniors1 WON
     * Pia   one derby (seniors2 v seniors1): home 20 (15b 2x4), away 30 (25b 3x4 1x6); catches 1 + 2, run out 1;
     *       player of the match 1 and the team award on both sides
     * </pre>
     */
    public void seedMatchList() {
        hank = fixtures.player(w, "Hank", true);
        ivy = fixtures.player(w, "Ivy", true);
        jill = fixtures.player(w, "Jill", true);
        kim = fixtures.player(w, "Kim", true);
        leo = fixtures.player(w, "Leo", true);
        mona = fixtures.player(w, "Mona", true);
        nina = fixtures.player(w, "Nina", true);
        pia = fixtures.player(w, "Pia", true);
        rivals = fixtures.team(other.club(), other.seniors(), "Rivals CC");
        seedHank();
        seedIvy();
        seedKim();
        seedLeo();
        seedMona();
        seedNina();
        seedPia();
    }

    private void seedHank() {
        Res h1 = published(match(w.seniors1(), null, s1, l1, true), "WON", "HOME");
        h1.bat(h1.ours("HOME", hank), 1, "BOWLED", 40, 30, 4, 1);

        Res h2 = published(match(w.seniors1(), null, s1, l1, true), "WON", "HOME");
        h2.ours("HOME", hank);
        UUID jillRow = h2.ours("HOME", jill);
        h2.bat(jillRow, 1, "CAUGHT", 25, 20, 2, 0);
        h2.bowl(jillRow, 12, 1, 10, 1, null, null, null);

        Res h3 = published(match(rivals, w.seniors2(), s1, l1, true), "WON", "HOME");
        UUID hankAway = h3.ours("AWAY", hank);
        h3.bat(hankAway, 1, "BOWLED", 12, 10, 1, 0);
        h3.field(hankAway, 1, 0, 0);

        // the match table allows a team OR a free-text name on a side (ck_match_away_side), never both
        Res h4 = published(match(w.seniors1(), rivals, s1, null, true), "TIE", null);
        h4.bat(h4.ours("HOME", hank), 1, "NOT_OUT", 5, 4, 0, 0);
    }

    private void seedIvy() {
        Res r = published(match(w.seniors2(), null, s2, null, true), "DRAW", null);
        UUID i = r.ours("HOME", ivy);
        UUID inn3 = r.innings(3, "REGULAR", "HOME", 90, 3, 90);
        UUID inn4 = r.innings(4, "REGULAR", "AWAY", 80, 4, 90);
        r.bat(i, 1, "CAUGHT", 30, 20, 3, 0);
        r.batIn(inn3, i, 1, "NOT_OUT", 15, 12, 1, 0);
        r.bowl(i, 12, 1, 14, 2, 1, 0, 5);
        r.bowlIn(inn4, i, 18, 0, 20, 1, null, null, null);
        r.field(i, 1, 0, 0);
        r.fieldIn(inn4, i, 2, 1, 0);
    }

    private void seedKim() {
        Res k1 = published(match(w.seniors1(), null, s1, l1, true), "WON", "HOME");
        k1.bat(k1.ours("HOME", kim), 1, "BOWLED", 22, 0, 3, 0);
        Res k2 = published(match(w.seniors1(), null, s1, l2, true), "WON", "HOME");
        k2.bat(k2.ours("HOME", kim), 1, "CAUGHT", 5, 8, null, null);
        Res k3 = published(match(w.seniors1(), null, s1, l1, true), "WON", "HOME");
        k3.bat(k3.ours("HOME", kim), null, "DID_NOT_BAT", null, null, null, null);
    }

    private void seedLeo() {
        Res l1r = published(match(w.seniors1(), null, s1, l1, true), "NO_RESULT", null);
        l1r.inningsBalls(30, 0);
        l1r.bat(l1r.ours("HOME", leo), 1, "BOWLED", 8, 10, 1, 0);

        Res l2r = published(match(w.seniors1(), null, s1, l1, true), "ABANDONED", null);
        l2r.inningsBalls(0, 0);
        l2r.bowl(l2r.ours("HOME", leo), 12, 1, 9, 1, null, null, null);

        Res l3 = published(match(w.seniors1(), null, s1, l1, true), "NO_RESULT", null);
        l3.inningsBalls(0, 0);
        l3.bat(l3.ours("HOME", leo), 1, "NOT_OUT", 3, null, 0, 0);

        Res l4 = published(match(w.seniors1(), null, s1, l1, true), "FORFEIT", "HOME");
        l4.bat(l4.ours("HOME", leo), 1, "NOT_OUT", 50, 30, 0, 0);
    }

    /**
     * Mona's first match holds a bowling row with 0 balls, 0 runs and 1 wicket (a run-out style credit). The aggregate
     * ({@code PlayerStatsSql}) sums its wicket; the row builder does not count it as a spell.
     */
    private void seedMona() {
        Res m1 = published(match(w.seniors1(), null, s1, l1, true), "WON", "HOME");
        UUID mona1 = m1.ours("HOME", mona);
        m1.bat(mona1, 1, "BOWLED", 10, 8, 1, 0);
        m1.bowl(mona1, 0, 0, 0, 1, null, null, null);
        Res m2 = published(match(w.seniors1(), null, s1, l1, true), "WON", "HOME");
        m2.bowl(m2.ours("HOME", mona), 12, 0, 8, 2, null, null, null);
    }

    private void seedNina() {
        Instant sameDay = Instant.parse("2031-12-01T10:00:00Z");
        for (int i = 0; i < 5; i++) {
            Match m = match(w.seniors1(), null, s1, l1, true);
            Instant when = i < 3 ? sameDay : i == 3 ? Instant.parse("2031-11-01T10:00:00Z") : Instant.parse("2032-01-01T10:00:00Z");
            jdbc.update("update match set match_date = ? where id = ?", Timestamp.from(when), m.getId());
            Res r = published(m, "WON", "HOME");
            r.bat(r.ours("HOME", nina), 1, "BOWLED", 11 + i, 10, 1, 0);
            ninaMatches.add(m);
        }
    }

    private void seedPia() {
        Res d = published(match(w.seniors2(), w.seniors1(), s1, l1, true), "WON", "AWAY");
        UUID home = d.ours("HOME", pia);
        UUID away = d.ours("AWAY", pia);
        d.bat(home, 1, "BOWLED", 20, 15, 2, 0);
        d.bat(away, 1, "CAUGHT", 30, 25, 3, 1);
        d.field(home, 1, 0, 0);
        d.field(away, 2, 0, 1);
        d.award("PLAYER_OF_MATCH", "HOME", home);
        d.award("TEAM_PLAYER_OF_MATCH", "HOME", home);
        d.award("TEAM_PLAYER_OF_MATCH", "AWAY", away);
    }

    // ---- docs/specs/116 team scenarios (opt-in) ----

    /**
     * Adds the spec 116 teams and results to the club. NOT called by the constructor, so the 103 and 115 expectations stay
     * as they are. Every figure is hand-computable: scores are written in the code below, the expectations are in
     * {@code TeamStatsIntegrationTest}. Ordering of creation is the order of the match dates (each match is a day later).
     *
     * <pre>
     * Hawks (Seniors A) at home, s1/l1 unless noted; innings written "runs/wickets/balls" (AO = all out), scheduled 120 balls
     *   H1  WON 50 runs      Hawks 200/6/120 v 150/10/100 AO, opposition extras 12 (5 wides, 2 no-balls, 3 byes, 2 leg byes, 0 penalty)
     *   H2  WON 6 wickets    chase: 180/8/120 v Hawks 184/4/100 (20 balls left), opposition extras 8 (6, 1, 1, 0, penalty not recorded)
     *   H3  LOST 8 wickets   Hawks 95/10/80 AO v 96/2/70, opposition extras 5 (no breakdown)
     *   H4  TIE              140/7/120 each way
     *   H6  WON by super over  regular innings 100/9/120 v 100/8/120, plus SUPER_OVER innings 15/0/6 and 12/1/6 (ignored)
     *   H7  FORFEIT received  default stray innings 150 / 100 (ignored)
     *   H8  FORFEIT conceded  default stray innings (ignored)
     *   H9  NO_RESULT, no ball bowled: not counted, reported
     *   H10 ABANDONED with play: Hawks 45/2/30 v 0/0/0 (counted as a no result; never a high, low or NRR)
     *   H11 WON 40 runs, SUMMARY level, match deactivated: 160/5/120 v 120/10/100 AO, no extras
     *   H12 WON, the opposition innings is missing: Hawks 130/4/120, scheduled balls unknown
     *   H15 s1/l2, 8 balls per over, 160 scheduled: WON 30 runs, 150/5/160 v 120/9/160
     *   D1  derby v Kites WON 20 runs: 150/5/120 v 130/9/120, opposition extras 7 (4, 1, 1, 1, 0)
     *   H18 WON 50 runs again, later than H1: 200/8/120 v 150/10/110 AO, opponent "Late Visitors"
     *   H16 s2/l1 WON 20 runs: 130/6/120 v 110/10/100 AO
     *   H17 s2 friendly, scheduled 60: WON 6 wickets chasing 90/10/55 AO with 91/3/50 (10 balls left)
     *   D2  s2 friendly derby v Kites TIE: 120/6/120 v 120/8/120
     * Kites   the other side of D1 (lost) and D2 (tie)
     * Owls    s1/l1 DRAW 160/5/120 v 140/6/120
     * Swifts  X1 v free-text "Occasionals", X2 v Rivals TS (another club's team), identical: WON 20 runs 140/4/120 v 120/8/120, extras 6
     * Doves   s1/l1: DV1 won by DLS chasing (190/2/100 v 160/6/120), DV2 lost by DLS all out 120/10/90, DV3 lost by DLS 30/1 in a full 120 balls
     * Wrens   no match
     * </pre>
     */
    public void seedTeamStats() {
        tsRivals = fixtures.team(other.club(), other.seniors(), "Rivals TS");
        tess = fixtures.player(w, "Tess", true);
        tsHawks = fixtures.team(w.club(), seniorsA, "TS Hawks");
        tsKites = fixtures.team(w.club(), seniorsA1, "TS Kites");
        tsOwls = fixtures.team(w.club(), w.seniors(), "TS Owls");
        tsSwifts = fixtures.team(w.club(), w.juniors(), "TS Swifts");
        tsDoves = fixtures.team(w.club(), seniorsA, "TS Doves");
        tsWrens = fixtures.team(w.club(), w.juniors(), "TS Wrens");

        Res h1 = tsResult("H1", tsHawks, null, s1, l1, true, "WON", "HOME", true);
        h1.set(1, "HOME", 200, 6, 120, false);
        h1.set(2, "AWAY", 150, 10, 100, true);
        h1.decide("REGULAR", "RUNS", 50, 120, 6);
        h1.extras(2, 12, 5, 2, 3, 2, 0);

        Res h2 = tsResult("H2", tsHawks, null, s1, l1, true, "WON", "HOME", true);
        h2.set(1, "AWAY", 180, 8, 120, false);
        h2.set(2, "HOME", 184, 4, 100, false);
        h2.decide("REGULAR", "WICKETS", 6, 120, 6);
        h2.extras(1, 8, 6, 1, 1, 0, null);

        Res h3 = tsResult("H3", tsHawks, null, s1, l1, true, "WON", "AWAY", true);
        h3.set(1, "HOME", 95, 10, 80, true);
        h3.set(2, "AWAY", 96, 2, 70, false);
        h3.decide("REGULAR", "WICKETS", 8, 120, 6);
        h3.extras(2, 5, null, null, null, null, null);

        Res h4 = tsResult("H4", tsHawks, null, s1, l1, true, "TIE", null, true);
        h4.set(1, "HOME", 140, 7, 120, false);
        h4.set(2, "AWAY", 140, 9, 120, false);
        h4.decide("REGULAR", null, null, 120, 6);

        Res h6 = tsResult("H6", tsHawks, null, s1, l1, true, "WON", "HOME", true);
        h6.set(1, "HOME", 100, 9, 120, false);
        h6.set(2, "AWAY", 100, 8, 120, false);
        h6.decide("SUPER_OVER", null, null, 120, 6);
        h6.innings(3, "SUPER_OVER", "HOME", 15, 0, 6);
        h6.innings(4, "SUPER_OVER", "AWAY", 12, 1, 6);

        tsResult("H7", tsHawks, null, s1, l1, true, "FORFEIT", "HOME", false);
        tsResult("H8", tsHawks, null, s1, l1, true, "FORFEIT", "AWAY", false);

        Res h9 = tsResult("H9", tsHawks, null, s1, l1, true, "NO_RESULT", null, true);
        h9.inningsBalls(0, 0);

        Res h10 = tsResult("H10", tsHawks, null, s1, l1, true, "ABANDONED", null, true);
        h10.set(1, "HOME", 45, 2, 30, false);
        h10.set(2, "AWAY", 0, 0, 0, false);
        h10.decide("REGULAR", null, null, 120, 6);

        Res h11 = tsResult("H11", tsHawks, null, s1, l1, false, "WON", "HOME", true);
        h11.set(1, "HOME", 160, 5, 120, false);
        h11.set(2, "AWAY", 120, 10, 100, true);
        h11.decide("REGULAR", "RUNS", 40, 120, 6);
        jdbc.update("update match_result set detail_level = 'SUMMARY' where id = ?", h11.id);

        Res h12 = tsResult("H12", tsHawks, null, s1, l1, true, "WON", "HOME", true);
        h12.set(1, "HOME", 130, 4, 120, false);
        h12.dropSecond();

        Res h15 = tsResult("H15", tsHawks, null, s1, l2, true, "WON", "HOME", true);
        h15.set(1, "HOME", 150, 5, 160, false);
        h15.set(2, "AWAY", 120, 9, 160, false);
        h15.decide("REGULAR", "RUNS", 30, 160, 8);

        Res d1 = tsResult("D1", tsHawks, tsKites, s1, l1, true, "WON", "HOME", true);
        d1.set(1, "HOME", 150, 5, 120, false);
        d1.set(2, "AWAY", 130, 9, 120, false);
        d1.decide("REGULAR", "RUNS", 20, 120, 6);
        d1.extras(2, 7, 4, 1, 1, 1, 0);

        Res h18 = tsResult("H18", tsHawks, null, s1, l1, true, "WON", "HOME", true);
        h18.set(1, "HOME", 200, 8, 120, false);
        h18.set(2, "AWAY", 150, 10, 110, true);
        h18.decide("REGULAR", "RUNS", 50, 120, 6);
        jdbc.update("update match set away_team_name = 'Late Visitors' where id = ?", tsMatches.get("H18").getId());

        Res h16 = tsResult("H16", tsHawks, null, s2, l1, true, "WON", "HOME", true);
        h16.set(1, "HOME", 130, 6, 120, false);
        h16.set(2, "AWAY", 110, 10, 100, true);
        h16.decide("REGULAR", "RUNS", 20, 120, 6);

        Res h17 = tsResult("H17", tsHawks, null, s2, null, true, "WON", "HOME", true);
        h17.set(1, "AWAY", 90, 10, 55, true);
        h17.set(2, "HOME", 91, 3, 50, false);
        h17.decide("REGULAR", "WICKETS", 6, 60, 6);

        Res d2 = tsResult("D2", tsHawks, tsKites, s2, null, true, "TIE", null, true);
        d2.set(1, "HOME", 120, 6, 120, false);
        d2.set(2, "AWAY", 120, 8, 120, false);
        d2.decide("REGULAR", null, null, 120, 6);

        for (String key : List.of("X1", "X2")) {
            Res x = tsResult(key, tsSwifts, "X2".equals(key) ? tsRivals : null, s1, l1, true, "WON", "HOME", false);
            x.set(1, "HOME", 140, 4, 120, false);
            x.set(2, "AWAY", 120, 8, 120, false);
            x.decide("REGULAR", "RUNS", 20, 120, 6);
            x.extras(2, 6, 3, 1, 1, 1, 0);
        }

        Res o1 = tsResult("O1", tsOwls, null, s1, l1, true, "DRAW", null, false);
        o1.set(1, "HOME", 160, 5, 120, false);
        o1.set(2, "AWAY", 140, 6, 120, false);
        o1.decide("REGULAR", null, null, 120, 6);

        Res dv1 = tsResult("DV1", tsDoves, null, s1, l1, true, "WON", "HOME", false);
        dv1.set(1, "AWAY", 160, 6, 120, false);
        dv1.set(2, "HOME", 190, 2, 100, false);
        dv1.decide("DLS", "WICKETS", 8, 120, 6);
        Res dv2 = tsResult("DV2", tsDoves, null, s1, l1, true, "WON", "AWAY", false);
        dv2.set(1, "HOME", 120, 10, 90, true);
        dv2.set(2, "AWAY", 80, 3, 60, false);
        dv2.decide("DLS", "RUNS", 5, 120, 6);
        Res dv3 = tsResult("DV3", tsDoves, null, s1, l1, true, "WON", "AWAY", false);
        dv3.set(1, "HOME", 30, 1, 120, false);
        dv3.set(2, "AWAY", 31, 0, 40, false);
        dv3.decide("DLS", "WICKETS", 10, 120, 6);
    }

    /** One scenario result of the home team {@code home} (and {@code away}, a free-text opponent when null). */
    private Res tsResult(String key, Team home, Team away, Season season, League league, boolean active, String outcome,
            String winningSide, boolean withTess) {
        Match m = match(home, away, season, league, active);
        tsMatches.put(key, m);
        Res r = published(m, outcome, winningSide);
        if (withTess) {
            r.ours("HOME", tess);
        }
        return r;
    }

    /** {@code n} more teams in Seniors A, each with one published win against a free-text opponent (statement-count guard). */
    public void addTeamBulk(int n) {
        for (int i = 0; i < n; i++) {
            Team t = fixtures.team(w.club(), seniorsA, "Bulk team " + i);
            Res r = published(match(t, null, s1, l1, true), "WON", "HOME");
            r.decide("REGULAR", "RUNS", 50, 120, 6);
        }
    }

    /** {@code n} more published results of the club in which the player bats, bowls and takes a catch. */
    public void addMatchesFor(PlayerProfile player, int n) {
        for (int i = 0; i < n; i++) {
            Res r = published(match(w.seniors1(), null, s1, l1, true), "WON", "HOME");
            UUID rp = r.ours("HOME", player);
            r.bat(rp, 1, "BOWLED", 10 + i % 5, 10, 1, 0);
            r.bowl(rp, 12, 0, 20, i % 4, null, null, null);
            r.field(rp, 1, 0, 0);
        }
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

        /** Rewrites the regular innings with this sequence (1 or 2) of the default result: who bats and its totals. */
        public void set(int sequence, String battingSide, int runs, int wickets, int balls, boolean allOut) {
            jdbc.update("update match_innings set batting_side = ?, runs = ?, wickets = ?, balls = ?, all_out = ?"
                            + " where match_result_id = ? and sequence = ?",
                    battingSide, runs, wickets, balls, allOut, id, sequence);
        }

        /** Removes the second regular innings (a published result may lack one). */
        public void dropSecond() {
            jdbc.update("delete from match_innings where id = ?", inn2);
        }

        /** How and by how much the result was decided, the scheduled quota and the balls in an over. */
        public void decide(String decidedBy, String marginType, Integer marginValue, Integer scheduledBalls,
                int ballsPerOver) {
            jdbc.update("update match_result set decided_by = ?, margin_type = ?, margin_value = ?, scheduled_balls = ?,"
                            + " balls_per_over = ? where id = ?",
                    decidedBy, marginType, marginValue, scheduledBalls, ballsPerOver, id);
        }

        /** The extras of the innings with this sequence: the total and its five components (null = not recorded). */
        public void extras(int sequence, Integer total, Integer wides, Integer noBalls, Integer byes, Integer legByes,
                Integer penaltyRuns) {
            jdbc.update("update match_innings set extras = ?, wides = ?, no_balls = ?, byes = ?, leg_byes = ?,"
                            + " penalty_runs = ? where match_result_id = ? and sequence = ?",
                    total, wides, noBalls, byes, legByes, penaltyRuns, id, sequence);
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

        /** A fielding row in a given innings (the one the player's side fielded in). */
        public void fieldIn(UUID innings, UUID rp, int catches, int stumpings, int runOuts) {
            jdbc.update("insert into fielding_entry (id, match_innings_id, result_player_id, catches, stumpings, run_outs)"
                            + " values (?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), innings, rp, catches, stumpings, runOuts);
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
