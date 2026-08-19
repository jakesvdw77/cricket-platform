package com.cricketlegend.controller;

import com.cricketlegend.dto.ClubDto;
import com.cricketlegend.dto.CreateClubRequest;
import com.cricketlegend.dto.UpdateClubRequest;
import com.cricketlegend.service.ClubService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/010-minimal-club-creation.md: platform_admin-only Club CRUD (create, get, paginated
 * list, update, suspend, reactivate — no hard delete). Authorization for /api/v1/platform/** is
 * enforced by {@link com.cricketlegend.config.SecurityConfig}'s URL-based platform_admin check.
 */
@RestController
public class ClubController {

    private final ClubService clubService;

    public ClubController(ClubService clubService) {
        this.clubService = clubService;
    }

    @GetMapping("/api/v1/platform/clubs")
    public ResponseEntity<Page<ClubDto>> list(
            @RequestParam(required = false) String search, Pageable pageable) {
        return ResponseEntity.ok(clubService.list(search, pageable));
    }

    @GetMapping("/api/v1/platform/clubs/{id}")
    public ResponseEntity<ClubDto> get(@PathVariable UUID id) {
        return ResponseEntity.ok(clubService.get(id));
    }

    @PostMapping("/api/v1/platform/clubs")
    @ApiResponse(responseCode = "201", description = "Club created")
    public ResponseEntity<ClubDto> create(@Valid @RequestBody CreateClubRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(clubService.create(request));
    }

    @PutMapping("/api/v1/platform/clubs/{id}")
    public ResponseEntity<ClubDto> update(
            @PathVariable UUID id, @Valid @RequestBody UpdateClubRequest request) {
        return ResponseEntity.ok(clubService.update(id, request));
    }

    @PostMapping("/api/v1/platform/clubs/{id}/suspend")
    public ResponseEntity<ClubDto> suspend(@PathVariable UUID id) {
        return ResponseEntity.ok(clubService.suspend(id));
    }

    @PostMapping("/api/v1/platform/clubs/{id}/reactivate")
    public ResponseEntity<ClubDto> reactivate(@PathVariable UUID id) {
        return ResponseEntity.ok(clubService.reactivate(id));
    }
}
