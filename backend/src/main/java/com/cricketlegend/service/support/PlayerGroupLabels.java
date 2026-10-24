package com.cricketlegend.service.support;

import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.Section;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.PlayerTeamNameView;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * The section and team labels shown for a player outside the manager screens (docs/specs/119): the matches step and
 * My players. One place, a fixed number of queries however many players are asked about.
 */
@Component
public class PlayerGroupLabels {

    private final PlayerSectionRepository playerSectionRepository;
    private final SectionRepository sectionRepository;
    private final TeamSquadMemberRepository teamSquadMemberRepository;

    public PlayerGroupLabels(
            PlayerSectionRepository playerSectionRepository,
            SectionRepository sectionRepository,
            TeamSquadMemberRepository teamSquadMemberRepository) {
        this.playerSectionRepository = playerSectionRepository;
        this.sectionRepository = sectionRepository;
        this.teamSquadMemberRepository = teamSquadMemberRepository;
    }

    /** Section names per player profile id, alphabetical; a player in no section is absent. */
    public Map<UUID, List<String>> sectionNames(Collection<UUID> profileIds) {
        Map<UUID, List<String>> names = new HashMap<>();
        if (profileIds.isEmpty()) {
            return names;
        }
        List<PlayerSection> memberships = playerSectionRepository.findByPlayerProfileIdIn(profileIds);
        Map<UUID, String> sectionNames = sectionRepository
                .findAllById(memberships.stream().map(PlayerSection::getSectionId).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Section::getId, Section::getName));
        for (PlayerSection ps : memberships) {
            String name = sectionNames.get(ps.getSectionId());
            if (name != null) {
                names.computeIfAbsent(ps.getPlayerProfileId(), k -> new ArrayList<>()).add(name);
            }
        }
        names.values().forEach(list -> list.sort(String.CASE_INSENSITIVE_ORDER));
        return names;
    }

    /** Team names per player profile id in an active season's squads, ordered by team name. */
    public Map<UUID, List<String>> teamNames(Collection<UUID> profileIds) {
        Map<UUID, List<String>> names = new HashMap<>();
        if (profileIds.isEmpty()) {
            return names;
        }
        for (PlayerTeamNameView view : teamSquadMemberRepository.findActiveSeasonTeamNames(profileIds)) {
            List<String> list = names.computeIfAbsent(view.getPlayerProfileId(), k -> new ArrayList<>());
            if (!list.contains(view.getTeamName())) {
                list.add(view.getTeamName());
            }
        }
        return names;
    }

    /** First section name (alphabetical), else the first team name in an active season's squad; absent when neither. */
    public Map<UUID, String> groupLabels(Collection<PlayerProfile> profiles) {
        Set<UUID> ids = profiles.stream().map(PlayerProfile::getId).collect(Collectors.toSet());
        Map<UUID, List<String>> sections = sectionNames(ids);
        Map<UUID, List<String>> teams = teamNames(ids);
        Map<UUID, String> labels = new HashMap<>();
        for (UUID id : ids) {
            if (sections.containsKey(id)) {
                labels.put(id, sections.get(id).get(0));
            } else if (teams.containsKey(id)) {
                labels.put(id, teams.get(id).get(0));
            }
        }
        return labels;
    }
}
