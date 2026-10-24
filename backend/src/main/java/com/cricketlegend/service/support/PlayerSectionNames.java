package com.cricketlegend.service.support;

import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.Section;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SectionRepository;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** The section tags of players and the label a list shows for them: the first section name alphabetically. */
@Component
public class PlayerSectionNames {

    private final PlayerSectionRepository playerSectionRepository;
    private final SectionRepository sectionRepository;

    public PlayerSectionNames(PlayerSectionRepository playerSectionRepository, SectionRepository sectionRepository) {
        this.playerSectionRepository = playerSectionRepository;
        this.sectionRepository = sectionRepository;
    }

    /** Every section id each player is tagged to; a player with none has no entry. Two statements at most. */
    public Map<UUID, Set<UUID>> sectionIds(Collection<UUID> playerProfileIds) {
        Map<UUID, Set<UUID>> result = new HashMap<>();
        if (playerProfileIds.isEmpty()) {
            return result;
        }
        for (PlayerSection ps : playerSectionRepository.findByPlayerProfileIdIn(playerProfileIds)) {
            result.computeIfAbsent(ps.getPlayerProfileId(), id -> new java.util.HashSet<>()).add(ps.getSectionId());
        }
        return result;
    }

    /** The first section name (alphabetical, case-insensitive) of each player; absent for an untagged player. */
    public Map<UUID, String> firstNames(Map<UUID, Set<UUID>> sectionIdsByPlayer) {
        Map<UUID, String> labels = new HashMap<>();
        if (sectionIdsByPlayer.isEmpty()) {
            return labels;
        }
        Set<UUID> all = sectionIdsByPlayer.values().stream().flatMap(Set::stream).collect(Collectors.toSet());
        Map<UUID, String> names = sectionRepository.findAllById(all).stream()
                .collect(Collectors.toMap(Section::getId, Section::getName));
        sectionIdsByPlayer.forEach((playerId, ids) -> {
            List<String> sorted = ids.stream()
                    .map(names::get)
                    .filter(java.util.Objects::nonNull)
                    .sorted(String.CASE_INSENSITIVE_ORDER)
                    .toList();
            if (!sorted.isEmpty()) {
                labels.put(playerId, sorted.get(0));
            }
        });
        return labels;
    }
}
