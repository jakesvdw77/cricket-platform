package com.cricketlegend.controller;

import com.cricketlegend.dto.MediaUploadResponse;
import com.cricketlegend.service.MediaService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * docs/specs/012-club-profile.md: generic image upload, not scoped to {@code ClubProfile}
 * specifically. The platform mapping relies on the existing flat {@code /api/v1/platform/**}
 * URL-matcher gate ({@link com.cricketlegend.config.SecurityConfig}) only, no
 * {@code @PreAuthorize} — {@code platform_admin}-only at the URL level.
 *
 * <p>docs/specs/021-club-contacts.md adds a second, additive mapping on {@code
 * /api/v1/manage/media}, serving the same {@link MediaService} for a {@code /manage} caller
 * (first real consumer: Club Contacts' photo field). {@code 012}'s original claim that the
 * platform mapping alone would be reused "unchanged" by future consumers (Sponsors, Club
 * Contacts) predates {@code 020}'s {@code /manage} namespace and wasn't actually reachable by a
 * {@code CLUB_ADMIN} — this mapping is the real, working answer. {@code /api/v1/manage/**} is
 * only {@code authenticated()} at the URL level ({@code 020}), and no additional
 * {@code @PreAuthorize} is added here either: uploading a file isn't club-scoped data in itself —
 * nothing is persisted against a club until the resulting URL is saved onto an authorized record
 * via that record's own (scoped) endpoints.
 */
@RestController
public class MediaController {

    private final MediaService mediaService;

    public MediaController(MediaService mediaService) {
        this.mediaService = mediaService;
    }

    @PostMapping(value = "/api/v1/platform/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MediaUploadResponse> upload(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(mediaService.upload(file));
    }

    @PostMapping(value = "/api/v1/manage/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MediaUploadResponse> uploadManaged(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(mediaService.upload(file));
    }
}
