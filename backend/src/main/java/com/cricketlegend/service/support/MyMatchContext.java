package com.cricketlegend.service.support;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.MatchSide;
import com.cricketlegend.domain.MatchSidePlayer;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.MatchResultDto;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** docs/specs/135: what the matches of one Player Hub request share, loaded once by {@code MyMatchServiceImpl}. */
public record MyMatchContext(
        Map<UUID, Team> teams,
        Map<UUID, League> leagues,
        Map<UUID, MatchResultDto> published,
        Map<UUID, List<MatchSide>> sidesByMatch,
        Map<UUID, List<MatchSidePlayer>> playersBySide) {}
