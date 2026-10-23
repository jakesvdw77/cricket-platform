package com.cricketlegend.dto;

import java.util.List;

/** {@code GET /api/v1/me/player-matches}: matches split by whether the player already has a main agent. */
public record PlayerMatchesDto(
        List<PlayerMatchDto> withoutMainAgent, List<PlayerMatchWithMainAgentDto> withMainAgent) {}
