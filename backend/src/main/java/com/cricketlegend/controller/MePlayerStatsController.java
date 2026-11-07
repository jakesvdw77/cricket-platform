package com.cricketlegend.controller;

import com.cricketlegend.dto.MyLeaderboardAwardsDto;
import com.cricketlegend.dto.MyLeaderboardFiltersDto;
import com.cricketlegend.dto.MyLeaderboardStandingDto;
import com.cricketlegend.dto.MyLeaderboardTableDto;
import com.cricketlegend.dto.MyStatsDto;
import com.cricketlegend.dto.MyStatsInningsPageDto;
import com.cricketlegend.dto.MyTeamStatsDto;
import com.cricketlegend.service.MyLeaderboardService;
import com.cricketlegend.service.MyStatsService;
import com.cricketlegend.service.MyTeamStatsService;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/147: the Player Hub stats reads of a player the caller holds. Same base path as {@link MePlayersController},
 * kept separate so that one does not grow. Authorised only by {@code MyPlayerAccess} inside the services (a key not held,
 * malformed or dropped out is a 404, a suspended caller a 403). There is no export, share or download route.
 */
@RestController
@RequestMapping("/api/v1/me/players")
class MePlayerStatsController {

    private final MyStatsService myStatsService;
    private final MyTeamStatsService myTeamStatsService;
    private final MyLeaderboardService myLeaderboardService;

    MePlayerStatsController(
            MyStatsService myStatsService,
            MyTeamStatsService myTeamStatsService,
            MyLeaderboardService myLeaderboardService) {
        this.myStatsService = myStatsService;
        this.myTeamStatsService = myTeamStatsService;
        this.myLeaderboardService = myLeaderboardService;
    }

    /** The one payload of the My stats page for the Season, League, Team and Competition filters (all optional). */
    @GetMapping("/{playerKey}/stats")
    MyStatsDto stats(
            Authentication authentication,
            @PathVariable String playerKey,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) String competition) {
        return myStatsService.get(authentication, playerKey, seasonId, leagueId, teamId, competition);
    }

    /** The match drill: one page of the innings, spells or matches behind a figure, newest first. */
    @GetMapping("/{playerKey}/stats/innings")
    MyStatsInningsPageDto innings(
            Authentication authentication,
            @PathVariable String playerKey,
            @RequestParam(required = false) String kind,
            @RequestParam(required = false) String filter,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) String competition,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return myStatsService.innings(
                authentication, playerKey, kind, filter, seasonId, leagueId, teamId, competition, page, size);
    }

    /**
     * The one payload of the Team stats page for one of the player's teams. {@code teamId} is required (400) and must be a
     * team the player has flagged results for (any other team is a 404). There is no {@code sectionId}.
     */
    @GetMapping("/{playerKey}/team-stats")
    MyTeamStatsDto teamStats(
            Authentication authentication,
            @PathVariable String playerKey,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) String competition) {
        return myTeamStatsService.get(authentication, playerKey, teamId, seasonId, leagueId, competition);
    }

    /**
     * One page of a Player Hub standings table. {@code group} is batting, bowling or fielding (400 otherwise); sort,
     * direction, minimum, page and size are the manager table's (400 when bad).
     */
    @GetMapping("/{playerKey}/leaderboards/{group}")
    MyLeaderboardTableDto leaderboard(
            Authentication authentication,
            @PathVariable String playerKey,
            @PathVariable String group,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String direction,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) String minimum,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return myLeaderboardService.table(
                authentication, playerKey, group, sort, direction, seasonId, leagueId, teamId, minimum, page, size);
    }

    /** The "Where Sam stands" card payload. */
    @GetMapping("/{playerKey}/leaderboards/standing")
    MyLeaderboardStandingDto standing(
            Authentication authentication,
            @PathVariable String playerKey,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID teamId) {
        return myLeaderboardService.standing(authentication, playerKey, seasonId, leagueId, teamId);
    }

    /** The Awards tab: category leaders for a season that has ended, otherwise a held-back payload. */
    @GetMapping("/{playerKey}/leaderboards/awards")
    MyLeaderboardAwardsDto awards(
            Authentication authentication,
            @PathVariable String playerKey,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID teamId) {
        return myLeaderboardService.awards(authentication, playerKey, seasonId, leagueId, teamId);
    }

    /** The Season, League and Team options inside the leaderboard reach. */
    @GetMapping("/{playerKey}/leaderboards/filters")
    MyLeaderboardFiltersDto leaderboardFilters(Authentication authentication, @PathVariable String playerKey) {
        return myLeaderboardService.filters(authentication, playerKey);
    }
}
