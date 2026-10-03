package com.cricketlegend.service.support;

import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.PlayingRole;
import com.cricketlegend.repository.MatchSidePlayerRepository;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * The writes on a side's selection rows that both {@code MatchSideServiceImpl} and {@code
 * MatchSelectionServiceImpl} need (docs/specs/076-team-selection.md section 2): removing rows
 * (clearing captain, keeper and 12th man pointers at them), adding a row, and setting batting
 * positions so they are always contiguous 1..k with no two players sharing one. Reassignment is
 * two-phase (distinct negatives, flush, then the final values) because {@code UNIQUE (match_side_id,
 * batting_order)} is checked per statement and a permutation would otherwise collide transiently.
 * Must be called inside a transaction.
 */
@Component
public class SelectionSideWriter {

    private final MatchSidePlayerRepository matchSidePlayerRepository;

    public SelectionSideWriter(MatchSidePlayerRepository matchSidePlayerRepository) {
        this.matchSidePlayerRepository = matchSidePlayerRepository;
    }

    /**
     * Deletes these players' rows and clears {@code side}'s captain, keeper and 12th man where they
     * pointed at one of them (the caller saves {@code side}). Flushes so a following position write
     * sees the freed places. Positions are NOT compacted here.
     */
    public void removePlayers(MatchSide side, Collection<UUID> playerIds) {
        if (playerIds.isEmpty()) {
            return;
        }
        for (UUID playerId : playerIds) {
            matchSidePlayerRepository.deleteByMatchSideIdAndPlayerProfileId(side.getId(), playerId);
            if (playerId.equals(side.getCaptainPlayerId())) {
                side.setCaptainPlayerId(null);
            }
            if (playerId.equals(side.getWicketKeeperPlayerId())) {
                side.setWicketKeeperPlayerId(null);
            }
            if (playerId.equals(side.getTwelfthManPlayerId())) {
                side.setTwelfthManPlayerId(null);
            }
        }
        matchSidePlayerRepository.flush();
    }

    /** Inserts one selection row ({@code battingOrder} null leaves him waiting). */
    public MatchSidePlayer addPlayer(UUID sideId, UUID playerId, PlayingRole role, Integer battingOrder) {
        return matchSidePlayerRepository.save(MatchSidePlayer.builder()
                .matchSideId(sideId)
                .playerProfileId(playerId)
                .role(role)
                .battingOrder(battingOrder)
                .build());
    }

    /**
     * Sets the side's batting order: {@code orderedPlayerIds} get positions 1..k in list order, every
     * other row on the side gets none. Ids must be rows of the side.
     */
    public void assignOrder(UUID sideId, List<UUID> orderedPlayerIds) {
        List<MatchSidePlayer> rows = matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(sideId);
        Map<UUID, Integer> target = new HashMap<>();
        for (int i = 0; i < orderedPlayerIds.size(); i++) {
            target.put(orderedPlayerIds.get(i), i + 1);
        }
        List<MatchSidePlayer> changing = new ArrayList<>();
        for (MatchSidePlayer row : rows) {
            if (!Objects.equals(row.getBattingOrder(), target.get(row.getPlayerProfileId()))) {
                changing.add(row);
            }
        }
        int temp = 1;
        for (MatchSidePlayer row : changing) {
            if (row.getBattingOrder() != null) {
                row.setBattingOrder(-(temp++));
            }
        }
        matchSidePlayerRepository.saveAll(changing);
        matchSidePlayerRepository.flush();
        for (MatchSidePlayer row : changing) {
            row.setBattingOrder(target.get(row.getPlayerProfileId()));
        }
        matchSidePlayerRepository.saveAll(changing);
        matchSidePlayerRepository.flush();
    }

    /** Closes any gap in the side's positions, keeping their relative order. */
    public void compact(UUID sideId) {
        assignOrder(sideId, positionedPlayerIds(sideId, Set.of()));
    }

    /** The side's positioned players in batting order, leaving out {@code excluded}. */
    public List<UUID> positionedPlayerIds(UUID sideId, Set<UUID> excluded) {
        return matchSidePlayerRepository.findByMatchSideIdOrderByBattingOrderAsc(sideId).stream()
                .filter(row -> row.getBattingOrder() != null)
                .map(MatchSidePlayer::getPlayerProfileId)
                .filter(id -> !excluded.contains(id))
                .toList();
    }
}
