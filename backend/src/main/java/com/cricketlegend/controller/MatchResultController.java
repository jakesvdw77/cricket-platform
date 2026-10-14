package com.cricketlegend.controller;

import com.cricketlegend.domain.ResultListFocus;
import com.cricketlegend.domain.ResultOutcomeType;
import com.cricketlegend.domain.ResultStatus;
import com.cricketlegend.dto.GuestNameDto;
import com.cricketlegend.dto.LinkResultPlayerRequest;
import com.cricketlegend.dto.MatchDto;
import com.cricketlegend.dto.MatchFilterOptionsDto;
import com.cricketlegend.dto.MatchResultDto;
import com.cricketlegend.dto.PublishResultRequest;
import com.cricketlegend.dto.ResultDraft;
import com.cricketlegend.dto.ResultPlayerDto;
import com.cricketlegend.dto.ResultListCriteria;
import com.cricketlegend.dto.ResultListItemDto;
import com.cricketlegend.dto.ResultValidationDto;
import com.cricketlegend.dto.ResultsSummaryDto;
import com.cricketlegend.dto.ScorecardDto;
import com.cricketlegend.dto.ScorecardPrefillDto;
import com.cricketlegend.service.ResultService;
import com.cricketlegend.service.ScorecardService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/100-match-results-core.md: the Results list, counters, filter options and capture picker feed, plus one
 * match's result (get, save draft, validate, publish, unpublish, delete draft). Club-scoped, manager only.
 * docs/specs/101: also our side's scorecard (prefill from the selection, read, link a guest) and the guest-name
 * suggestions; the scorecard itself is saved through the result's PUT.
 */
@RestController
public class MatchResultController {

    private final ResultService resultService;
    private final ScorecardService scorecardService;

    public MatchResultController(ResultService resultService, ScorecardService scorecardService) {
        this.resultService = resultService;
        this.scorecardService = scorecardService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/results")
    public ResponseEntity<Page<ResultListItemDto>> list(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) List<ResultOutcomeType> outcome,
            @RequestParam(required = false) ResultStatus status,
            @RequestParam(required = false) String focus, // played | won | lost | tied-or-none | drafts
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            Pageable pageable) {
        return ResponseEntity.ok(resultService.list(
                authentication, clubId,
                criteria(sectionId, leagueId, seasonId, teamId, search, outcome, status, focus, from, to), pageable));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/results/summary")
    public ResponseEntity<ResultsSummaryDto> summary(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(resultService.summary(
                authentication, clubId,
                criteria(sectionId, leagueId, seasonId, teamId, search, null, null, null, from, to)));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/results/filter-options")
    public ResponseEntity<MatchFilterOptionsDto> filterOptions(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(resultService.filterOptions(
                authentication, clubId,
                criteria(sectionId, leagueId, seasonId, teamId, search, null, null, null, null, null)));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/results/awaiting")
    public ResponseEntity<Page<MatchDto>> awaiting(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false, defaultValue = "false") boolean includeUpcoming,
            Pageable pageable) {
        return ResponseEntity.ok(resultService.awaiting(
                authentication, clubId,
                criteria(sectionId, leagueId, seasonId, teamId, search, null, null, null, from, to),
                includeUpcoming, pageable));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/result")
    public ResponseEntity<MatchResultDto> get(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID matchId) {
        return ResponseEntity.ok(resultService.get(authentication, clubId, matchId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/result")
    public ResponseEntity<MatchResultDto> saveDraft(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @RequestBody ResultDraft draft) {
        return ResponseEntity.ok(resultService.upsertDraft(authentication, clubId, matchId, draft));
    }

    /** Dry run: validates the body when given, otherwise the stored result. */
    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/result/validate")
    public ResponseEntity<ResultValidationDto> validate(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @RequestBody(required = false) ResultDraft draft) {
        return ResponseEntity.ok(resultService.validate(authentication, clubId, matchId, draft));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/result/publish")
    public ResponseEntity<MatchResultDto> publish(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @RequestBody(required = false) PublishResultRequest request) {
        boolean acknowledged = request != null && request.acknowledgedWarnings();
        return ResponseEntity.ok(resultService.publish(authentication, clubId, matchId, acknowledged));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/result/unpublish")
    public ResponseEntity<MatchResultDto> unpublish(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID matchId) {
        return ResponseEntity.ok(resultService.unpublish(authentication, clubId, matchId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @DeleteMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/result")
    public ResponseEntity<Void> deleteDraft(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID matchId) {
        resultService.deleteDraft(authentication, clubId, matchId);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/result/scorecard/prefill")
    public ResponseEntity<ScorecardPrefillDto> prefillScorecard(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID matchId) {
        return ResponseEntity.ok(scorecardService.prefill(authentication, clubId, matchId));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/result/scorecard")
    public ResponseEntity<ScorecardDto> scorecard(
            Authentication authentication, @PathVariable UUID clubId, @PathVariable UUID matchId) {
        return ResponseEntity.ok(scorecardService.read(authentication, clubId, matchId));
    }

    /** The one write allowed on a published result: who is credited for a guest row, not any figure. */
    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/matches/{matchId}/result/players/{resultPlayerId}/link")
    public ResponseEntity<ResultPlayerDto> linkPlayer(
            Authentication authentication,
            @PathVariable UUID clubId,
            @PathVariable UUID matchId,
            @PathVariable UUID resultPlayerId,
            @Valid @RequestBody LinkResultPlayerRequest request) {
        return ResponseEntity.ok(scorecardService.link(
                authentication, clubId, matchId, resultPlayerId, request.playerProfileId()));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/results/guest-names")
    public ResponseEntity<Page<GuestNameDto>> guestNames(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) String q,
            Pageable pageable) {
        return ResponseEntity.ok(scorecardService.guestNames(authentication, clubId, teamId, q, pageable));
    }

    private ResultListCriteria criteria(
            UUID sectionId, UUID leagueId, UUID seasonId, UUID teamId, String search, List<ResultOutcomeType> outcome,
            ResultStatus status, String focus, LocalDate from, LocalDate to) {
        return new ResultListCriteria(
                sectionId, leagueId, seasonId, teamId, search, outcome, status, ResultListFocus.parse(focus), from, to);
    }
}
