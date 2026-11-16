package com.cricketlegend.controller;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.dto.GalleryFiltersDto;
import com.cricketlegend.dto.GalleryImageDto;
import com.cricketlegend.dto.GalleryPageDto;
import com.cricketlegend.dto.GalleryQuery;
import com.cricketlegend.service.GalleryService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * docs/specs/157-photo-gallery.md: the club gallery for a manager. Any manager of the club reads it; adding and deleting
 * need {@code CLUB_SETUP_EDIT} (a gallery permission can be split out later). The service reads and writes this club only.
 */
@RestController
@RequestMapping("/api/v1/manage/clubs/{clubId}/gallery")
class GalleryController {

    private final GalleryService galleryService;
    private final AccessService accessService;

    GalleryController(GalleryService galleryService, AccessService accessService) {
        this.galleryService = galleryService;
        this.accessService = accessService;
    }

    @PreAuthorize("@access.hasAnyGrant(authentication, #clubId)")
    @GetMapping
    ResponseEntity<GalleryPageDto> list(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID playerId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        UUID caller = accessService.resolveCurrentPersonId(authentication);
        GalleryPageDto body = galleryService.listForClub(clubId, caller, new GalleryQuery(q, leagueId, teamId, playerId), page, size);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore().cachePrivate()).body(body);
    }

    @PreAuthorize("@access.hasAnyGrant(authentication, #clubId)")
    @GetMapping("/filters")
    ResponseEntity<GalleryFiltersDto> filters(@PathVariable UUID clubId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore().cachePrivate()).body(galleryService.filtersForClub(clubId));
    }

    @PreAuthorize("@access.can(authentication, #clubId, T(com.cricketlegend.domain.Permission).CLUB_SETUP_EDIT)")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<GalleryImageDto> upload(
            Authentication authentication,
            @PathVariable UUID clubId,
            @RequestParam("medium") MultipartFile medium,
            @RequestParam("thumb") MultipartFile thumb,
            @RequestParam(required = false) String caption,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(name = "playerId", required = false) List<UUID> playerIds) {
        UUID caller = accessService.resolveCurrentPersonId(authentication);
        GalleryImageDto created = galleryService.uploadForClub(clubId, caller, medium, thumb, caption, leagueId, teamId, playerIds);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PreAuthorize("@access.can(authentication, #clubId, T(com.cricketlegend.domain.Permission).CLUB_SETUP_EDIT)")
    @DeleteMapping("/{imageId}")
    ResponseEntity<Void> delete(@PathVariable UUID clubId, @PathVariable UUID imageId) {
        galleryService.deleteForClub(clubId, imageId);
        return ResponseEntity.noContent().build();
    }
}
