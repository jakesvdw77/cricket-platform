package com.cricketlegend.service;

import com.cricketlegend.dto.MyResultDto;
import com.cricketlegend.dto.MyResultFiltersDto;
import com.cricketlegend.dto.MyResultListDto;
import com.cricketlegend.dto.MyResultSummaryDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/145: the read-only Player Hub results of a player the caller holds (My players, docs/specs/119). Authorised
 * only by {@code MyPlayerAccess} (key not held, malformed or dropped out: 404; suspended: 403). Every read covers only
 * results that are published and switched on for the Player Hub, so what a parent sees adds up; any other result is
 * absent from the list, the summary and the filters and a 404 on {@link #get}. The counting rules are those of
 * {@code PlayerMatchListService} and {@code PlayerStatsService}, called, not copied.
 */
public interface MyResultService {

    /**
     * One page of the held player's counted results, newest first. {@code page} defaults to 0 and {@code size} to 20 (1 to
     * 100, else a 400). A season, team or league of another club is a 404.
     */
    MyResultListDto list(
            Authentication authentication,
            String playerKey,
            UUID seasonId,
            UUID teamId,
            UUID leagueId,
            Integer page,
            Integer size);

    /** The hero figures for the same scope: totals and the newest five rows. */
    MyResultSummaryDto summary(
            Authentication authentication, String playerKey, UUID seasonId, UUID teamId, UUID leagueId);

    /** The seasons, teams and leagues the held player has shown results in. */
    MyResultFiltersDto filters(Authentication authentication, String playerKey);

    /** One result with the full scorecard; a 404 when it is not one of the held player's counted, shown results. */
    MyResultDto get(Authentication authentication, String playerKey, UUID matchId);
}
