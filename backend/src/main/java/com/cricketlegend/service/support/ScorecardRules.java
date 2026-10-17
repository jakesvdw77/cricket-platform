package com.cricketlegend.service.support;

import com.cricketlegend.domain.AwardType;
import com.cricketlegend.domain.CreditSource;
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
import com.cricketlegend.domain.ScorecardSelectionState;
import com.cricketlegend.service.support.DismissalCredits.Credit;
import com.cricketlegend.service.support.DismissalCredits.Dismissal;
import com.cricketlegend.service.support.ResultValidator.ErrorCode;
import com.cricketlegend.service.support.ResultValidator.WarningCode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * docs/specs/101-match-results-our-side-scorecard.md: the scorecard rules of {@link ResultValidator}. {@link
 * #structure} is what a save refuses (a malformed scorecard); {@link #validate} adds the errors that block publishing
 * and the reconciliation warnings against the result (acknowledged at publish) and the one info line. Nothing here
 * runs for an innings that lacks runs or balls, nor for a forfeit, abandoned or no-result match; only regular innings
 * are considered. Every rule runs for either side's entries (ours and the opposition's); the rules about registered
 * players, squads and guests apply to our players only. A scorecard may hold players alone (a team list saved before
 * the game): only an entry needs its innings. Pure functions over the draft: the same rules serve save, validate, publish and imports.
 */
final class ScorecardRules {

    static final int LINEUP_SIZE = 11;
    private static final int MAX_NOT_OUT_WHEN_ALL_OUT = 1;
    private static final int MAX_NOT_OUT = 2;
    private static final Set<ResultOutcomeType> NO_PLAY = Set.of(
            ResultOutcomeType.FORFEIT, ResultOutcomeType.ABANDONED, ResultOutcomeType.NO_RESULT);

    /** Free text is stored in VARCHAR(255) columns; list sizes bound a save (a side fields eleven plus a few). */
    static final int MAX_NAME_LENGTH = 255;
    static final int MAX_PLAYERS = 60;
    static final int MAX_ENTRY_ROWS = 200;

    private ScorecardRules() {}

    /** Size and length limits, checked before anything else so an oversized payload is a 400, never a database error. */
    private static boolean withinLimits(ScorecardDto scorecard, ResultIssues issues) {
        boolean ok = true;
        if (scorecard.players().size() > MAX_PLAYERS) {
            issues.error(ErrorCode.SCORECARD_TOO_MANY_PLAYERS, ResultWizardStep.TEAMS, null,
                    "A scorecard can list at most " + MAX_PLAYERS + " players.");
            ok = false;
        }
        if (scorecard.batting().size() > MAX_ENTRY_ROWS || scorecard.bowling().size() > MAX_ENTRY_ROWS
                || scorecard.fielding().size() > MAX_ENTRY_ROWS) {
            issues.error(ErrorCode.SCORECARD_TOO_MANY_ROWS, ResultWizardStep.BATTING, null,
                    "A scorecard can hold at most " + MAX_ENTRY_ROWS + " batting, bowling or fielding rows each.");
            ok = false;
        }
        boolean longName = scorecard.players().stream().anyMatch(p -> tooLong(p.displayName()))
                || scorecard.awards().stream().anyMatch(a -> tooLong(a.displayName()));
        if (longName) {
            issues.error(ErrorCode.SCORECARD_NAME_TOO_LONG, ResultWizardStep.TEAMS, null,
                    "A name can be at most " + MAX_NAME_LENGTH + " characters.");
            ok = false;
        }
        return ok;
    }

    private static boolean tooLong(String name) {
        return name != null && name.trim().length() > MAX_NAME_LENGTH;
    }

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
        if (!withinLimits(scorecard, issues)) {
            return;
        }
        Map<String, ResultPlayerDto> players = playersByRef(
                scorecard, new Names(homeName, awayName), context == null ? ScorecardContext.none() : context, issues);
        Set<String> battingKeys = new HashSet<>();
        Map<String, Set<Integer>> positions = new HashMap<>();
        for (BattingEntryDto e : scorecard.batting()) {
            if (!inningsExists(draft, e.inningsKind(), e.battingSide(), ResultWizardStep.BATTING, issues)) {
                continue;
            }
            ResultPlayerDto player = player(players, e.resultPlayerId(), e.playerClientKey(), e.battingSide(),
                    e.battingSide(), ResultWizardStep.BATTING, issues);
            if (player == null) {
                continue;
            }
            duplicateEntry(battingKeys, "bat", e.battingSide(), player, e.resultPlayerId(), e.playerClientKey(),
                    ResultWizardStep.BATTING, issues);
            noStandoutOnOpposition(player, e.featuredOverride(), ResultWizardStep.BATTING, issues);
            dismissalStructure(e, players, issues);
            if (negative(e.runs()) || negative(e.balls()) || negative(e.fours()) || negative(e.sixes())) {
                issues.error(ErrorCode.SCORECARD_NEGATIVE_FIGURE, ResultWizardStep.BATTING, e.battingSide(),
                        "A batter's figures cannot be negative.");
            }
            if (e.position() != null) {
                if (e.position() < 1) {
                    issues.error(ErrorCode.SCORECARD_POSITION_INVALID, ResultWizardStep.BATTING, e.battingSide(),
                            "Batting positions start at 1.");
                } else if (!positions.computeIfAbsent(e.battingSide().name(), k -> new HashSet<>())
                        .add(e.position())) {
                    issues.error(ErrorCode.SCORECARD_POSITION_DUPLICATE, ResultWizardStep.BATTING, e.battingSide(),
                            "Two players are marked as batting number " + e.position() + ".");
                }
            }
        }
        Set<String> bowlingKeys = new HashSet<>();
        for (BowlingEntryDto e : scorecard.bowling()) {
            if (!inningsExists(draft, e.inningsKind(), e.battingSide(), ResultWizardStep.BOWLING, issues)) {
                continue;
            }
            ResultSide bowlingSide = other(e.battingSide());
            ResultPlayerDto player = player(players, e.resultPlayerId(), e.playerClientKey(), bowlingSide,
                    bowlingSide, ResultWizardStep.BOWLING, issues);
            if (player == null) {
                continue;
            }
            duplicateEntry(bowlingKeys, "bowl", e.battingSide(), player, e.resultPlayerId(), e.playerClientKey(),
                    ResultWizardStep.BOWLING, issues);
            noStandoutOnOpposition(player, e.featuredOverride(), ResultWizardStep.BOWLING, issues);
            if (negative(e.balls()) || negative(e.maidens()) || negative(e.runs()) || negative(e.wickets())
                    || negative(e.wides()) || negative(e.noBalls()) || negative(e.bowlingOrder())
                    || negative(e.dots())) {
                issues.error(ErrorCode.SCORECARD_NEGATIVE_FIGURE, ResultWizardStep.BOWLING, bowlingSide,
                        "A bowler's figures cannot be negative.");
            } else if (e.dots() != null && e.dots() > zero(e.balls())) {
                issues.error(ErrorCode.DOTS_EXCEED_BALLS, ResultWizardStep.BOWLING, bowlingSide,
                        label(player, null) + " has " + e.dots() + " dot balls but bowled only " + zero(e.balls())
                                + " balls.");
            }
        }
        Set<String> fieldingKeys = new HashSet<>();
        for (FieldingEntryDto e : scorecard.fielding()) {
            if (!inningsExists(draft, e.inningsKind(), e.battingSide(), ResultWizardStep.BOWLING, issues)) {
                continue;
            }
            ResultSide fieldingSide = other(e.battingSide());
            ResultPlayerDto player = player(players, e.resultPlayerId(), e.playerClientKey(), fieldingSide,
                    fieldingSide, ResultWizardStep.BOWLING, issues);
            if (player == null) {
                continue;
            }
            duplicateEntry(fieldingKeys, "field", e.battingSide(), player, e.resultPlayerId(), e.playerClientKey(),
                    ResultWizardStep.BOWLING, issues);
            noStandoutOnOpposition(player, e.featuredOverride(), ResultWizardStep.BOWLING, issues);
            if (negative(e.catches()) || negative(e.stumpings()) || negative(e.runOuts())) {
                issues.error(ErrorCode.SCORECARD_NEGATIVE_FIGURE, ResultWizardStep.BOWLING, fieldingSide,
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
                issues.error(ErrorCode.SCORECARD_PLAYER_KEY_MISSING, ResultWizardStep.TEAMS, p.side(),
                        "A new player on the scorecard needs a client key.");
            }
            for (String ref : refs(p)) {
                if (byRef.put(ref, p) != null) {
                    issues.error(ErrorCode.SCORECARD_PLAYER_KEY_DUPLICATE, ResultWizardStep.TEAMS, p.side(),
                            "Two players on the scorecard share the key " + ref + ".");
                }
            }
            if (p.side() == null) {
                issues.error(ErrorCode.SCORECARD_PLAYER_SIDE_MISSING, ResultWizardStep.TEAMS, null,
                        "Every player on the scorecard needs a side.");
                continue;
            }
            if (p.opposition() && (p.playerProfileId() != null || blank(p.displayName())
                    || p.plannedBattingOrder() != null || p.replacedPlayerProfileId() != null)) {
                issues.error(ErrorCode.OPPOSITION_PLAYER_INVALID, ResultWizardStep.TEAMS, p.side(),
                        "An opposition player is a name only: no registered player, planned order or replaced player.");
            }
            if (p.playerProfileId() == null && blank(p.displayName())) {
                issues.error(ErrorCode.SCORECARD_PLAYER_IDENTITY_MISSING, ResultWizardStep.TEAMS, p.side(),
                        "Every player on the scorecard needs a registered player or a name.");
            } else if (p.playerProfileId() != null) {
                if (!profileKeys.add(p.side() + ":" + p.playerProfileId())) {
                    issues.error(ErrorCode.SCORECARD_PLAYER_DUPLICATE, ResultWizardStep.TEAMS, p.side(),
                            label(p, context) + " is on the scorecard twice for the " + names.sideLabel(p.side()) + ".");
                }
            } else if (!guestKeys.add(p.side() + ":" + ScorecardContext.normalise(p.displayName()))) {
                issues.error(ErrorCode.SCORECARD_PLAYER_DUPLICATE, ResultWizardStep.TEAMS, p.side(),
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
            ResultPlayerDto awarded = named ? lookup(players, a.resultPlayerId(), a.playerClientKey()) : null;
            if (named && awarded == null) {
                issues.error(ErrorCode.SCORECARD_PLAYER_UNKNOWN, ResultWizardStep.AWARDS, a.side(),
                        "An award refers to a player who is not on the scorecard.");
            } else if (awarded != null && a.awardType() == AwardType.TEAM_PLAYER_OF_MATCH) {
                if (awarded.opposition()) {
                    issues.error(ErrorCode.AWARD_SIDE_NOT_OURS, ResultWizardStep.AWARDS, a.side(),
                            "A team player of the match must be one of our own players.");
                } else if (awarded.side() != a.side()) {
                    issues.error(ErrorCode.SCORECARD_PLAYER_SIDE_MISMATCH, ResultWizardStep.AWARDS, a.side(),
                            label(awarded, null) + " is on the other side's list.");
                }
            }
        }
        if (official > 1) {
            issues.error(ErrorCode.AWARD_DUPLICATE_OFFICIAL, ResultWizardStep.AWARDS, null,
                    "There can be only one official player of the match.");
        }
    }

    /** The opposition has no standouts: the server refuses an override on one of its entries. */
    private static void noStandoutOnOpposition(
            ResultPlayerDto player, Object featuredOverride, ResultWizardStep step, ResultIssues issues) {
        if (featuredOverride != null && player.opposition()) {
            issues.error(ErrorCode.OPPOSITION_NO_STANDOUTS, step, player.side(),
                    label(player, null) + " is on the opposition; the opposition has no standouts.");
        }
    }

    /**
     * The dismissal's bowler and fielder must be players of the scorecard, of the side that fielded, and only where
     * the way out allows them (a run-out has no bowler; a bowled has no fielder).
     */
    private static void dismissalStructure(
            BattingEntryDto e, Map<String, ResultPlayerDto> players, ResultIssues issues) {
        ResultSide fielding = other(e.battingSide());
        dismissalPlayer(e.bowlerPlayerId(), "bowler", e.howOut() == null || !e.howOut().allowsBowler(), e, fielding,
                players, issues);
        dismissalPlayer(e.fielderPlayerId(), "fielder", e.howOut() == null || !e.howOut().allowsFielder(), e, fielding,
                players, issues);
    }

    private static void dismissalPlayer(
            String ref, String role, boolean notAllowed, BattingEntryDto e, ResultSide fielding,
            Map<String, ResultPlayerDto> players, ResultIssues issues) {
        if (blank(ref)) {
            return;
        }
        ResultPlayerDto named = players.get(ref);
        if (named == null) {
            issues.error(ErrorCode.SCORECARD_PLAYER_UNKNOWN, ResultWizardStep.BATTING, e.battingSide(),
                    "A dismissal names a " + role + " who is not on the scorecard.");
            return;
        }
        if (named.side() != fielding) {
            issues.error(ErrorCode.DISMISSAL_PLAYER_WRONG_SIDE, ResultWizardStep.BATTING, e.battingSide(),
                    label(named, null) + " cannot be the " + role + " of a dismissal: they are on the batting side.");
        }
        if (notAllowed) {
            issues.error(ErrorCode.DISMISSAL_DETAIL_NOT_ALLOWED, ResultWizardStep.BATTING, e.battingSide(),
                    e.howOut() == null
                            ? "Choose how the batter was out before naming a " + role + "."
                            : "A dismissal of this kind (" + e.howOut() + ") has no " + role + ".");
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
        importChecks(scorecard, context, issues);
        awardChecks(scorecard, issues);
        oppositionChecks(scorecard, names, issues);
        if (outcome != null && NO_PLAY.contains(outcome)) {
            return;
        }
        teamSelectionChecks(scorecard, names, context, issues);
        Map<String, ResultPlayerDto> players = new HashMap<>();
        scorecard.players().forEach(p -> refs(p).forEach(ref -> players.put(ref, p)));
        List<InningsDto> regular = draft.innings().stream()
                .filter(i -> i.kind() == InningsKind.REGULAR && i.battingSide() != null)
                .sorted(Comparator.comparingInt(InningsDto::sequence))
                .toList();
        for (InningsDto innings : regular) {
            Inn inn = new Inn(innings, draft.ballsPerOver(), scorecard, players);
            battingChecks(inn, issues);
            bowlingChecks(inn, context, issues);
        }
    }

    /** Opposition players need one of our own sides' scorecards beside them to be published (open question 1). */
    private static void oppositionChecks(ScorecardDto scorecard, Names names, ResultIssues issues) {
        boolean anyOurs = scorecard.players().stream().anyMatch(p -> !p.opposition());
        if (anyOurs) {
            return;
        }
        scorecard.players().stream().filter(ResultPlayerDto::opposition).map(ResultPlayerDto::side).distinct()
                .forEach(side -> issues.error(ErrorCode.OPPOSITION_WITHOUT_OUR_SCORECARD, ResultWizardStep.TEAMS, side,
                        "The scorecard for " + names.of(side) + " is saved as a draft, but it cannot be published without "
                                + "a team list for our own side."));
    }

    /**
     * An INFO line (never blocks, nothing to acknowledge) for our side being captured with fewer than eleven
     * non-substitutes listed; eleven or more never raises it, whatever the selection state. Whether the team was
     * announced is irrelevant.
     */
    private static void teamSelectionChecks(
            ScorecardDto scorecard, Names names, ScorecardContext context, ResultIssues issues) {
        for (ResultSide side : ResultSide.values()) {
            List<ResultPlayerDto> onSide = scorecard.players().stream().filter(p -> p.side() == side).toList();
            if (onSide.isEmpty() || onSide.stream().anyMatch(ResultPlayerDto::opposition)) {
                continue;
            }
            ScorecardSelectionState state = context.selectionBySide().get(side);
            long listed = onSide.stream().filter(p -> !p.substitute()).count();
            if (listed >= LINEUP_SIZE) {
                continue;
            }
            if (state == ScorecardSelectionState.NONE) {
                issues.info(WarningCode.OUR_TEAM_NOT_SELECTED, ResultWizardStep.TEAMS, side,
                        "Our team is not selected for this match.");
            } else {
                issues.info(WarningCode.OUR_TEAM_NOT_SELECTED, ResultWizardStep.TEAMS, side,
                        "Only " + listed + " players are on " + names.of(side) + "'s team list.");
            }
        }
    }

    /**
     * docs/specs/104: an imported player linked by a rule that is a guess blocks publishing until the manager confirms
     * or changes it. Publish-time only (a save keeps the flag); never raised for guests, exact or aliased matches,
     * opposition names or a pick the manager made, none of which carry the flag.
     */
    private static void importChecks(ScorecardDto scorecard, ScorecardContext context, ResultIssues issues) {
        for (ResultPlayerDto p : scorecard.players()) {
            if (p.importMatch() == null || p.opposition()) {
                continue;
            }
            String said = blank(p.displayName()) ? "a name" : "'" + p.displayName().trim() + "'";
            issues.error(ResultValidator.ErrorCode.IMPORTED_NAME_UNCONFIRMED, ResultWizardStep.TEAMS, p.side(),
                    "File said " + said + ", matched to " + label(p, context) + ". Confirm or change this player.");
        }
    }

    private static void lineupChecks(ScorecardDto scorecard, Names names, ScorecardContext context, ResultIssues issues) {
        for (ResultSide side : ResultSide.values()) {
            List<ResultPlayerDto> onSide = scorecard.players().stream()
                    .filter(p -> p.side() == side && !p.opposition()).toList();
            long eleven = onSide.stream().filter(p -> !p.substitute() && tookPart(scorecard, p)).count();
            if (eleven > LINEUP_SIZE) {
                issues.warning(WarningCode.LINEUP_TOO_LARGE, ResultWizardStep.TEAMS, side,
                        names.of(side) + " has " + eleven + " players who took part; a side fields " + LINEUP_SIZE
                                + ". Mark the extra ones as substitutes if they only fielded.");
            }
            Set<UUID> squad = context.squadBySide().get(side);
            Map<UUID, List<ResultPlayerEligibility.Problem>> ineligible =
                    context.eligibilityProblems().getOrDefault(side, Map.of());
            for (ResultPlayerDto p : onSide) {
                if (p.playerProfileId() != null) {
                    // docs/specs/113: a registered player outside the team's section or the league's age rule is an error
                    for (ResultPlayerEligibility.Problem problem : ineligible.getOrDefault(p.playerProfileId(), List.of())) {
                        issues.error(problem.code(), ResultWizardStep.TEAMS, side, problem.message());
                    }
                }
                if (p.playerProfileId() != null && squad != null && !squad.contains(p.playerProfileId())) {
                    issues.warning(WarningCode.PLAYER_NOT_IN_SQUAD, ResultWizardStep.TEAMS, side,
                            label(p, context) + " is not in the squad of " + names.of(side) + " this season.");
                }
                if (p.playerProfileId() == null && !blank(p.displayName())) {
                    UUID registered = context.registeredPlayersByName().get(ScorecardContext.normalise(p.displayName()));
                    if (registered != null) {
                        issues.warning(WarningCode.GUEST_NAME_MATCHES_PLAYER, ResultWizardStep.TEAMS, side,
                                "The guest \"" + p.displayName().trim() + "\" has the same name as a registered player."
                                        + " Use that player instead?");
                    }
                }
            }
        }
        Set<UUID> homeProfiles = profiles(scorecard, ResultSide.HOME);
        for (ResultPlayerDto p : scorecard.players()) {
            if (p.side() == ResultSide.AWAY && p.playerProfileId() != null && homeProfiles.contains(p.playerProfileId())) {
                issues.warning(WarningCode.PLAYER_ON_BOTH_SIDES, ResultWizardStep.TEAMS, null,
                        label(p, context) + " is listed for both " + names.of(ResultSide.HOME) + " and "
                                + names.of(ResultSide.AWAY) + ". Check that they really played for both.");
            }
        }
        Map<String, ResultPlayerDto> homeGuests = new HashMap<>();
        scorecard.players().stream()
                .filter(p -> p.side() == ResultSide.HOME && !p.opposition() && p.playerProfileId() == null
                        && !blank(p.displayName()))
                .forEach(p -> homeGuests.put(ScorecardContext.normalise(p.displayName()), p));
        for (ResultPlayerDto p : scorecard.players()) {
            if (p.side() == ResultSide.AWAY && !p.opposition() && p.playerProfileId() == null && !blank(p.displayName())
                    && homeGuests.containsKey(ScorecardContext.normalise(p.displayName()))) {
                issues.info(WarningCode.GUEST_ON_BOTH_SIDES, ResultWizardStep.TEAMS, ResultSide.AWAY,
                        p.displayName().trim() + " is also a guest on " + names.of(ResultSide.HOME) + ".");
            }
        }
    }

    /** Whether a player batted, bowled or fielded; a player listed only as did-not-bat does not count. */
    private static boolean tookPart(ScorecardDto scorecard, ResultPlayerDto p) {
        List<String> refs = refs(p);
        return scorecard.batting().stream().anyMatch(e -> e.howOut() != DismissalType.DID_NOT_BAT
                        && refersTo(refs, e.resultPlayerId(), e.playerClientKey()))
                || scorecard.bowling().stream().anyMatch(e -> refersTo(refs, e.resultPlayerId(), e.playerClientKey()))
                || scorecard.fielding().stream().anyMatch(e -> refersTo(refs, e.resultPlayerId(), e.playerClientKey()));
    }

    private static boolean refersTo(List<String> refs, UUID id, String clientKey) {
        return (id != null && refs.contains(id.toString())) || (!blank(clientKey) && refs.contains(clientKey));
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
        ResultWizardStep step = ResultWizardStep.BATTING;
        int batterRuns = 0;
        int wicketCount = 0;
        int notOut = 0;
        for (BattingEntryDto e : inn.batting) {
            String who = label(inn.players.get(ref(e.resultPlayerId(), e.playerClientKey())), null);
            if (e.howOut() == null) {
                // batted, how out not chosen yet: no figures at all is the same as did-not-bat and is ignored
                if (e.runs() != null || e.balls() != null || e.fours() != null || e.sixes() != null) {
                    issues.error(ErrorCode.HOW_OUT_MISSING, step, side, who + " has runs but no How out.");
                    batterRuns += zero(e.runs());
                    if (zero(e.fours()) * 4 + zero(e.sixes()) * 6 > zero(e.runs())) {
                        issues.error(ErrorCode.BOUNDARIES_EXCEED_RUNS, step, side,
                                who + " has " + (zero(e.fours()) * 4 + zero(e.sixes()) * 6)
                                        + " runs in boundaries but only " + zero(e.runs()) + " runs.");
                    }
                    notOut++;
                }
                continue;
            }
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
        if (inn.innings.runs() == null) {
            // the total has not been entered yet: nothing to compare the batters against
        } else if (inn.innings.extras() != null && batterRuns + inn.innings.extras() != inn.innings.runs()) {
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

    // ---- bowling and fielding: a side's bowlers against the innings the other side batted ----

    private static void bowlingChecks(Inn inn, ScorecardContext context, ResultIssues issues) {
        ResultSide bowlingSide = other(inn.side);
        ResultWizardStep step = ResultWizardStep.BOWLING;
        InningsDto innings = inn.innings;
        String label = "Innings " + innings.sequence();
        int nonBowlerWickets = inn.nonBowlerWickets();
        if (!inn.bowling.isEmpty()) {
            int balls = inn.bowling.stream().mapToInt(b -> zero(b.balls())).sum();
            int runs = inn.bowling.stream().mapToInt(b -> zero(b.runs())).sum();
            int wickets = inn.bowling.stream().mapToInt(inn::effectiveWickets).sum();
            for (BowlingEntryDto b : inn.bowling) {
                String who = label(inn.players.get(ref(b.resultPlayerId(), b.playerClientKey())), context);
                if (zero(b.maidens()) > zero(b.balls()) / inn.ballsPerOver) {
                    issues.error(ErrorCode.MAIDENS_EXCEED_OVERS, step, bowlingSide,
                            who + " has more maidens than complete overs bowled.");
                }
                if (context.maxBallsPerBowler() != null && zero(b.balls()) > context.maxBallsPerBowler()) {
                    issues.warning(WarningCode.BOWLER_OVERS_EXCEED_LIMIT, step, bowlingSide,
                            who + " bowled more than the league's maximum of "
                                    + OversFormat.display(context.maxBallsPerBowler(), inn.ballsPerOver) + " overs"
                            + (context.leagueName() == null ? "" : " (" + context.leagueName() + ")") + ".");
                }
            }
            if (innings.balls() != null && balls != innings.balls()) {
                issues.warning(WarningCode.BOWLER_BALLS_MISMATCH, step, bowlingSide,
                        label + ": the bowlers bowled " + OversFormat.display(balls, inn.ballsPerOver)
                                + " overs, but the innings lasted " + OversFormat.display(innings.balls(), inn.ballsPerOver)
                                + ".");
            }
            if (innings.runs() == null) {
                // the total has not been entered yet: nothing to compare the bowlers against
            } else if (innings.hasExtrasBreakdown()) {
                int charged = runs + zero(innings.byes()) + zero(innings.legByes()) + zero(innings.penaltyRuns());
                if (charged != innings.runs()) {
                    issues.warning(WarningCode.BOWLING_RUNS_MISMATCH, step, bowlingSide,
                            label + ": the bowlers' " + runs + " runs plus " + (charged - runs)
                                    + " byes, leg byes and penalty runs make " + charged + ", but the innings total is "
                                    + innings.runs() + ".");
                }
            } else if (runs > innings.runs()) {
                issues.warning(WarningCode.BOWLING_RUNS_MISMATCH, step, bowlingSide,
                        label + ": the bowlers conceded " + runs + " runs, more than the innings total of "
                                + innings.runs() + ".");
            }
            if (innings.wickets() != null && wickets + nonBowlerWickets != innings.wickets()) {
                issues.warning(WarningCode.BOWLER_WICKETS_MISMATCH, step, bowlingSide,
                        label + ": the bowlers' " + wickets + " wickets plus " + nonBowlerWickets
                                + " not credited to a bowler make " + (wickets + nonBowlerWickets)
                                + ", but the result says " + innings.wickets() + ".");
            }
            if (innings.wides() != null && inn.bowling.stream().anyMatch(b -> b.wides() != null)
                    && inn.bowling.stream().mapToInt(b -> zero(b.wides())).sum() != innings.wides()) {
                issues.warning(WarningCode.WIDES_MISMATCH, step, bowlingSide,
                        label + ": the bowlers' wides do not add up to the " + innings.wides() + " wides in the innings.");
            }
            if (innings.noBalls() != null && inn.bowling.stream().anyMatch(b -> b.noBalls() != null)
                    && inn.bowling.stream().mapToInt(b -> zero(b.noBalls())).sum() != innings.noBalls()) {
                issues.warning(WarningCode.NO_BALLS_MISMATCH, step, bowlingSide,
                        label + ": the bowlers' no-balls do not add up to the " + innings.noBalls()
                                + " no-balls in the innings.");
            }
        }
        int[] fielding = inn.fieldingTotals();
        int credits = fielding[0] + fielding[1] + fielding[2];
        if (credits > 0 && ((innings.wickets() != null && credits > innings.wickets())
                || fielding[2] > nonBowlerWickets)) {
            issues.warning(WarningCode.FIELDING_EXCEEDS_WICKETS, step, bowlingSide,
                    label + ": the fielding credits (" + credits + ") are more than the wickets that fell.");
        }
        dismissalChecks(inn, bowlingSide, label, context, issues);
    }

    /**
     * Dismissals that name a bowler or a fielder against the bowling and fielding rows (docs/specs/101): a named bowler
     * needs a bowling row, and a MANUAL row that differs from what the dismissals credit is flagged, but only where the
     * dismissals are fully attributed (otherwise the difference may just be a missing name). A DERIVED row is the
     * derivation by construction and is never flagged.
     */
    private static void dismissalChecks(
            Inn inn, ResultSide bowlingSide, String label, ScorecardContext context, ResultIssues issues) {
        List<Dismissal<String>> dismissals = inn.dismissals();
        if (dismissals.isEmpty()) {
            return;
        }
        ResultWizardStep step = ResultWizardStep.BOWLING;
        Map<String, Credit> credits = DismissalCredits.derive(dismissals);
        Set<String> bowlers = new HashSet<>();
        inn.bowling.forEach(b -> bowlers.add(inn.key(b.resultPlayerId(), b.playerClientKey())));
        Set<String> missing = new LinkedHashSet<>();
        for (Dismissal<String> d : dismissals) {
            if (d.howOut() != null && d.howOut().isBowlerCredited() && d.bowler() != null
                    && !bowlers.contains(d.bowler())) {
                missing.add(d.bowler());
            }
        }
        for (String bowler : missing) {
            issues.warning(WarningCode.DISMISSAL_BOWLER_NOT_IN_BOWLING_LIST, step, bowlingSide,
                    label + ": " + label(inn.players.get(bowler), context) + " is named as taking a wicket but has no "
                            + "bowling figures, so the wicket cannot be credited.");
        }
        if (DismissalCredits.wicketsAttributed(dismissals)) {
            for (BowlingEntryDto b : inn.bowling) {
                if (b.wicketsSource() == CreditSource.DERIVED) {
                    continue;
                }
                int expected = credits.getOrDefault(inn.key(b.resultPlayerId(), b.playerClientKey()), Credit.NONE).wickets();
                if (zero(b.wickets()) != expected) {
                    issues.warning(WarningCode.BOWLER_WICKETS_DIFFER_FROM_DISMISSALS, step, bowlingSide,
                            label + ": " + label(inn.players.get(ref(b.resultPlayerId(), b.playerClientKey())), context)
                                    + " has " + zero(b.wickets()) + " wickets, but the dismissals say " + expected + ".");
                }
            }
        }
        boolean catches = DismissalCredits.catchesAttributed(dismissals);
        boolean stumpings = DismissalCredits.stumpingsAttributed(dismissals);
        boolean runOuts = DismissalCredits.runOutsAttributed(dismissals);
        for (FieldingEntryDto f : inn.fielding) {
            if (f.creditsSource() == CreditSource.DERIVED) {
                continue;
            }
            Credit expected = credits.getOrDefault(inn.key(f.resultPlayerId(), f.playerClientKey()), Credit.NONE);
            if ((catches && zero(f.catches()) != expected.catches())
                    || (stumpings && zero(f.stumpings()) != expected.stumpings())
                    || (runOuts && zero(f.runOuts()) != expected.runOuts())) {
                issues.warning(WarningCode.FIELDING_DIFFERS_FROM_DISMISSALS, step, bowlingSide,
                        label + ": " + label(inn.players.get(ref(f.resultPlayerId(), f.playerClientKey())), context)
                                + " has " + zero(f.catches()) + " catches, " + zero(f.stumpings()) + " stumpings and "
                                + zero(f.runOuts()) + " run-outs, but the dismissals say " + expected.catches() + ", "
                                + expected.stumpings() + " and " + expected.runOuts() + ".");
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
        private Map<String, Credit> derived;

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

        /** Wickets not credited to a bowler: derived from the batters when they are on the scorecard, else entered. */
        int nonBowlerWickets() {
            if (!batting.isEmpty()) {
                return (int) batting.stream().filter(e -> e.howOut() != null && e.howOut().isNonBowlerWicket()).count();
            }
            return zero(innings.nonBowlerWickets());
        }

        /** The player's key as the dismissals name them: the id when stored, else the client key. */
        String key(UUID id, String clientKey) {
            ResultPlayerDto p = players.get(ref(id, clientKey));
            return p == null ? ref(id, clientKey) : canonical(p);
        }

        /** The dismissals of this innings with the bowler and fielder as player keys (null when not recorded). */
        List<Dismissal<String>> dismissals() {
            List<Dismissal<String>> result = new ArrayList<>();
            for (BattingEntryDto e : batting) {
                if (e.howOut() == null) {
                    continue;
                }
                ResultPlayerDto bowler = blank(e.bowlerPlayerId()) ? null : players.get(e.bowlerPlayerId());
                ResultPlayerDto fielder = blank(e.fielderPlayerId()) ? null : players.get(e.fielderPlayerId());
                result.add(new Dismissal<>(e.howOut(), bowler == null ? null : canonical(bowler),
                        fielder == null ? null : canonical(fielder)));
            }
            return result;
        }

        private Map<String, Credit> derived() {
            if (derived == null) {
                derived = DismissalCredits.derive(dismissals());
            }
            return derived;
        }

        /** A DERIVED row counts what the dismissals credit (the server writes that on save); a MANUAL row its own. */
        int effectiveWickets(BowlingEntryDto b) {
            if (b.wicketsSource() == CreditSource.DERIVED && !batting.isEmpty()) {
                return derived().getOrDefault(key(b.resultPlayerId(), b.playerClientKey()), Credit.NONE).wickets();
            }
            return zero(b.wickets());
        }

        /**
         * Catches, stumpings and run-outs as they will be stored: MANUAL rows as typed, DERIVED rows (and fielders with
         * a credit and no row, for whom the server adds one) as the dismissals credit them.
         */
        int[] fieldingTotals() {
            int[] totals = new int[3];
            Set<String> withRow = new HashSet<>();
            for (FieldingEntryDto f : fielding) {
                String key = key(f.resultPlayerId(), f.playerClientKey());
                withRow.add(key);
                if (f.creditsSource() == CreditSource.DERIVED && !batting.isEmpty()) {
                    Credit c = derived().getOrDefault(key, Credit.NONE);
                    totals[0] += c.catches();
                    totals[1] += c.stumpings();
                    totals[2] += c.runOuts();
                } else {
                    totals[0] += zero(f.catches());
                    totals[1] += zero(f.stumpings());
                    totals[2] += zero(f.runOuts());
                }
            }
            if (!batting.isEmpty()) {
                derived().forEach((key, c) -> {
                    if (!withRow.contains(key) && c.hasFielding()) {
                        totals[0] += c.catches();
                        totals[1] += c.stumpings();
                        totals[2] += c.runOuts();
                    }
                });
            }
            return totals;
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

    /** The key a player is known by in the derivation: the id once stored, else the client key. */
    private static String canonical(ResultPlayerDto p) {
        return p.id() != null ? p.id().toString() : p.clientKey();
    }

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
