package com.cricketlegend.service;

import com.cricketlegend.dto.MyLeagueDto;
import com.cricketlegend.dto.MyLeaguesDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/** docs/specs/123: the read-only Player Hub leagues for a player the caller holds (My players, docs/specs/119). */
public interface MyLeagueService {

    /**
     * The leagues the held player's teams play in for the season (the club's current season when {@code seasonId} is
     * null), plus the seasons to offer. A 404 for a key the caller does not hold or a season that is not the club's.
     */
    MyLeaguesDto list(Authentication authentication, String playerKey, UUID seasonId);

    /** One league of that list; a 404 when the player's teams are not in it for the season. */
    MyLeagueDto get(Authentication authentication, String playerKey, UUID leagueId, UUID seasonId);
}
