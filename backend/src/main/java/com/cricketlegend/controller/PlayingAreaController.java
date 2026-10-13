package com.cricketlegend.controller;

import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.dto.PlayingAreaDto;
import com.cricketlegend.dto.PlayingAreaFilterOptionsDto;
import com.cricketlegend.dto.PlayingAreaRequest;
import com.cricketlegend.dto.PlayingAreaSummaryDto;
import com.cricketlegend.service.PlayingAreaService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/099-fields-directory.md: the club-scoped view of the platform-wide fields directory, on {@code
 * /api/v1/manage/clubs/{clubId}/playing-areas}. The UI calls them "fields". The directory data is global; {@code clubId}
 * scopes the caller (home links, edit rights).
 */
@RestController
public class PlayingAreaController {

    private final PlayingAreaService playingAreaService;

    public PlayingAreaController(PlayingAreaService playingAreaService) {
        this.playingAreaService = playingAreaService;
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/playing-areas")
    public ResponseEntity<Page<PlayingAreaDto>> list(
            @PathVariable UUID clubId,
            @RequestParam(required = false) String q,
            @RequestParam(name = "category", required = false) List<PlayingAreaCategory> categories,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String province,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) PlayingAreaVerificationStatus verification,
            @RequestParam(required = false, defaultValue = "false") boolean mine,
            @RequestParam(required = false, defaultValue = "false") boolean usedByClub,
            @RequestParam(required = false, defaultValue = "CRICKET_FIELD") PlayingAreaType areaType,
            Pageable pageable) {
        return ResponseEntity.ok(playingAreaService.list(
                clubId, areaType, q, categories, country, province, city, verification, mine, usedByClub, pageable));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/playing-areas/summary")
    public ResponseEntity<PlayingAreaSummaryDto> summary(
            @PathVariable UUID clubId,
            @RequestParam(required = false) String q,
            @RequestParam(name = "category", required = false) List<PlayingAreaCategory> categories,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String province,
            @RequestParam(required = false) String city,
            @RequestParam(required = false, defaultValue = "CRICKET_FIELD") PlayingAreaType areaType) {
        return ResponseEntity.ok(
                playingAreaService.summary(clubId, areaType, q, categories, country, province, city));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/playing-areas/filter-options")
    public ResponseEntity<PlayingAreaFilterOptionsDto> filterOptions(
            @PathVariable UUID clubId,
            @RequestParam(required = false) String q,
            @RequestParam(name = "category", required = false) List<PlayingAreaCategory> categories,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String province,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) PlayingAreaVerificationStatus verification,
            @RequestParam(required = false, defaultValue = "false") boolean mine,
            @RequestParam(required = false, defaultValue = "CRICKET_FIELD") PlayingAreaType areaType) {
        return ResponseEntity.ok(playingAreaService.filterOptions(
                clubId, areaType, q, categories, country, province, city, verification, mine));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/playing-areas/similar")
    public ResponseEntity<List<PlayingAreaDto>> similar(
            @PathVariable UUID clubId,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String country) {
        return ResponseEntity.ok(playingAreaService.similar(clubId, name, city, country));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/playing-areas/{id}")
    public ResponseEntity<PlayingAreaDto> get(@PathVariable UUID clubId, @PathVariable UUID id) {
        return ResponseEntity.ok(playingAreaService.get(clubId, id));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/playing-areas")
    @ApiResponse(responseCode = "201", description = "Field captured")
    public ResponseEntity<PlayingAreaDto> create(
            @PathVariable UUID clubId,
            @RequestParam(defaultValue = "false") boolean linkHome,
            @Valid @RequestBody PlayingAreaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(playingAreaService.create(clubId, request, linkHome));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/playing-areas/{id}")
    public ResponseEntity<PlayingAreaDto> update(
            @PathVariable UUID clubId, @PathVariable UUID id, @Valid @RequestBody PlayingAreaRequest request) {
        return ResponseEntity.ok(playingAreaService.update(clubId, id, request));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/playing-areas/{id}/home")
    public ResponseEntity<PlayingAreaDto> linkHome(@PathVariable UUID clubId, @PathVariable UUID id) {
        return ResponseEntity.ok(playingAreaService.linkHome(clubId, id));
    }

    @PreAuthorize("@access.canAccessClub(authentication, #clubId)")
    @DeleteMapping("/api/v1/manage/clubs/{clubId}/playing-areas/{id}/home")
    @ApiResponse(responseCode = "204", description = "Home link removed")
    public ResponseEntity<Void> unlinkHome(@PathVariable UUID clubId, @PathVariable UUID id) {
        playingAreaService.unlinkHome(clubId, id);
        return ResponseEntity.noContent().build();
    }
}
