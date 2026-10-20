package com.cricketlegend.controller;

import com.cricketlegend.dto.AwardsViewDto;
import com.cricketlegend.dto.LeaderboardCatalogueDto;
import com.cricketlegend.dto.LeaderboardFilterOptionsDto;
import com.cricketlegend.dto.LeaderboardPageDto;
import com.cricketlegend.service.LeaderboardService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/103-player-stats.md, "API Contract (leaderboards)": standings and awards from published results. Any club
 * manager ({@code canAccessClub}); a section-scoped manager is narrowed to their sections inside the service. The literal
 * routes {@code /leaderboards/awards} and {@code /leaderboards/filter-options} are more specific than
 * {@code /leaderboards/{board}}, so Spring MVC matches them first.
 */
@RestController
public class LeaderboardController {

    private final LeaderboardService leaderboardService;

    public LeaderboardController(LeaderboardService leaderboardService) {
        this.leaderboardService = leaderboardService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/leaderboards")
    public ResponseEntity<LeaderboardCatalogueDto> getLeaderboardCatalogue(@PathVariable UUID clubId) {
        return ResponseEntity.ok(leaderboardService.catalogue());
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/leaderboards/awards")
    public ResponseEntity<AwardsViewDto> getAwardsView(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false) String minimumInnings,
            @RequestParam(required = false) String minimumOvers) {
        return ResponseEntity.ok(leaderboardService.awards(
                authentication, clubId, seasonId, leagueId, teamId, sectionId, minimumInnings, minimumOvers));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/leaderboards/filter-options")
    public ResponseEntity<LeaderboardFilterOptionsDto> getLeaderboardFilterOptions(
            Authentication authentication, @PathVariable UUID clubId) {
        return ResponseEntity.ok(leaderboardService.filterOptions(authentication, clubId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/leaderboards/{board}")
    public ResponseEntity<LeaderboardPageDto> getLeaderboard(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable String board,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false) String minimum,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ResponseEntity.ok(leaderboardService.board(
                authentication, clubId, board, seasonId, leagueId, teamId, sectionId, minimum, page, size));
    }
}
