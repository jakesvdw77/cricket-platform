package com.cricketlegend.service.support;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.ResultSide;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.support.ResultValidator.ErrorCode;
import com.cricketlegend.service.support.SelectionEligibility.PlayerInfo;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * docs/specs/113-result-players-section-and-age.md: the one place that decides whether a registered player may be on one
 * of OUR sides of a result. The player must belong to the section of that side's team or one of its descendant sections,
 * and, when the match's league has an age rule, meet it (spec 110's reference date, through
 * {@link SelectionEligibility#ageProblems}). Guests and the opposition are never passed in. The save check, the
 * validation issues and the import candidate filter all call this class; it uses batch queries only (one for the
 * memberships, one for the sections, one for the age problems), never one per player.
 */
@Component
public class ResultPlayerEligibility {

    /** Why one player may not be on one side: an error code (PLAYER_NOT_IN_SECTION or PLAYER_AGE_INELIGIBLE) and a plain message. */
    public record Problem(ErrorCode code, String message) {}

    private final PlayerSectionRepository playerSectionRepository;
    private final SectionRepository sectionRepository;
    private final TeamRepository teamRepository;
    private final AccessService accessService;
    private final SelectionEligibility selectionEligibility;

    public ResultPlayerEligibility(
            PlayerSectionRepository playerSectionRepository,
            SectionRepository sectionRepository,
            TeamRepository teamRepository,
            AccessService accessService,
            SelectionEligibility selectionEligibility) {
        this.playerSectionRepository = playerSectionRepository;
        this.sectionRepository = sectionRepository;
        this.teamRepository = teamRepository;
        this.accessService = accessService;
        this.selectionEligibility = selectionEligibility;
    }

    /** As {@link #check(Match, Map, Map)}, loading the players' names and birth dates itself. */
    public Map<ResultSide, Map<UUID, List<Problem>>> check(Match match, Map<ResultSide, ? extends Collection<UUID>> idsBySide) {
        Set<UUID> all = new HashSet<>();
        idsBySide.values().forEach(all::addAll);
        return check(match, idsBySide, selectionEligibility.loadPlayers(all));
    }

    /**
     * The problems per side and player (a player with none is absent; a side with none is absent) for the registered
     * players of our sides. {@code players} supplies names and dates of birth. A side whose team has no section, or a
     * team of another club, is not section-checked; a match without a league, or whose league has no age rule, is not
     * age-checked.
     */
    public Map<ResultSide, Map<UUID, List<Problem>>> check(
            Match match, Map<ResultSide, ? extends Collection<UUID>> idsBySide, Map<UUID, PlayerInfo> players) {
        Map<ResultSide, Map<UUID, List<Problem>>> out = new EnumMap<>(ResultSide.class);
        Set<UUID> all = new HashSet<>();
        idsBySide.values().forEach(all::addAll);
        if (all.isEmpty()) {
            return out;
        }
        Map<UUID, Set<UUID>> sectionsByPlayer = sectionsOf(all);
        Map<UUID, Team> teams = teamsOf(match, idsBySide);
        Set<UUID> teamSectionIds = teams.values().stream()
                .map(Team::getSectionId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, Set<UUID>> closures = accessService.sectionClosures(match.getClubId(), teamSectionIds);
        Map<UUID, String> sectionNames = sectionNames(teamSectionIds);
        Map<UUID, String> ageProblems = selectionEligibility.ageProblems(match, all, players);

        idsBySide.forEach((side, ids) -> {
            Team team = teams.get(teamOf(match, side));
            boolean sectionChecked = team != null && team.getSectionId() != null
                    && match.getClubId().equals(team.getClubId());
            Set<UUID> allowed = sectionChecked ? closures.getOrDefault(team.getSectionId(), Set.of(team.getSectionId())) : Set.of();
            for (UUID id : ids) {
                List<Problem> problems = new ArrayList<>();
                if (sectionChecked && sectionsByPlayer.getOrDefault(id, Set.of()).stream().noneMatch(allowed::contains)) {
                    PlayerInfo info = players.get(id);
                    String section = sectionNames.getOrDefault(team.getSectionId(), "team's");
                    problems.add(new Problem(ErrorCode.PLAYER_NOT_IN_SECTION,
                            (info == null ? "This player" : info.fullName()) + " is not in the " + section + " section."));
                }
                String age = ageProblems.get(id);
                if (age != null) {
                    problems.add(new Problem(ErrorCode.PLAYER_AGE_INELIGIBLE, age));
                }
                if (!problems.isEmpty()) {
                    out.computeIfAbsent(side, s -> new LinkedHashMap<>()).put(id, problems);
                }
            }
        });
        return out;
    }

    /** The ids (of those given) who pass both checks for one side: what an import may link to. */
    public Set<UUID> eligibleIds(Match match, ResultSide side, Collection<UUID> ids, Map<UUID, PlayerInfo> players) {
        Map<UUID, List<Problem>> problems = check(match, Map.of(side, ids), players).getOrDefault(side, Map.of());
        return ids.stream().filter(id -> !problems.containsKey(id)).collect(Collectors.toSet());
    }

    private static UUID teamOf(Match match, ResultSide side) {
        return side == ResultSide.HOME ? match.getHomeTeamId() : match.getAwayTeamId();
    }

    private Map<UUID, Team> teamsOf(Match match, Map<ResultSide, ? extends Collection<UUID>> idsBySide) {
        Set<UUID> teamIds = new HashSet<>();
        idsBySide.forEach((side, ids) -> {
            if (!ids.isEmpty() && teamOf(match, side) != null) {
                teamIds.add(teamOf(match, side));
            }
        });
        return teamIds.isEmpty()
                ? Map.of()
                : teamRepository.findAllById(teamIds).stream().collect(Collectors.toMap(Team::getId, t -> t));
    }

    private Map<UUID, Set<UUID>> sectionsOf(Collection<UUID> playerIds) {
        Map<UUID, Set<UUID>> byPlayer = new HashMap<>();
        for (PlayerSection row : playerSectionRepository.findByPlayerProfileIdIn(playerIds)) {
            byPlayer.computeIfAbsent(row.getPlayerProfileId(), k -> new HashSet<>()).add(row.getSectionId());
        }
        return byPlayer;
    }

    private Map<UUID, String> sectionNames(Collection<UUID> sectionIds) {
        if (sectionIds.isEmpty()) {
            return Map.of();
        }
        return sectionRepository.findAllById(sectionIds).stream().collect(Collectors.toMap(Section::getId, Section::getName));
    }
}
