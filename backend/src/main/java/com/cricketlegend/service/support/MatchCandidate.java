package com.cricketlegend.service.support;

import com.cricketlegend.domain.PlayerProfile;

/** A matched player profile with its minimised view, used inside {@code LinkServiceImpl} only. */
public record MatchCandidate(PlayerProfile profile, boolean hasMainAgent, MatchedPlayer view) {}
