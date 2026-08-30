package com.cricketlegend.controller;

import com.cricketlegend.dto.CreateTeamRequest;
import com.cricketlegend.dto.LinkTeamContactRequest;
import com.cricketlegend.dto.SponsorDto;
import com.cricketlegend.dto.TeamContactDto;
import com.cricketlegend.dto.TeamDto;
import com.cricketlegend.dto.UpdateTeamRequest;
import com.cricketlegend.service.TeamContactService;
import com.cricketlegend.service.TeamService;
import com.cricketlegend.service.TeamSponsorService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * docs/specs/026-teams.md: list/create/update/deactivate/reactivate for a club's {@code Team}
 * rows, nested under a {@link com.cricketlegend.domain.Section}, plus one flat club-wide list, on
 * {@code /api/v1/manage/clubs/{clubId}/teams} and {@code
 * /api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams} only — no {@code /platform} mirror
 * (see the spec's API Contract Architecture note: {@link
 * com.cricketlegend.config.AccessService#canAdministerClub} already gives a {@code
 * platform_admin} superset access on {@code /manage/**}). {@code /api/v1/manage/**} is only
 * {@code authenticated()} at the URL level ({@link com.cricketlegend.config.SecurityConfig}), so
 * every endpoint here carries its own real {@code @PreAuthorize} — no exceptions.
 *
 * <p>docs/specs/027-team-profile.md adds six more endpoints here (contacts/sponsors link/unlink,
 * per docs/plans/027-team-profile.md's Flag #2: {@link TeamContactService}/{@link
 * TeamSponsorService} are separate service classes from {@link TeamService}, but their endpoints
 * still live on this same controller, matching {@code SectionController}'s precedent of hosting a
 * join's endpoints alongside its parent's).
 */
@RestController
public class TeamController {

    private final TeamService teamService;
    private final TeamContactService teamContactService;
    private final TeamSponsorService teamSponsorService;

    public TeamController(
            TeamService teamService,
            TeamContactService teamContactService,
            TeamSponsorService teamSponsorService) {
        this.teamService = teamService;
        this.teamContactService = teamContactService;
        this.teamSponsorService = teamSponsorService;
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/teams")
    public ResponseEntity<List<TeamDto>> listByClub(@PathVariable UUID clubId) {
        return ResponseEntity.ok(teamService.listByClub(clubId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams")
    public ResponseEntity<List<TeamDto>> listBySection(
            @PathVariable UUID clubId, @PathVariable UUID sectionId) {
        return ResponseEntity.ok(teamService.listBySection(clubId, sectionId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams")
    @ApiResponse(responseCode = "201", description = "Team created")
    public ResponseEntity<TeamDto> create(
            @PathVariable UUID clubId,
            @PathVariable UUID sectionId,
            @Valid @RequestBody CreateTeamRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(teamService.create(clubId, sectionId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PutMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}")
    public ResponseEntity<TeamDto> update(
            @PathVariable UUID clubId,
            @PathVariable UUID sectionId,
            @PathVariable UUID teamId,
            @Valid @RequestBody UpdateTeamRequest request) {
        return ResponseEntity.ok(teamService.update(clubId, sectionId, teamId, request));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/deactivate")
    public ResponseEntity<TeamDto> deactivate(
            @PathVariable UUID clubId, @PathVariable UUID sectionId, @PathVariable UUID teamId) {
        return ResponseEntity.ok(teamService.deactivate(clubId, sectionId, teamId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/reactivate")
    public ResponseEntity<TeamDto> reactivate(
            @PathVariable UUID clubId, @PathVariable UUID sectionId, @PathVariable UUID teamId) {
        return ResponseEntity.ok(teamService.reactivate(clubId, sectionId, teamId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts")
    public ResponseEntity<List<TeamContactDto>> listContacts(
            @PathVariable UUID clubId, @PathVariable UUID sectionId, @PathVariable UUID teamId) {
        return ResponseEntity.ok(teamContactService.list(clubId, sectionId, teamId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts/{contactId}/link")
    public ResponseEntity<Void> linkContact(
            @PathVariable UUID clubId,
            @PathVariable UUID sectionId,
            @PathVariable UUID teamId,
            @PathVariable UUID contactId,
            @Valid @RequestBody LinkTeamContactRequest request) {
        teamContactService.link(clubId, sectionId, teamId, contactId, request.role());
        return ResponseEntity.ok().build();
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/contacts/{contactId}/unlink")
    public ResponseEntity<Void> unlinkContact(
            @PathVariable UUID clubId,
            @PathVariable UUID sectionId,
            @PathVariable UUID teamId,
            @PathVariable UUID contactId) {
        teamContactService.unlink(clubId, sectionId, teamId, contactId);
        return ResponseEntity.ok().build();
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @GetMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors")
    public ResponseEntity<List<SponsorDto>> listSponsors(
            @PathVariable UUID clubId, @PathVariable UUID sectionId, @PathVariable UUID teamId) {
        return ResponseEntity.ok(teamSponsorService.list(clubId, sectionId, teamId));
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors/{sponsorId}/link")
    public ResponseEntity<Void> linkSponsor(
            @PathVariable UUID clubId,
            @PathVariable UUID sectionId,
            @PathVariable UUID teamId,
            @PathVariable UUID sponsorId) {
        teamSponsorService.link(clubId, sectionId, teamId, sponsorId);
        return ResponseEntity.ok().build();
    }

    @PreAuthorize("@access.canAdministerClub(authentication, #clubId)")
    @PostMapping("/api/v1/manage/clubs/{clubId}/sections/{sectionId}/teams/{teamId}/sponsors/{sponsorId}/unlink")
    public ResponseEntity<Void> unlinkSponsor(
            @PathVariable UUID clubId,
            @PathVariable UUID sectionId,
            @PathVariable UUID teamId,
            @PathVariable UUID sponsorId) {
        teamSponsorService.unlink(clubId, sectionId, teamId, sponsorId);
        return ResponseEntity.ok().build();
    }
}
