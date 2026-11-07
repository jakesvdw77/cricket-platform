package com.cricketlegend.controller;

import com.cricketlegend.dto.MyStatsDto;
import com.cricketlegend.dto.MyStatsInningsPageDto;
import com.cricketlegend.service.MyStatsService;
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

    MePlayerStatsController(MyStatsService myStatsService) {
        this.myStatsService = myStatsService;
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
}
