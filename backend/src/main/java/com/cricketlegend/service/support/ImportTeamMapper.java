package com.cricketlegend.service.support;

import com.cricketlegend.domain.NameAlias;
import com.cricketlegend.domain.NameAliasKind;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.dto.ImportErrorDto;
import com.cricketlegend.dto.ImportExactness;
import com.cricketlegend.dto.ImportedResultDto;
import com.cricketlegend.dto.TeamMappingDto;
import com.cricketlegend.exception.ImportInputValidationException;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * docs/specs/104-match-results-import-adaptors.md, stage 2: which side of the chosen match is each team of the file.
 * The server proposes by name (a remembered TEAM alias, an exact name, a name that differs only in case or spacing,
 * then the deterministic name tiers); a team that cannot be placed is UNRESOLVED and the manager picks. Home and away
 * are never swapped silently: the manager confirms, and {@link #confirm} re-validates the choice as a bijection.
 */
@Component
public class ImportTeamMapper {

    /** A side of the candidate match as the mapper sees it: its display name and, for one of our teams, the team. */
    public record Side(ResultSide side, String name, UUID ourTeamId) {}

    private static final UUID HOME_MARKER = new UUID(0, 1);
    private static final UUID AWAY_MARKER = new UUID(0, 2);

    private final NameAliases aliases;

    public ImportTeamMapper(NameAliases aliases) {
        this.aliases = aliases;
    }

    /** The proposed mapping of each file team, in the file's order. */
    public List<TeamMappingDto> propose(UUID clubId, List<ImportedResultDto.Team> fileTeams, Side home, Side away) {
        Map<String, NameAlias> remembered = aliases.activeFor(
                clubId, NameAliasKind.TEAM, fileTeams.stream().map(ImportedResultDto.Team::name).toList());
        List<TeamMappingDto> placed = new ArrayList<>();
        Set<ResultSide> taken = new HashSet<>();
        for (ImportedResultDto.Team team : fileTeams) {
            TeamMappingDto mapping = place(team, home, away, remembered);
            if (mapping.side() != null && !taken.add(mapping.side())) {
                mapping = unplaced(team, "Both teams of the file look like the same side.");
            }
            placed.add(mapping);
        }
        return completeTheOtherSide(placed);
    }

    /**
     * The side of each file team the manager confirmed, as a bijection onto HOME and AWAY. Anything else is a 400 with
     * the problem named (the server trusts nothing about the mapping).
     */
    public Map<String, ResultSide> confirm(List<ImportedResultDto.Team> fileTeams, List<TeamMappingDto> chosen) {
        List<ImportErrorDto> errors = new ArrayList<>();
        Map<String, ResultSide> byKey = new LinkedHashMap<>();
        for (TeamMappingDto choice : chosen == null ? List.<TeamMappingDto>of() : chosen) {
            if (choice == null || choice.fileKey() == null || choice.side() == null) {
                errors.add(new ImportErrorDto("teamMapping", "INVALID_VALUE", "Every team needs a key and a side."));
            } else if (byKey.put(choice.fileKey(), choice.side()) != null) {
                errors.add(new ImportErrorDto("teamMapping", "DUPLICATE", "A team is mapped twice."));
            }
        }
        Set<String> fileKeys = new HashSet<>();
        fileTeams.forEach(team -> fileKeys.add(team.key()));
        if (!byKey.keySet().equals(fileKeys)) {
            errors.add(new ImportErrorDto("teamMapping", "INVALID_VALUE", "Map each of the file's two teams exactly once."));
        }
        if (byKey.size() != 2 || new HashSet<>(byKey.values()).size() != 2) {
            errors.add(new ImportErrorDto(
                    "teamMapping", "INVALID_VALUE", "The two teams must be mapped to the home side and the away side."));
        }
        if (!errors.isEmpty()) {
            throw new ImportInputValidationException("The team mapping is not valid.", errors);
        }
        return byKey;
    }

    /** How firmly each confirmed side matches what the server would have proposed; a manager's override is UNRESOLVED. */
    public Map<String, ImportExactness> confirmedExactness(
            List<TeamMappingDto> proposed, Map<String, ResultSide> confirmed) {
        Map<String, ImportExactness> byKey = new LinkedHashMap<>();
        for (TeamMappingDto proposal : proposed) {
            ResultSide chosen = confirmed.get(proposal.fileKey());
            byKey.put(proposal.fileKey(),
                    chosen != null && chosen == proposal.side() ? proposal.exactness() : ImportExactness.UNRESOLVED);
        }
        return byKey;
    }

    /** Whether both teams were placed by name (a candidate match whose sides are the file's teams). */
    public static boolean bothPlaced(List<TeamMappingDto> mapping) {
        return mapping.size() == 2
                && mapping.stream().allMatch(m -> m.side() != null && m.exactness() != ImportExactness.UNRESOLVED);
    }

    // ---- placing one team ----

    private TeamMappingDto place(
            ImportedResultDto.Team team, Side home, Side away, Map<String, NameAlias> remembered) {
        NameAlias alias = remembered.get(NameAliases.normalise(team.name()));
        if (alias != null) {
            Side side = ownedBy(alias.getTargetTeamId(), home, away);
            if (side != null) {
                return mapped(team, side.side(), ImportExactness.EXACT, "Remembered from an earlier import.");
            }
        }
        String written = team.name().trim();
        for (Side side : List.of(home, away)) {
            if (side.name() != null && written.equals(side.name().trim())) {
                return mapped(team, side.side(), ImportExactness.EXACT, "Matches the name of " + side.name().trim() + ".");
            }
        }
        for (Side side : List.of(home, away)) {
            if (side.name() != null
                    && !PlayerNameMatcher.canonical(written).isEmpty()
                    && PlayerNameMatcher.canonical(written).equals(PlayerNameMatcher.canonical(side.name()))) {
                return mapped(team, side.side(), ImportExactness.EXACT,
                        "The same name as " + side.name().trim() + " apart from capitals or spacing.");
            }
        }
        NameResolution byTiers = NameTiers.resolve(written, List.of(asCandidate(HOME_MARKER, home), asCandidate(AWAY_MARKER, away)));
        if (byTiers.isLinked()) {
            ResultSide side = HOME_MARKER.equals(byTiers.candidate().id()) ? ResultSide.HOME : ResultSide.AWAY;
            return mapped(team, side, ImportExactness.NORMALISED, "Similar to the name of the " + side.name().toLowerCase(java.util.Locale.ROOT) + " side.");
        }
        return unplaced(team, "Not recognised as either side.");
    }

    private static NameCandidate asCandidate(UUID marker, Side side) {
        String name = side.name() == null ? "" : side.name().trim();
        int cut = name.lastIndexOf(' ');
        return cut < 0 ? new NameCandidate(marker, "", name) : new NameCandidate(marker, name.substring(0, cut), name.substring(cut + 1));
    }

    private static Side ownedBy(UUID teamId, Side home, Side away) {
        if (teamId == null) {
            return null;
        }
        if (teamId.equals(home.ourTeamId())) {
            return home;
        }
        return teamId.equals(away.ourTeamId()) ? away : null;
    }

    private static TeamMappingDto mapped(ImportedResultDto.Team team, ResultSide side, ImportExactness exactness, String reason) {
        return new TeamMappingDto(team.key(), team.name(), side, exactness, reason);
    }

    private static TeamMappingDto unplaced(ImportedResultDto.Team team, String reason) {
        return new TeamMappingDto(team.key(), team.name(), null, ImportExactness.UNRESOLVED, reason);
    }

    /** With one team placed, the other is by elimination the other side: proposed, but still for the manager to confirm. */
    private static List<TeamMappingDto> completeTheOtherSide(List<TeamMappingDto> placed) {
        if (placed.size() != 2) {
            return placed;
        }
        EnumMap<ResultSide, Boolean> used = new EnumMap<>(ResultSide.class);
        placed.stream().filter(m -> m.side() != null).forEach(m -> used.put(m.side(), true));
        if (used.size() != 1) {
            return placed;
        }
        ResultSide remaining = used.containsKey(ResultSide.HOME) ? ResultSide.AWAY : ResultSide.HOME;
        List<TeamMappingDto> out = new ArrayList<>();
        for (TeamMappingDto mapping : placed) {
            out.add(mapping.side() != null
                    ? mapping
                    : new TeamMappingDto(mapping.fileKey(), mapping.fileName(), remaining, ImportExactness.UNRESOLVED,
                            "The other side of the match."));
        }
        return out;
    }
}
