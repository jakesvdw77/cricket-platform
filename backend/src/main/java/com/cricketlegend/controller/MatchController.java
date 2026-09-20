package com.cricketlegend.controller;

import com.cricketlegend.dto.CreateMatchRequest;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.MatchFilterOptionsDto;
import com.cricketlegend.dto.UpdateMatchRequest;
import com.cricketlegend.service.MatchService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/029-league-management.md: list (paginated — the first {@code Pageable} endpoint in
 * this feature area)/get/create/update/deactivate/reactivate for a club's own scheduled {@code
 * Match} rows, on {@code /api/v1/manage/clubs/{clubId}/matches}.
 */
@RestController
public class MatchController {

    private final MatchService matchService;

    public MatchController(MatchService matchService) {
        this.matchService = matchService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/matches")
    public ResponseEntity<Page<MatchDto>> list(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false, defaultValue = "false") boolean upcomingOnly,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID seasonId,
            Pageable pageable) {
        return ResponseEntity.ok(matchService.list(
                authentication, clubId, sectionId, upcomingOnly, search, leagueId, seasonId, pageable));
    }

    /**
     * Per docs/specs/042-match-list-filters-and-search.md: tells the frontend which
     * Section/League/Season ids are still reachable given whichever OTHER filters are currently
     * active, so {@code MatchList}'s three filter dropdowns can narrow each other's own option
     * lists rather than ever offering a combination with zero possible matches.
     */
    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/matches/filter-options")
    public ResponseEntity<MatchFilterOptionsDto> filterOptions(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "false") boolean upcomingOnly) {
        return ResponseEntity.ok(matchService.filterOptions(
                authentication, clubId, sectionId, leagueId, seasonId, search, upcomingOnly));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}")
    public ResponseEntity<MatchDto> get(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID matchId) {
        return ResponseEntity.ok(matchService.get(authentication, clubId, matchId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches")
    @ApiResponse(responseCode = "201", description = "Match created")
    public ResponseEntity<MatchDto> create(
            Authentication authentication,
            @PathVariable UUID clubId,
            @Valid @RequestBody CreateMatchRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(matchService.create(authentication, clubId, request));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}")
    public ResponseEntity<MatchDto> update(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @Valid @RequestBody UpdateMatchRequest request) {
        return ResponseEntity.ok(matchService.update(authentication, clubId, matchId, request));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/deactivate")
    public ResponseEntity<MatchDto> deactivate(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID matchId) {
        return ResponseEntity.ok(matchService.deactivate(authentication, clubId, matchId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/reactivate")
    public ResponseEntity<MatchDto> reactivate(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID matchId) {
        return ResponseEntity.ok(matchService.reactivate(authentication, clubId, matchId));
    }
}
