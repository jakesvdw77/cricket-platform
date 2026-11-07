package com.cricketlegend.service;

import com.cricketlegend.dto.MyLeaderboardAwardsDto;
import com.cricketlegend.dto.MyLeaderboardFiltersDto;
import com.cricketlegend.dto.MyLeaderboardStandingDto;
import com.cricketlegend.dto.MyLeaderboardTableDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/147: the read-only Player Hub leaderboards of a player the caller holds (My players, docs/specs/119).
 * Authorised only by {@code MyPlayerAccess} (key not held, malformed or dropped out: 404; suspended: 403), which runs
 * before any validation. Every figure covers only published results a manager switched on for the Player Hub and is the
 * manager leaderboard figure for the same players; the players listed are those of the leagues the held player's teams
 * played in during the chosen season (friendlies are outside the reach). A season, league or team of another club is a
 * 404. Every ranking goes through {@code HubRankingPolicy}: when it does not allow rankings the reads return empty ranking
 * data (never a 404). Names are full names, inside the signed-in Hub only; no response carries a player id.
 */
public interface MyLeaderboardService {

    /**
     * One page of a standings table. {@code group} is batting, bowling or fielding (anything else is a 400). The sort,
     * direction, minimum, page and size rules are the manager table's: an unknown sort, a direction other than asc or desc, a
     * bad minimum, a negative page or a size below 1 is a 400, a size above 100 is capped at 100; more than 5,000 players
     * in the reach is a 400.
     */
    MyLeaderboardTableDto table(
            Authentication authentication,
            String playerKey,
            String group,
            String sort,
            String direction,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String minimum,
            Integer page,
            Integer size);

    /** The "Where Sam stands" card: the held player's place in runs, batting average, wickets, economy and catches. */
    MyLeaderboardStandingDto standing(
            Authentication authentication, String playerKey, UUID seasonId, UUID leagueId, UUID teamId);

    /**
     * The category leaders of the club's Awards categories, only for a season that has ended; otherwise a payload with
     * {@code revealed} false, the reason and the message, and no leaders.
     */
    MyLeaderboardAwardsDto awards(
            Authentication authentication, String playerKey, UUID seasonId, UUID leagueId, UUID teamId);

    /** The Season, League and Team options inside the held player's leaderboard reach. */
    MyLeaderboardFiltersDto filters(Authentication authentication, String playerKey);
}
