package com.cricketlegend.service;

import com.cricketlegend.dto.MyMatchDto;
import com.cricketlegend.dto.MyMatchListDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/** docs/specs/135: the read-only Player Hub matches of a player the caller holds (My players, docs/specs/119). */
public interface MyMatchService {

    /** Live, upcoming and recent matches of the held player's teams; a 404 for a key the caller does not hold. */
    MyMatchListDto list(Authentication authentication, String playerKey);

    /** One match; a 404 when it is not a match of one of the held player's teams (or is another club's). */
    MyMatchDto get(Authentication authentication, String playerKey, UUID matchId);
}
