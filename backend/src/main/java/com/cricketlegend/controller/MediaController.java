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
 * specifically — any future consumer (Sponsors, Club Contacts) calls this same endpoint. Relies
 * on the existing flat {@code /api/v1/platform/**} URL-matcher gate ({@link
 * com.cricketlegend.config.SecurityConfig}) only, no {@code @PreAuthorize}.
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
}
