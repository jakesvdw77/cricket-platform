package com.cricketlegend.controller;

import com.cricketlegend.dto.TeamDashboardDto;
import com.cricketlegend.dto.TeamStatsDto;
import com.cricketlegend.dto.TeamStatsFilterOptionsDto;
import com.cricketlegend.dto.TeamStatsTableDto;
import com.cricketlegend.service.TeamDashboardService;
import com.cricketlegend.service.TeamStatsService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/116-team-stats.md, "API Contract": team statistics from published results. Any club manager ({@code
 * canAccessClub}); a section-scoped manager is narrowed to their sections inside the service. The literal route {@code
 * /team-stats/filter-options} has no variable sibling, so it is never swallowed.
 */
@RestController
public class TeamStatsController {

    private final TeamStatsService teamStatsService;

    private final TeamDashboardService teamDashboardService;

    public TeamStatsController(TeamStatsService teamStatsService, TeamDashboardService teamDashboardService) {
        this.teamStatsService = teamStatsService;
        this.teamDashboardService = teamDashboardService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/team-stats")
    public ResponseEntity<TeamStatsTableDto> getTeamStatsTable(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String direction,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false) String competition,
            @RequestParam(required = false) String minimum,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return ResponseEntity.ok(teamStatsService.table(
                authentication, clubId, sort, direction, seasonId, leagueId, sectionId, competition, minimum, page, size));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/team-stats/filter-options")
    public ResponseEntity<TeamStatsFilterOptionsDto> getTeamStatsFilterOptions(
            Authentication authentication, @PathVariable UUID clubId, @RequestParam(required = false) UUID teamId) {
        return ResponseEntity.ok(teamStatsService.filterOptions(authentication, clubId, teamId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/teams/{teamId}/stats")
    public ResponseEntity<TeamStatsDto> getTeamStats(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID teamId,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) String competition) {
        return ResponseEntity.ok(teamStatsService.team(authentication, clubId, teamId, seasonId, leagueId, competition));
    }

    /** docs/specs/117-stats-dashboard.md: every series of the team Dashboard, for the filters the page holds. */
    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/teams/{teamId}/stats/dashboard")
    public ResponseEntity<TeamDashboardDto> getTeamDashboard(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID teamId,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) String competition) {
        return ResponseEntity.ok(teamDashboardService.get(authentication, clubId, teamId, seasonId, leagueId, competition));
    }
}
