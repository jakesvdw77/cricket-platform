package com.cricketlegend.service;

import com.cricketlegend.dto.MyStatsDto;
import com.cricketlegend.dto.MyStatsInningsPageDto;
import java.util.UUID;
import org.springframework.security.core.Authentication;

/**
 * docs/specs/147: the read-only Player Hub "My stats" of a player the caller holds (My players, docs/specs/119).
 * Authorised only by {@code MyPlayerAccess} (key not held, malformed or dropped out: 404; suspended: 403), which runs
 * before any validation. Every figure covers only published results a manager switched on for the Player Hub, so what a
 * parent sees adds up with the Results page. No counting rule is repeated here: the figures are those of {@code
 * PlayerStatsCalculator}.
 */
public interface MyStatsService {

    /**
     * The one payload of the My stats page. A season, league or team of another club is a 404; a {@code competition} other
     * than LEAGUE or FRIENDLY is a 400.
     */
    MyStatsDto get(
            Authentication authentication,
            String playerKey,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition);

    /**
     * The match drill: one page of the innings, spells or matches behind a figure. {@code kind} (BATTING, BOWLING,
     * FIELDING, MATCHES) is required and {@code filter} optional and one of the tokens the {@link #get} payload advertises
     * for that kind; an unknown or inapplicable value is a 400, as are a bad {@code competition}, a negative {@code page} and
     * a {@code size} outside 1 to 100 (default 20). Rows are newest first.
     */
    MyStatsInningsPageDto innings(
            Authentication authentication,
            String playerKey,
            String kind,
            String filter,
            UUID seasonId,
            UUID leagueId,
            UUID teamId,
            String competition,
            Integer page,
            Integer size);
}
