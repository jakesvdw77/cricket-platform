package com.cricketlegend.service.support;

import com.cricketlegend.domain.AwardType;
import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.ResultWizardStep;
import com.cricketlegend.dto.BattingEntryDto;
import com.cricketlegend.dto.BowlingEntryDto;
import com.cricketlegend.dto.FieldingEntryDto;
import com.cricketlegend.dto.InningsDto;
import com.cricketlegend.dto.MatchAwardDto;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.service.support.ResultValidator.ErrorCode;
import com.cricketlegend.service.support.ResultValidator.WarningCode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: the scorecard rules of {@link ResultValidator}. {@link
 * #structure} is what a save refuses (a malformed scorecard); {@link #validate} adds the errors that block publishing
 * and the reconciliation warnings against the result (acknowledged at publish) and the one info line. Nothing here
 * runs for an innings that lacks runs or balls, nor for a forfeit, abandoned or no-result match; only regular innings
 * are considered. Pure functions over the draft: the same rules serve save, validate, publish and imports.
 */
final class ScorecardRules {

    static final int LINEUP_SIZE = 11;
    private static final int MAX_NOT_OUT_WHEN_ALL_OUT = 1;
    private static final int MAX_NOT_OUT = 2;
    private static final Set<ResultOutcomeType> NO_PLAY = Set.of(
            ResultOutcomeType.FORFEIT, ResultOutcomeType.ABANDONED, ResultOutcomeType.NO_RESULT);

    private ScorecardRules() {}

    // ---- structure (what a save refuses) ----

    static void structure(ResultDraft draft, ResultIssues issues) {
        structure(draft, "", "", ScorecardContext.none(), issues);
    }

    /** As above; the side names and the club's player names make a duplicate-player message say who and where. */
    static void structure(
            ResultDraft draft, String homeName, String awayName, ScorecardContext context, ResultIssues issues) {
        ScorecardDto scorecard = draft.scorecard();
        if (scorecard == null) {
            return;
        }
        Map<String, ResultPlayerDto> players = playersByRef(
                scorecard, new Names(homeName, awayName), context == null ? ScorecardContext.none() : context, issues);
        boolean anyRegular = draft.innings().stream().anyMatch(i -> i.kind() == InningsKind.REGULAR);
        if (!scorecard.players().isEmpty() && !anyRegular) {
            issues.error(ErrorCode.SCORECARD_NO_INNINGS, ResultWizardStep.SCORES, null,
                    "Enter the innings scores before adding a scorecard.");
        }
        Set<String> battingKeys = new HashSet<>();
        Map<String, Set<Integer>> positions = new HashMap<>();
        for (BattingEntryDto e : scorecard.batting()) {
            if (!inningsExists(draft, e.inningsKind(), e.battingSide(), ResultWizardStep.OUR_BATTING, issues)) {
                continue;
            }
            ResultPlayerDto player = player(players, e.resultPlayerId(), e.playerClientKey(), e.battingSide(),
                    e.battingSide(), ResultWizardStep.OUR_BATTING, issues);
            if (player == null) {
                continue;
            }
            duplicateEntry(battingKeys, "bat", e.battingSide(), player, e.resultPlayerId(), e.playerClientKey(),
                    ResultWizardStep.OUR_BATTING, issues);
            if (e.howOut() == null) {
                issues.error(ErrorCode.SCORECARD_HOW_OUT_MISSING, ResultWizardStep.OUR_BATTING, e.battingSide(),
                        "Choose how " + label(player, null) + " was out, or mark not out or did not bat.");
            }
            if (negative(e.runs()) || negative(e.balls()) || negative(e.fours()) || negative(e.sixes())) {
                issues.error(ErrorCode.SCORECARD_NEGATIVE_FIGURE, ResultWizardStep.OUR_BATTING, e.battingSide(),
                        "A batter's figures cannot be negative.");
            }
            if (e.position() != null) {
                if (e.position() < 1) {
                    issues.error(ErrorCode.SCORECARD_POSITION_INVALID, ResultWizardStep.OUR_BATTING, e.battingSide(),
                            "Batting positions start at 1.");
                } else if (!positions.computeIfAbsent(e.battingSide().name(), k -> new HashSet<>())
                        .add(e.position())) {
                    issues.error(ErrorCode.SCORECARD_POSITION_DUPLICATE, ResultWizardStep.OUR_BATTING, e.battingSide(),
                            "Two players are marked as batting number " + e.position() + ".");
                }
            }
        }
        Set<String> bowlingKeys = new HashSet<>();
        for (BowlingEntryDto e : scorecard.bowling()) {
            if (!inningsExists(draft, e.inningsKind(), e.battingSide(), ResultWizardStep.OUR_BOWLING, issues)) {
                continue;
            }
            ResultSide ours = other(e.battingSide());
            ResultPlayerDto player = player(players, e.resultPlayerId(), e.playerClientKey(), ours,
                    ours, ResultWizardStep.OUR_BOWLING, issues);
            if (player == null) {
                continue;
            }
            duplicateEntry(bowlingKeys, "bowl", e.battingSide(), player, e.resultPlayerId(), e.playerClientKey(),
                    ResultWizardStep.OUR_BOWLING, issues);
            if (negative(e.balls()) || negative(e.maidens()) || negative(e.runs()) || negative(e.wickets())
                    || negative(e.wides()) || negative(e.noBalls()) || negative(e.bowlingOrder())) {
                issues.error(ErrorCode.SCORECARD_NEGATIVE_FIGURE, ResultWizardStep.OUR_BOWLING, ours,
                        "A bowler's figures cannot be negative.");
            }
        }
        Set<String> fieldingKeys = new HashSet<>();
        for (FieldingEntryDto e : scorecard.fielding()) {
            if (!inningsExists(draft, e.inningsKind(), e.battingSide(), ResultWizardStep.OUR_BOWLING, issues)) {
                continue;
            }
            ResultSide ours = other(e.battingSide());
            ResultPlayerDto player = player(players, e.resultPlayerId(), e.playerClientKey(), ours,
                    ours, ResultWizardStep.OUR_BOWLING, issues);
            if (player == null) {
                continue;
            }
            duplicateEntry(fieldingKeys, "field", e.battingSide(), player, e.resultPlayerId(), e.playerClientKey(),
                    ResultWizardStep.OUR_BOWLING, issues);
            if (negative(e.catches()) || negative(e.stumpings()) || negative(e.runOuts())) {
                issues.error(ErrorCode.SCORECARD_NEGATIVE_FIGURE, ResultWizardStep.OUR_BOWLING, ours,
                        "A fielder's credits cannot be negative.");
            }
        }
        awardStructure(scorecard, players, issues);
    }

    private static Map<String, ResultPlayerDto> playersByRef(
            ScorecardDto scorecard, Names names, ScorecardContext context, ResultIssues issues) {
        Map<String, ResultPlayerDto> byRef = new HashMap<>();
        Set<String> profileKeys = new HashSet<>();
        Set<String> guestKeys = new HashSet<>();
        for (ResultPlayerDto p : scorecard.players()) {
            if (p.id() == null && blank(p.clientKey())) {
                issues.error(ErrorCode.SCORECARD_PLAYER_KEY_MISSING, ResultWizardStep.OUR_BATTING, p.side(),
                        "A new player on the scorecard needs a client key.");
            }
            for (String ref : refs(p)) {
                if (byRef.put(ref, p) != null) {
                    issues.error(ErrorCode.SCORECARD_PLAYER_KEY_DUPLICATE, ResultWizardStep.OUR_BATTING, p.side(),
                            "Two players on the scorecard share the key " + ref + ".");
                }
            }
            if (p.side() == null) {
                issues.error(ErrorCode.SCORECARD_PLAYER_SIDE_MISSING, ResultWizardStep.OUR_BATTING, null,
                        "Every player on the scorecard needs a side.");
                continue;
            }
            if (p.playerProfileId() == null && blank(p.displayName())) {
                issues.error(ErrorCode.SCORECARD_PLAYER_IDENTITY_MISSING, ResultWizardStep.OUR_BATTING, p.side(),
                        "Every player on the scorecard needs a registered player or a name.");
            } else if (p.playerProfileId() != null) {
                if (!profileKeys.add(p.side() + ":" + p.playerProfileId())) {
                    issues.error(ErrorCode.SCORECARD_PLAYER_DUPLICATE, ResultWizardStep.OUR_BATTING, p.side(),
                            label(p, context) + " is on the scorecard twice for the " + names.sideLabel(p.side()) + ".");
                }
            } else if (!guestKeys.add(p.side() + ":" + ScorecardContext.normalise(p.displayName()))) {
                issues.error(ErrorCode.SCORECARD_PLAYER_DUPLICATE, ResultWizardStep.OUR_BATTING, p.side(),
                        "Two guests are both called " + p.displayName().trim()
                                + ". Tell them apart, for example \"John (Dave's friend)\".");
            }
        }
        return byRef;
    }

    private static List<String> refs(ResultPlayerDto p) {
        List<String> refs = new ArrayList<>(2);
        if (p.id() != null) {
            refs.add(p.id().toString());
        }
        if (!blank(p.clientKey())) {
            refs.add(p.clientKey());
        }
        return refs;
    }

    private static boolean inningsExists(
            ResultDraft draft, InningsKind kind, ResultSide battingSide, ResultWizardStep step, ResultIssues issues) {
        if (kind == InningsKind.SUPER_OVER) {
            issues.error(ErrorCode.SCORECARD_SUPER_OVER_NOT_SUPPORTED, step, null,
                    "A scorecard for a super over is not supported yet.");
            return false;
        }
        if (battingSide == null || draft.innings().stream()
                .noneMatch(i -> i.kind() == InningsKind.REGULAR && i.battingSide() == battingSide)) {
            issues.error(ErrorCode.SCORECARD_INNINGS_MISSING, step, battingSide,
                    "The scorecard has an entry for an innings that is not in the result.");
            return false;
        }
        return true;
    }

    /** The scorecard player an entry refers to, which must be on the side the entry belongs to. */
    private static ResultPlayerDto player(
            Map<String, ResultPlayerDto> players, UUID id, String clientKey, ResultSide expectedSide, ResultSide side,
            ResultWizardStep step, ResultIssues issues) {
        ResultPlayerDto player = lookup(players, id, clientKey);
        if (player == null) {
            issues.error(ErrorCode.SCORECARD_PLAYER_UNKNOWN, step, side,
                    "A scorecard row refers to a player who is not on the scorecard.");
            return null;
        }
        if (player.side() != expectedSide) {
            issues.error(ErrorCode.SCORECARD_PLAYER_SIDE_MISMATCH, step, side,
                    label(player, null) + " is on the other side's list but has a row for this side.");
            return null;
        }
        return player;
    }

    private static void duplicateEntry(
            Set<String> seen, String table, ResultSide battingSide, ResultPlayerDto player, UUID id, String clientKey,
            ResultWizardStep step, ResultIssues issues) {
        String ref = id != null ? id.toString() : clientKey;
        if (!seen.add(table + ":" + battingSide + ":" + ref)) {
            issues.error(ErrorCode.SCORECARD_DUPLICATE_ENTRY, step, player.side(),
                    label(player, null) + " has two rows in the same innings.");
        }
    }

    private static void awardStructure(ScorecardDto scorecard, Map<String, ResultPlayerDto> players, ResultIssues issues) {
        int official = 0;
        Map<ResultSide, Integer> teamAwards = new HashMap<>();
        for (MatchAwardDto a : scorecard.awards()) {
            if (a.awardType() == null || a.side() == null) {
                issues.error(ErrorCode.SCORECARD_PLAYER_UNKNOWN, ResultWizardStep.AWARDS, a.side(),
                        "An award needs its type and side.");
                continue;
            }
            if (a.awardType() == AwardType.PLAYER_OF_MATCH) {
                official++;
            } else if (teamAwards.merge(a.side(), 1, Integer::sum) > 1) {
                issues.error(ErrorCode.AWARD_DUPLICATE_TEAM, ResultWizardStep.AWARDS, a.side(),
                        "There can be only one team player of the match for a side.");
            }
            boolean named = a.resultPlayerId() != null || !blank(a.playerClientKey());
            if (named && lookup(players, a.resultPlayerId(), a.playerClientKey()) == null) {
                issues.error(ErrorCode.SCORECARD_PLAYER_UNKNOWN, ResultWizardStep.AWARDS, a.side(),
                        "An award refers to a player who is not on the scorecard.");
            }
        }
        if (official > 1) {
            issues.error(ErrorCode.AWARD_DUPLICATE_OFFICIAL, ResultWizardStep.AWARDS, null,
                    "There can be only one official player of the match.");
        }
    }

    private static ResultPlayerDto lookup(Map<String, ResultPlayerDto> players, UUID id, String clientKey) {
        return id != null ? players.get(id.toString()) : (blank(clientKey) ? null : players.get(clientKey));
    }

    // ---- validation (what blocks a publish, and what is acknowledged) ----

    static void validate(
            ResultDraft draft, ResultOutcomeType outcome, String homeName, String awayName, ScorecardContext context,
            ResultIssues issues) {
        ScorecardDto scorecard = draft.scorecard();
        if (scorecard == null || scorecard.players().isEmpty()) {
            return;
        }
        Names names = new Names(homeName, awayName);
        lineupChecks(scorecard, names, context, issues);
        awardChecks(scorecard, issues);
        if (NO_PLAY.contains(outcome)) {
            return;
        }
        Map<String, ResultPlayerDto> players = new HashMap<>();
        scorecard.players().forEach(p -> refs(p).forEach(ref -> players.put(ref, p)));
        List<InningsDto> regular = draft.innings().stream()
                .filter(i -> i.kind() == InningsKind.REGULAR && i.battingSide() != null)
                .sorted(Comparator.comparingInt(InningsDto::sequence))
                .toList();
        for (InningsDto innings : regular) {
            if (innings.runs() == null || innings.balls() == null) {
                continue;
            }
            Inn inn = new Inn(innings, draft.ballsPerOver(), scorecard, players);
            battingChecks(inn, issues);
            bowlingChecks(inn, context, issues);
        }
    }

    private static void lineupChecks(ScorecardDto scorecard, Names names, ScorecardContext context, ResultIssues issues) {
        for (ResultSide side : ResultSide.values()) {
            List<ResultPlayerDto> onSide = scorecard.players().stream().filter(p -> p.side() == side).toList();
            long eleven = onSide.stream().filter(p -> !p.substitute()).count();
            if (eleven > LINEUP_SIZE) {
                issues.warning(WarningCode.LINEUP_TOO_LARGE, ResultWizardStep.OUR_BATTING, side,
                        names.of(side) + " has " + eleven + " players listed; a side fields " + LINEUP_SIZE
                                + ". Mark the extra ones as substitutes if they only fielded.");
            }
            Set<UUID> squad = context.squadBySide().get(side);
            for (ResultPlayerDto p : onSide) {
                if (p.playerProfileId() != null && squad != null && !squad.contains(p.playerProfileId())) {
                    issues.warning(WarningCode.PLAYER_NOT_IN_SQUAD, ResultWizardStep.OUR_BATTING, side,
                            label(p, context) + " is not in the squad of " + names.of(side) + " this season.");
                }
                if (p.playerProfileId() == null && !blank(p.displayName())) {
                    UUID registered = context.registeredPlayersByName().get(ScorecardContext.normalise(p.displayName()));
                    if (registered != null) {
                        issues.warning(WarningCode.GUEST_NAME_MATCHES_PLAYER, ResultWizardStep.OUR_BATTING, side,
                                "The guest \"" + p.displayName().trim() + "\" has the same name as a registered player."
                                        + " Use that player instead?");
                    }
                }
            }
        }
        Set<UUID> homeProfiles = profiles(scorecard, ResultSide.HOME);
        for (ResultPlayerDto p : scorecard.players()) {
            if (p.side() == ResultSide.AWAY && p.playerProfileId() != null && homeProfiles.contains(p.playerProfileId())) {
                issues.warning(WarningCode.PLAYER_ON_BOTH_SIDES, ResultWizardStep.OUR_BATTING, null,
                        label(p, context) + " is listed for both " + names.of(ResultSide.HOME) + " and "
                                + names.of(ResultSide.AWAY) + ". Check that they really played for both.");
            }
        }
        Map<String, ResultPlayerDto> homeGuests = new HashMap<>();
        scorecard.players().stream()
                .filter(p -> p.side() == ResultSide.HOME && p.playerProfileId() == null && !blank(p.displayName()))
                .forEach(p -> homeGuests.put(ScorecardContext.normalise(p.displayName()), p));
        for (ResultPlayerDto p : scorecard.players()) {
            if (p.side() == ResultSide.AWAY && p.playerProfileId() == null && !blank(p.displayName())
                    && homeGuests.containsKey(ScorecardContext.normalise(p.displayName()))) {
                issues.info(WarningCode.GUEST_ON_BOTH_SIDES, ResultWizardStep.OUR_BATTING, ResultSide.AWAY,
                        p.displayName().trim() + " is also a guest on " + names.of(ResultSide.HOME) + ".");
            }
        }
    }

    private static Set<UUID> profiles(ScorecardDto scorecard, ResultSide side) {
        Set<UUID> ids = new HashSet<>();
        scorecard.players().stream()
                .filter(p -> p.side() == side && p.playerProfileId() != null)
                .forEach(p -> ids.add(p.playerProfileId()));
        return ids;
    }

    private static void awardChecks(ScorecardDto scorecard, ResultIssues issues) {
        for (MatchAwardDto a : scorecard.awards()) {
            if (a.awardType() == AwardType.PLAYER_OF_MATCH && a.resultPlayerId() == null && blank(a.playerClientKey())
                    && blank(a.displayName())) {
                issues.error(ErrorCode.AWARD_PLAYER_MISSING, ResultWizardStep.AWARDS, null,
                        "The player of the match needs a player or a name.");
            }
        }
    }

    // ---- batting: our batters against the innings they batted in ----

    private static void battingChecks(Inn inn, ResultIssues issues) {
        if (inn.batting.isEmpty()) {
            return;
        }
        ResultSide side = inn.side;
        ResultWizardStep step = ResultWizardStep.OUR_BATTING;
        int batterRuns = 0;
        int wicketCount = 0;
        int notOut = 0;
        for (BattingEntryDto e : inn.batting) {
            if (e.howOut() == null) {
                continue;
            }
            String who = label(inn.players.get(ref(e.resultPlayerId(), e.playerClientKey())), null);
            if (e.howOut() == DismissalType.DID_NOT_BAT) {
                if (e.runs() != null || e.balls() != null || e.fours() != null || e.sixes() != null) {
                    issues.error(ErrorCode.DID_NOT_BAT_WITH_FIGURES, step, side,
                            who + " is marked did not bat but has figures.");
                }
                continue;
            }
            if (e.runs() == null) {
                issues.error(ErrorCode.BATTER_RUNS_MISSING, step, side, who + " batted but has no runs entered.");
            } else {
                batterRuns += e.runs();
                int boundaries = zero(e.fours()) * 4 + zero(e.sixes()) * 6;
                if (boundaries > e.runs()) {
                    issues.error(ErrorCode.BOUNDARIES_EXCEED_RUNS, step, side,
                            who + " has " + boundaries + " runs in boundaries but only " + e.runs() + " runs.");
                }
            }
            if (e.howOut().isWicket()) {
                wicketCount++;
            }
            if (e.howOut() == DismissalType.NOT_OUT) {
                notOut++;
            }
        }
        if (inn.innings.wickets() != null && wicketCount != inn.innings.wickets()) {
            issues.warning(WarningCode.BATTERS_OUT_NOT_WICKETS, step, side,
                    "Innings " + inn.innings.sequence() + ": " + wicketCount + " batters are out, but the result says "
                            + inn.innings.wickets() + " wickets.");
        }
        boolean allOut = Boolean.TRUE.equals(inn.innings.allOut());
        if (notOut > (allOut ? MAX_NOT_OUT_WHEN_ALL_OUT : MAX_NOT_OUT)) {
            issues.warning(WarningCode.NOT_OUT_COUNT, step, side,
                    "Innings " + inn.innings.sequence() + ": " + notOut + " batters are not out"
                            + (allOut ? " in an innings that was all out." : "."));
        }
        if (inn.innings.extras() != null && batterRuns + inn.innings.extras() != inn.innings.runs()) {
            issues.warning(WarningCode.BATTING_TOTAL_MISMATCH, step, side,
                    "Innings " + inn.innings.sequence() + ": the batters' " + batterRuns + " runs plus "
                            + inn.innings.extras() + " extras make " + (batterRuns + inn.innings.extras())
                            + ", but the innings total is " + inn.innings.runs() + ".");
        } else if (inn.innings.extras() == null && batterRuns > inn.innings.runs()) {
            issues.warning(WarningCode.BATTING_TOTAL_MISMATCH, step, side,
                    "Innings " + inn.innings.sequence() + ": the batters' " + batterRuns
                            + " runs are more than the innings total of " + inn.innings.runs() + ".");
        }
    }

    // ---- bowling and fielding: our bowlers against the innings the other side batted ----

    private static void bowlingChecks(Inn inn, ScorecardContext context, ResultIssues issues) {
        ResultSide ours = other(inn.side);
        ResultWizardStep step = ResultWizardStep.OUR_BOWLING;
        InningsDto innings = inn.innings;
        String label = "Innings " + innings.sequence();
        int nonBowlerWickets = inn.nonBowlerWickets();
        if (!inn.bowling.isEmpty()) {
            int balls = inn.bowling.stream().mapToInt(b -> zero(b.balls())).sum();
            int runs = inn.bowling.stream().mapToInt(b -> zero(b.runs())).sum();
            int wickets = inn.bowling.stream().mapToInt(b -> zero(b.wickets())).sum();
            for (BowlingEntryDto b : inn.bowling) {
                String who = label(inn.players.get(ref(b.resultPlayerId(), b.playerClientKey())), context);
                if (zero(b.maidens()) > zero(b.balls()) / inn.ballsPerOver) {
                    issues.error(ErrorCode.MAIDENS_EXCEED_OVERS, step, ours,
                            who + " has more maidens than complete overs bowled.");
                }
                if (context.maxBallsPerBowler() != null && zero(b.balls()) > context.maxBallsPerBowler()) {
                    issues.warning(WarningCode.BOWLER_OVERS_EXCEED_LIMIT, step, ours,
                            who + " bowled more than the league's maximum of "
                                    + OversFormat.display(context.maxBallsPerBowler(), inn.ballsPerOver) + " overs.");
                }
            }
            if (balls != innings.balls()) {
                issues.warning(WarningCode.BOWLER_BALLS_MISMATCH, step, ours,
                        label + ": the bowlers bowled " + OversFormat.display(balls, inn.ballsPerOver)
                                + " overs, but the innings lasted " + OversFormat.display(innings.balls(), inn.ballsPerOver)
                                + ".");
            }
            if (innings.hasExtrasBreakdown()) {
                int charged = runs + zero(innings.byes()) + zero(innings.legByes()) + zero(innings.penaltyRuns());
                if (charged != innings.runs()) {
                    issues.warning(WarningCode.BOWLING_RUNS_MISMATCH, step, ours,
                            label + ": the bowlers' " + runs + " runs plus " + (charged - runs)
                                    + " byes, leg byes and penalty runs make " + charged + ", but the innings total is "
                                    + innings.runs() + ".");
                }
            } else if (runs > innings.runs()) {
                issues.warning(WarningCode.BOWLING_RUNS_MISMATCH, step, ours,
                        label + ": the bowlers conceded " + runs + " runs, more than the innings total of "
                                + innings.runs() + ".");
            }
            if (innings.wickets() != null && wickets + nonBowlerWickets != innings.wickets()) {
                issues.warning(WarningCode.BOWLER_WICKETS_MISMATCH, step, ours,
                        label + ": the bowlers' " + wickets + " wickets plus " + nonBowlerWickets
                                + " not credited to a bowler make " + (wickets + nonBowlerWickets)
                                + ", but the result says " + innings.wickets() + ".");
            }
            if (innings.wides() != null && inn.bowling.stream().anyMatch(b -> b.wides() != null)
                    && inn.bowling.stream().mapToInt(b -> zero(b.wides())).sum() != innings.wides()) {
                issues.warning(WarningCode.WIDES_MISMATCH, step, ours,
                        label + ": the bowlers' wides do not add up to the " + innings.wides() + " wides in the innings.");
            }
            if (innings.noBalls() != null && inn.bowling.stream().anyMatch(b -> b.noBalls() != null)
                    && inn.bowling.stream().mapToInt(b -> zero(b.noBalls())).sum() != innings.noBalls()) {
                issues.warning(WarningCode.NO_BALLS_MISMATCH, step, ours,
                        label + ": the bowlers' no-balls do not add up to the " + innings.noBalls()
                                + " no-balls in the innings.");
            }
        }
        if (!inn.fielding.isEmpty()) {
            int credits = inn.fielding.stream()
                    .mapToInt(f -> zero(f.catches()) + zero(f.stumpings()) + zero(f.runOuts())).sum();
            int runOuts = inn.fielding.stream().mapToInt(f -> zero(f.runOuts())).sum();
            if ((innings.wickets() != null && credits > innings.wickets()) || runOuts > nonBowlerWickets) {
                issues.warning(WarningCode.FIELDING_EXCEEDS_WICKETS, step, ours,
                        label + ": the fielding credits (" + credits + ") are more than the wickets that fell.");
            }
        }
    }

    /** One regular innings with the scorecard rows that belong to it, found once. */
    private static final class Inn {
        final InningsDto innings;
        final ResultSide side;
        final int ballsPerOver;
        final Map<String, ResultPlayerDto> players;
        final List<BattingEntryDto> batting;
        final List<BowlingEntryDto> bowling;
        final List<FieldingEntryDto> fielding;

        Inn(InningsDto innings, int ballsPerOver, ScorecardDto scorecard, Map<String, ResultPlayerDto> players) {
            this.innings = innings;
            this.side = innings.battingSide();
            this.ballsPerOver = Math.max(1, ballsPerOver);
            this.players = players;
            this.batting = scorecard.batting().stream()
                    .filter(e -> e.battingSide() == side && e.inningsKind() != InningsKind.SUPER_OVER).toList();
            this.bowling = scorecard.bowling().stream()
                    .filter(e -> e.battingSide() == side && e.inningsKind() != InningsKind.SUPER_OVER).toList();
            this.fielding = scorecard.fielding().stream()
                    .filter(e -> e.battingSide() == side && e.inningsKind() != InningsKind.SUPER_OVER).toList();
        }

        /** Wickets not credited to a bowler: derived from our batters when they are on the scorecard, else entered. */
        int nonBowlerWickets() {
            if (!batting.isEmpty()) {
                return (int) batting.stream().filter(e -> e.howOut() != null && e.howOut().isNonBowlerWicket()).count();
            }
            return zero(innings.nonBowlerWickets());
        }
    }

    private record Names(String home, String away) {
        /** "Irene Villagers 1 side", or "home side" when the team has no name. */
        String sideLabel(ResultSide side) {
            String name = side == ResultSide.HOME ? home : away;
            return name == null || name.isBlank() ? (side == ResultSide.HOME ? "home side" : "away side") : name + " side";
        }

        String of(ResultSide side) {
            String name = side == ResultSide.HOME ? home : away;
            return name == null || name.isBlank() ? (side == ResultSide.HOME ? "The home side" : "The away side") : name;
        }
    }

    // ---- helpers ----

    private static String ref(UUID id, String clientKey) {
        return id != null ? id.toString() : clientKey;
    }

    private static String label(ResultPlayerDto player, ScorecardContext context) {
        if (player == null) {
            return "A player";
        }
        if (player.playerProfileId() != null && context != null) {
            String name = context.playerNames().get(player.playerProfileId());
            if (name != null) {
                return name;
            }
        }
        if (!blank(player.displayName())) {
            return player.displayName().trim();
        }
        if (!blank(player.firstName()) || !blank(player.lastName())) {
            return ((player.firstName() == null ? "" : player.firstName()) + " "
                    + (player.lastName() == null ? "" : player.lastName())).trim();
        }
        return "A player";
    }

    private static ResultSide other(ResultSide side) {
        return side == ResultSide.HOME ? ResultSide.AWAY : ResultSide.HOME;
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean negative(Integer value) {
        return value != null && value < 0;
    }

    private static int zero(Integer value) {
        return value == null ? 0 : value;
    }
}
