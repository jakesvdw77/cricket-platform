package com.cricketlegend.mapper;

import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.dto.MatchSideDto;
import com.cricketlegend.dto.MatchSidePlayerDto;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Composes a {@link MatchSideDto} from a {@link MatchSide} plus its already-loaded, ordered
 * {@link MatchSidePlayer} rows — a plain hand-written compose method rather than forcing MapStruct
 * across two inputs, mirroring {@code PlayerMapper}'s own manual-compose precedent. See
 * docs/specs/029-league-management.md.
 */
@Component
public class MatchSideMapper {

    public MatchSideDto toDto(MatchSide side, List<MatchSidePlayer> players) {
        return new MatchSideDto(
                side.getId(),
                side.getMatchId(),
                side.getTeamId(),
                side.getCaptainPlayerId(),
                side.getWicketKeeperPlayerId(),
                side.getTwelfthManPlayerId(),
                players.stream().map(this::toPlayerDto).toList());
    }

    private MatchSidePlayerDto toPlayerDto(MatchSidePlayer player) {
        UUID playerProfileId = player.getPlayerProfileId();
        return new MatchSidePlayerDto(playerProfileId, player.getBattingOrder(), player.getRole());
    }
}
