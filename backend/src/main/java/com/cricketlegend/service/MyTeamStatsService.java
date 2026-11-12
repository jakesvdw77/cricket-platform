package com.cricketlegend.service;

import com.cricketlegend.dto.MyTeamStatsDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/147: the read-only Player Hub "Team stats" of a team of a player the caller holds (My players,
 * docs/specs/119). Authorised only by {@code MyPlayerAccess} (key not held, malformed or dropped out: 404; suspended: 403),
 * which runs before any validation. Every figure covers only published results a manager switched on for the Player Hub, so
 * what a parent sees adds up with the Results page, and is the {@code TeamStatsCalculator} figure the manager page shows
 * for the same scope. There is no section reach.
 */
public interface MyTeamStatsService {

    /**
     * The one payload of the Team stats page. {@code teamId} is required (400 when absent) and must be one of the held
     * player's teams, a team in the player's results filter options; any other team, including another club's, is a 404.
     * A season or league of another club is a 404; a {@code competition} other than LEAGUE or FRIENDLY is a 400.
     */
    MyTeamStatsDto get(
            Authentication authentication,
            String playerKey,
            UUID teamId,
            UUID seasonId,
            UUID leagueId,
            String competition);
}
