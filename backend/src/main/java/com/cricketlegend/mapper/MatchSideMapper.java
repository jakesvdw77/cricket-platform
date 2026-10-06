package com.cricketlegend.mapper;

import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.dto.MatchSideDto;
import com.cricketlegend.dto.MatchSidePlayerDto;
import com.cricketlegend.dto.PlayerNameDto;
import com.cricketlegend.dto.SelectionLimitsDto;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Composes a {@link MatchSideDto} from a {@link MatchSide} plus its already-loaded, ordered
 * {@link MatchSidePlayer} rows — a plain hand-written compose method rather than forcing MapStruct
 * across two inputs, mirroring {@code PlayerMapper}'s own manual-compose precedent. See
 * docs/specs/029-league-management.md. The {@code limits} (docs/specs/076-team-selection.md) are
 * computed by the service and passed in.
 */
@Component
public class MatchSideMapper {

    public MatchSideDto toDto(
            MatchSide side,
            List<MatchSidePlayer> players,
            SelectionLimitsDto limits,
            Map<UUID, PlayerNameDto> playerNames) {
        return new MatchSideDto(
                side.getId(),
                side.getMatchId(),
                side.getTeamId(),
                side.getCaptainPlayerId(),
                side.getWicketKeeperPlayerId(),
                side.getTwelfthManPlayerId(),
                players.stream().map(player -> toPlayerDto(player, playerNames)).toList(),
                side.isAnnounced(),
                limits);
    }

    private MatchSidePlayerDto toPlayerDto(
            MatchSidePlayer player, Map<UUID, PlayerNameDto> playerNames) {
        PlayerNameDto info = playerNames.get(player.getPlayerProfileId());
        return new MatchSidePlayerDto(
                player.getPlayerProfileId(),
                player.getBattingOrder(),
                player.getRole(),
                info == null ? null : info.firstName(),
                info == null ? null : info.lastName());
    }
}
