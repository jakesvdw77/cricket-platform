package com.cricketlegend.controller;

import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.dto.MergePlayingAreaRequest;
import com.cricketlegend.dto.PlatformPlayingAreaDto;
import com.cricketlegend.dto.PlatformPlayingAreaSummaryDto;
import com.cricketlegend.dto.PlayingAreaRequest;
import com.cricketlegend.dto.RejectPlayingAreaRequest;
import com.cricketlegend.service.PlatformPlayingAreaService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/099-fields-directory.md: platform-admin moderation of the fields directory (queue, edit, verify, reject,
 * reopen, merge). Authorization for /api/v1/platform/** is enforced by {@link com.cricketlegend.config.SecurityConfig}'s
 * URL-based platform_admin check, so no per-method annotation.
 */
@RestController
public class PlatformPlayingAreaController {

    private final PlatformPlayingAreaService platformPlayingAreaService;

    public PlatformPlayingAreaController(PlatformPlayingAreaService platformPlayingAreaService) {
        this.platformPlayingAreaService = platformPlayingAreaService;
    }

    @GetMapping("/api/v1/platform/playing-areas")
    public ResponseEntity<Page<PlatformPlayingAreaDto>> list(
            @RequestParam(required = false, defaultValue = "UNVERIFIED") PlayingAreaVerificationStatus verification,
            @RequestParam(required = false) String q,
            @RequestParam(name = "category", required = false) List<PlayingAreaCategory> categories,
            @RequestParam(required = false) String country,
            Pageable pageable) {
        return ResponseEntity.ok(platformPlayingAreaService.list(verification, q, categories, country, pageable));
    }

    @GetMapping("/api/v1/platform/playing-areas/summary")
    public ResponseEntity<PlatformPlayingAreaSummaryDto> summary() {
        return ResponseEntity.ok(platformPlayingAreaService.summary());
    }

    @GetMapping("/api/v1/platform/playing-areas/{id}")
    public ResponseEntity<PlatformPlayingAreaDto> get(@PathVariable UUID id) {
        return ResponseEntity.ok(platformPlayingAreaService.get(id));
    }

    @PutMapping("/api/v1/platform/playing-areas/{id}")
    public ResponseEntity<PlatformPlayingAreaDto> update(
            @PathVariable UUID id, @Valid @RequestBody PlayingAreaRequest request) {
        return ResponseEntity.ok(platformPlayingAreaService.update(id, request));
    }

    @PostMapping("/api/v1/platform/playing-areas/{id}/verify")
    public ResponseEntity<PlatformPlayingAreaDto> verify(Authentication authentication, @PathVariable UUID id) {
        return ResponseEntity.ok(platformPlayingAreaService.verify(id, authentication.getName()));
    }

    @PostMapping("/api/v1/platform/playing-areas/{id}/reject")
    public ResponseEntity<PlatformPlayingAreaDto> reject(
            @PathVariable UUID id, @Valid @RequestBody RejectPlayingAreaRequest request) {
        return ResponseEntity.ok(platformPlayingAreaService.reject(id, request.reason()));
    }

    @PostMapping("/api/v1/platform/playing-areas/{id}/reopen")
    public ResponseEntity<PlatformPlayingAreaDto> reopen(@PathVariable UUID id) {
        return ResponseEntity.ok(platformPlayingAreaService.reopen(id));
    }

    @PostMapping("/api/v1/platform/playing-areas/{id}/merge")
    public ResponseEntity<PlatformPlayingAreaDto> merge(
            @PathVariable UUID id, @Valid @RequestBody MergePlayingAreaRequest request) {
        return ResponseEntity.ok(platformPlayingAreaService.merge(id, request.targetPlayingAreaId()));
    }
}
