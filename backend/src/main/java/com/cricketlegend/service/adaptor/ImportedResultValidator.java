package com.cricketlegend.service.adaptor;

import com.cricketlegend.domain.DismissalType;
import com.cricketlegend.domain.InningsKind;
import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.dto.ImportedResultDto.Batting;
import com.cricketlegend.dto.ImportedResultDto.Bowling;
import com.cricketlegend.dto.ImportedResultDto.Innings;
import com.cricketlegend.dto.ImportedResultDto.Team;
import com.cricketlegend.service.support.OversFormat;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * docs/specs/104-match-results-import-adaptors.md: shape and reference validation of the common import document, in one
 * pure class: structure, references between sections, {@link DismissalType} allowances, overs notation and the size
 * caps. Cricket plausibility (totals, wickets, outcome against scores) is only {@code ResultValidator}'s and is not
 * repeated here. Returns every problem found in plain English; the exception caps what is reported.
 */
public final class ImportedResultValidator {

    private static final Pattern TEAM_KEY = Pattern.compile("^[A-Za-z0-9_-]{1,8}$");
    private static final int MAX_PROVIDER = 40;
    private static final int MAX_EXTERNAL_ID = 255;

    private final List<ImportErrorDto> errors = new ArrayList<>();

    private ImportedResultValidator() {}

    /** Every shape and reference problem in the document; empty when it conforms. */
    public static List<ImportErrorDto> validate(ImportedResultDto document) {
        ImportedResultValidator validator = new ImportedResultValidator();
        if (document == null) {
            validator.add("", "REQUIRED", "The document is empty.");
        } else {
            validator.check(document);
        }
        return validator.errors;
    }

    private void check(ImportedResultDto doc) {
        checkVersion(doc);
        checkSource(doc);
        checkLocator(doc);
        Set<String> keys = checkTeams(doc.teams());
        checkToss(doc, keys);
        checkResult(doc, keys);
        checkInnings(doc, keys);
        checkPlayers(doc, keys);
        checkAwards(doc, keys);
    }

    private void checkVersion(ImportedResultDto doc) {
        if (doc.schemaVersion() == null) {
            add("schemaVersion", "REQUIRED", "schemaVersion is required. The supported version is "
                    + ImportedResultDto.SCHEMA_VERSION + ".");
        } else if (doc.schemaVersion() != ImportedResultDto.SCHEMA_VERSION) {
            add("schemaVersion", "UNSUPPORTED_SCHEMA_VERSION", "Schema version " + doc.schemaVersion()
                    + " is not supported. The supported version is " + ImportedResultDto.SCHEMA_VERSION + ".");
        }
    }

    private void checkSource(ImportedResultDto doc) {
        ImportedResultDto.Source source = doc.source();
        if (source == null) {
            return;
        }
        if (source.provider() != null && (source.provider().isBlank() || source.provider().length() > MAX_PROVIDER)) {
            add("source.provider", "INVALID_VALUE", "The provider must be 1 to " + MAX_PROVIDER + " characters.");
        }
        if (source.externalMatchId() != null) {
            if (source.externalMatchId().isBlank() || source.externalMatchId().length() > MAX_EXTERNAL_ID) {
                add("source.externalMatchId", "INVALID_VALUE",
                        "The provider's match id must be 1 to " + MAX_EXTERNAL_ID + " characters.");
            }
            if (source.provider() == null || source.provider().isBlank()) {
                add("source.provider", "REQUIRED", "A provider is required when a provider match id is given.");
            }
        }
    }

    private void checkLocator(ImportedResultDto doc) {
        boolean located = (doc.match() != null && (doc.match().matchId() != null || doc.match().date() != null))
                || (doc.source() != null && doc.source().externalMatchId() != null);
        if (!located) {
            add("match", "LOCATOR_MISSING",
                    "The document must say which match it is: a match id, a date, or the provider's match id.");
        }
    }

    private Set<String> checkTeams(List<Team> teams) {
        Set<String> keys = new HashSet<>();
        if (teams == null || teams.size() != 2) {
            add("teams", "INVALID_VALUE", "Exactly two teams are required.");
            if (teams == null) {
                return keys;
            }
        }
        for (int i = 0; i < teams.size(); i++) {
            Team team = teams.get(i);
            String path = "teams[" + i + "]";
            if (team == null) {
                add(path, "REQUIRED", "The team is empty.");
                continue;
            }
            if (team.key() == null || !TEAM_KEY.matcher(team.key()).matches()) {
                add(path + ".key", "INVALID_VALUE",
                        "A team key is 1 to 8 letters, digits, underscores or hyphens.");
            } else if (!keys.add(team.key())) {
                add(path + ".key", "DUPLICATE", "The team key '" + team.key() + "' is used twice.");
            }
            name(path + ".name", team.name());
        }
        return keys;
    }

    private void checkToss(ImportedResultDto doc, Set<String> keys) {
        ImportedResultDto.Toss toss = doc.toss();
        if (toss == null) {
            return;
        }
        if ((toss.wonBy() == null) != (toss.decision() == null)) {
            add("toss", "INVALID_VALUE", "Give both who won the toss and what they chose, or neither.");
        }
        reference("toss.wonBy", toss.wonBy(), keys);
    }

    private void checkResult(ImportedResultDto doc, Set<String> keys) {
        ImportedResultDto.Result result = doc.result();
        if (result == null) {
            return;
        }
        reference("result.winner", result.winner(), keys);
        if (result.margin() != null) {
            if (result.margin().type() == null) {
                add("result.margin.type", "REQUIRED", "The margin needs a type, RUNS or WICKETS.");
            }
            nonNegative("result.margin.value", result.margin().value(), true);
        }
        if (result.dls() != null) {
            nonNegative("result.dls.target", result.dls().target(), false);
            nonNegative("result.dls.revisedOvers", result.dls().revisedOvers(), false);
        }
        if (result.scheduledOvers() != null && result.scheduledOvers() < 1) {
            add("result.scheduledOvers", "INVALID_VALUE", "The scheduled overs must be at least 1.");
        }
        if (result.ballsPerOver() != null && result.ballsPerOver() < 1) {
            add("result.ballsPerOver", "INVALID_VALUE", "The balls to an over must be at least 1.");
        }
    }

    private void checkInnings(ImportedResultDto doc, Set<String> keys) {
        if (doc.innings() == null) {
            return;
        }
        int ballsPerOver = doc.result() == null || doc.result().ballsPerOver() == null
                || doc.result().ballsPerOver() < 1 ? 6 : doc.result().ballsPerOver();
        long regular = doc.innings().stream().filter(i -> i != null && i.kind() != InningsKind.SUPER_OVER).count();
        if (regular > ResultImportLimits.MAX_REGULAR_INNINGS) {
            add("innings", "TOO_MANY", "At most " + ResultImportLimits.MAX_REGULAR_INNINGS
                    + " regular innings are allowed, besides super overs.");
        }
        for (int i = 0; i < doc.innings().size(); i++) {
            Innings innings = doc.innings().get(i);
            if (innings == null) {
                add("innings[" + i + "]", "REQUIRED", "The innings is empty.");
                continue;
            }
            checkOneInnings("innings[" + i + "]", innings, keys, ballsPerOver);
        }
    }

    private void checkOneInnings(String path, Innings innings, Set<String> keys, int ballsPerOver) {
        if (innings.battingTeam() == null) {
            add(path + ".battingTeam", "REQUIRED", "The innings must say which team batted.");
        } else {
            reference(path + ".battingTeam", innings.battingTeam(), keys);
        }
        nonNegative(path + ".runs", innings.runs(), false);
        nonNegative(path + ".wickets", innings.wickets(), false);
        if (innings.overs() != null) {
            overs(path + ".overs", innings.overs(), ballsPerOver);
        }
        if (innings.extras() != null) {
            nonNegative(path + ".extras.wides", innings.extras().wides(), false);
            nonNegative(path + ".extras.noBalls", innings.extras().noBalls(), false);
            nonNegative(path + ".extras.byes", innings.extras().byes(), false);
            nonNegative(path + ".extras.legByes", innings.extras().legByes(), false);
            nonNegative(path + ".extras.penalty", innings.extras().penalty(), false);
        }
        int batters = size(innings.batting()) + size(innings.didNotBat());
        if (batters > ResultImportLimits.MAX_PLAYERS_PER_SIDE) {
            add(path + ".batting", "TOO_MANY", "At most " + ResultImportLimits.MAX_PLAYERS_PER_SIDE
                    + " players can be listed for one side's batting.");
        }
        if (size(innings.bowling()) > ResultImportLimits.MAX_PLAYERS_PER_SIDE) {
            add(path + ".bowling", "TOO_MANY", "At most " + ResultImportLimits.MAX_PLAYERS_PER_SIDE
                    + " bowlers can be listed for one side.");
        }
        for (int b = 0; b < size(innings.batting()); b++) {
            checkBatting(path + ".batting[" + b + "]", innings.batting().get(b));
        }
        for (int n = 0; n < size(innings.didNotBat()); n++) {
            name(path + ".didNotBat[" + n + "]", innings.didNotBat().get(n));
        }
        for (int w = 0; w < size(innings.bowling()); w++) {
            checkBowling(path + ".bowling[" + w + "]", innings.bowling().get(w), ballsPerOver);
        }
    }

    private void checkBatting(String path, Batting row) {
        if (row == null) {
            add(path, "REQUIRED", "The batting row is empty.");
            return;
        }
        name(path + ".player", row.player());
        if (row.position() != null && row.position() < 1) {
            add(path + ".position", "INVALID_VALUE", "The batting position must be 1 or more.");
        }
        nonNegative(path + ".runs", row.runs(), true);
        nonNegative(path + ".balls", row.balls(), false);
        nonNegative(path + ".fours", row.fours(), false);
        nonNegative(path + ".sixes", row.sixes(), false);
        optionalName(path + ".bowler", row.bowler());
        optionalName(path + ".fielder", row.fielder());
        DismissalType howOut = row.howOut();
        if (howOut == null) {
            add(path + ".howOut", "REQUIRED", "Say how the batter was dismissed, or NOT_OUT.");
            return;
        }
        boolean hasBowler = row.bowler() != null && !row.bowler().isBlank();
        boolean hasFielder = row.fielder() != null && !row.fielder().isBlank();
        if (hasBowler && !howOut.allowsBowler()) {
            add(path + ".bowler", "NOT_ALLOWED", "A bowler cannot be named for " + howOut + ".");
        }
        if (hasFielder && !howOut.allowsFielder()) {
            add(path + ".fielder", "NOT_ALLOWED", "A fielder cannot be named for " + howOut + ".");
        }
        if (howOut == DismissalType.CAUGHT && !hasBowler && !hasFielder) {
            add(path + ".howOut", "FIELDER_OR_BOWLER_REQUIRED",
                    "Dismissal 'caught' needs a fielder or a bowler to be named, or use CAUGHT_AND_BOWLED.");
        }
    }

    private void checkBowling(String path, Bowling row, int ballsPerOver) {
        if (row == null) {
            add(path, "REQUIRED", "The bowling row is empty.");
            return;
        }
        name(path + ".player", row.player());
        overs(path + ".overs", row.overs(), ballsPerOver);
        nonNegative(path + ".maidens", row.maidens(), true);
        nonNegative(path + ".runs", row.runs(), true);
        nonNegative(path + ".wickets", row.wickets(), true);
        nonNegative(path + ".wides", row.wides(), false);
        nonNegative(path + ".noBalls", row.noBalls(), false);
        nonNegative(path + ".dots", row.dots(), false);
    }

    private void checkPlayers(ImportedResultDto doc, Set<String> keys) {
        if (doc.players() == null) {
            return;
        }
        for (int i = 0; i < doc.players().size(); i++) {
            ImportedResultDto.PlayerEntry entry = doc.players().get(i);
            String path = "players[" + i + "]";
            if (entry == null) {
                add(path, "REQUIRED", "The team sheet entry is empty.");
                continue;
            }
            name(path + ".name", entry.name());
            if (entry.team() == null) {
                add(path + ".team", "REQUIRED", "Say which team the player is on.");
            } else {
                reference(path + ".team", entry.team(), keys);
            }
        }
        for (String key : keys) {
            long onTeam = doc.players().stream().filter(p -> p != null && key.equals(p.team())).count();
            if (onTeam > ResultImportLimits.MAX_PLAYERS_PER_SIDE) {
                add("players", "TOO_MANY", "At most " + ResultImportLimits.MAX_PLAYERS_PER_SIDE
                        + " players can be listed for team " + key + ".");
            }
        }
    }

    private void checkAwards(ImportedResultDto doc, Set<String> keys) {
        if (doc.awards() == null || doc.awards().playerOfMatch() == null) {
            return;
        }
        name("awards.playerOfMatch.name", doc.awards().playerOfMatch().name());
        reference("awards.playerOfMatch.team", doc.awards().playerOfMatch().team(), keys);
    }

    // ---- primitives ----

    private void reference(String path, String key, Set<String> keys) {
        if (key != null && !keys.contains(key)) {
            add(path, "UNKNOWN_TEAM", "'" + key + "' is not one of the team keys in 'teams'.");
        }
    }

    private void name(String path, String value) {
        if (value == null || value.isBlank()) {
            add(path, "REQUIRED", "A name is required.");
        } else if (value.trim().length() > ResultImportLimits.MAX_NAME_LENGTH) {
            add(path, "TOO_LONG", "A name can be at most " + ResultImportLimits.MAX_NAME_LENGTH + " characters.");
        }
    }

    private void optionalName(String path, String value) {
        if (value != null && value.trim().length() > ResultImportLimits.MAX_NAME_LENGTH) {
            add(path, "TOO_LONG", "A name can be at most " + ResultImportLimits.MAX_NAME_LENGTH + " characters.");
        }
    }

    private void nonNegative(String path, Integer value, boolean required) {
        if (value == null) {
            if (required) {
                add(path, "REQUIRED", "A number is required.");
            }
        } else if (value < 0) {
            add(path, "INVALID_VALUE", "The number cannot be negative.");
        }
    }

    private void overs(String path, String value, int ballsPerOver) {
        OversFormat.Parsed parsed = OversFormat.parse(value, ballsPerOver);
        if (!parsed.valid()) {
            add(path, "INVALID_OVERS", parsed.error());
        }
    }

    private static int size(List<?> list) {
        return list == null ? 0 : list.size();
    }

    private void add(String path, String code, String message) {
        errors.add(new ImportErrorDto(path, code, message));
    }
}
