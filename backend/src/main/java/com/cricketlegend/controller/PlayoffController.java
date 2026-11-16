package com.cricketlegend.controller;

import com.cricketlegend.dto.CreatePlayoffsRequest;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.service.PlayoffService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/155-playoff-and-knockout-fixtures.md: create a round of playoff games for a league and season. {@code /preview}
 * validates and returns what would be created without writing; the plain POST creates it (the confirm step). The match
 * rules and the per-section access check run in the match service, as for any match.
 */
@RestController
public class PlayoffController {

    private static final String BASE = "/api/v1/manage/clubs/{clubId}/leagues/{leagueId}/seasons/{seasonId}/playoffs";

    private final PlayoffService playoffService;

    public PlayoffController(PlayoffService playoffService) {
        this.playoffService = playoffService;
    }

    @PreAuthorize("@access.can(authentication, #clubId, T(com.cricketlegend.domain.Permission).MATCHES_EDIT)")
    @PostMapping(BASE + "/preview")
    public ResponseEntity<List<MatchDto>> preview(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID leagueId,
            @PathVariable UUID seasonId,
            @Valid @RequestBody CreatePlayoffsRequest request) {
        return ResponseEntity.ok(playoffService.preview(authentication, clubId, leagueId, seasonId, request));
    }

    @PreAuthorize("@access.can(authentication, #clubId, T(com.cricketlegend.domain.Permission).MATCHES_EDIT)")
    @PostMapping(BASE)
    public ResponseEntity<List<MatchDto>> create(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID leagueId,
            @PathVariable UUID seasonId,
            @Valid @RequestBody CreatePlayoffsRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(playoffService.create(authentication, clubId, leagueId, seasonId, request));
    }
}
