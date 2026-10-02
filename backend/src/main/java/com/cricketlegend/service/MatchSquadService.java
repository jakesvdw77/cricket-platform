package com.cricketlegend.service;

import com.cricketlegend.dto.MatchSquadDto;
import com.cricketlegend.dto.MatchSquadMemberDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * The per-fixture squad pool for a group-poll-covered match of a {@link com.cricketlegend.domain.Team} — see
 * docs/specs/063-section-availability-and-flexible-squads.md's API Contract (Part B/C).
 */
public interface MatchSquadService {

    MatchSquadDto get(Authentication authentication, UUID clubId, UUID matchId, UUID teamId);

    MatchSquadMemberDto add(Authentication authentication, UUID clubId, UUID matchId, UUID teamId, UUID playerId);

    void remove(Authentication authentication, UUID clubId, UUID matchId, UUID teamId, UUID playerId);

    MatchSquadMemberDto updateJerseyNumber(
            Authentication authentication, UUID clubId, UUID matchId, UUID teamId, UUID playerId, Integer jerseyNumber);
}
