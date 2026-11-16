package com.cricketlegend.controller;

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
 * docs/specs/157-photo-gallery.md: the club gallery for a held player in the Player Hub, authorised only from the caller's
 * own held player (404 for any other key), like {@code MePlayerClubInfoController}. Lists are
 * {@code Cache-Control: private, no-store} (they change as photos are added).
 */
@RestController
@RequestMapping("/api/v1/me/players")
class MePlayerGalleryController {

    private final GalleryService galleryService;

    MePlayerGalleryController(GalleryService galleryService) {
        this.galleryService = galleryService;
    }

    @GetMapping("/{playerKey}/gallery")
    ResponseEntity<GalleryPageDto> list(
            Authentication authentication,
            @PathVariable String playerKey,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(required = false) UUID playerId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return noStore(galleryService.list(authentication, playerKey, new GalleryQuery(q, leagueId, teamId, playerId), page, size));
    }

    @GetMapping("/{playerKey}/gallery/filters")
    ResponseEntity<GalleryFiltersDto> filters(Authentication authentication, @PathVariable String playerKey) {
        return noStore(galleryService.filters(authentication, playerKey));
    }

    @GetMapping("/{playerKey}/gallery/latest")
    ResponseEntity<List<GalleryImageDto>> latest(
            Authentication authentication, @PathVariable String playerKey, @RequestParam(required = false) Integer limit) {
        return noStore(galleryService.latest(authentication, playerKey, limit));
    }

    @PostMapping(value = "/{playerKey}/gallery", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<GalleryImageDto> upload(
            Authentication authentication,
            @PathVariable String playerKey,
            @RequestParam("medium") MultipartFile medium,
            @RequestParam("thumb") MultipartFile thumb,
            @RequestParam(required = false) String caption,
            @RequestParam(required = false) UUID leagueId,
            @RequestParam(required = false) UUID teamId,
            @RequestParam(defaultValue = "false") boolean tagMyPlayer) {
        GalleryImageDto created = galleryService.upload(authentication, playerKey, medium, thumb, caption, leagueId, teamId, tagMyPlayer);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @DeleteMapping("/{playerKey}/gallery/{imageId}")
    ResponseEntity<Void> delete(Authentication authentication, @PathVariable String playerKey, @PathVariable UUID imageId) {
        galleryService.delete(authentication, playerKey, imageId);
        return ResponseEntity.noContent().build();
    }

    private <T> ResponseEntity<T> noStore(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore().cachePrivate()).body(body);
    }
}
