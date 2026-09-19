package com.cricketlegend.controller;

import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.service.MatchService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/037-match-improvements.md item 9's "Re-select from Previous Match" picker — a
 * {@code Team}'s own previous matches for a given {@code Season}, nested off {@code clubId} +
 * {@code teamId} + {@code seasonId} on {@code
 * /api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/matches/previous}, mirroring
 * {@link TeamSquadController}'s own nested-resource shape rather than folding this onto {@link
 * MatchController} (scoped to {@code clubId}-only {@code /matches}) or {@code TeamController}.
 * Returns a plain, unpaginated {@link List} of the existing, unmodified {@link MatchDto} — the
 * candidate set is naturally small, unlike {@link MatchController#list}'s genuinely unbounded,
 * club-wide match history.
 */
@RestController
public class TeamPreviousMatchController {

    private final MatchService matchService;

    public TeamPreviousMatchController(MatchService matchService) {
        this.matchService = matchService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/teams/{teamId}/seasons/{seasonId}/matches/previous")
    public ResponseEntity<List<MatchDto>> listPrevious(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID teamId,
            @PathVariable UUID seasonId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID excludeMatchId) {
        return ResponseEntity.ok(
                matchService.listPrevious(authentication, clubId, teamId, seasonId, leagueId, excludeMatchId));
    }
}
