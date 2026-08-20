package com.cricketlegend.service;

import com.cricketlegend.dto.MediaUploadResponse;
import org.springframework.web.multipart.MultipartFile;

/**
 * A first, generically-reusable image-upload mechanism — not scoped to {@code ClubProfile}
 * specifically; any future consumer (Sponsors, Club Contacts) calls the same
 * {@code POST /api/v1/platform/media} endpoint this backs. See docs/specs/012-club-profile.md.
 */
public interface MediaService {

    /**
     * Validates {@code file}'s content type against the fixed image allowlist (PNG/JPEG/WebP),
     * writes it to the configured local storage directory under a generated filename, and
     * returns the public {@code /media/**} URL it's now reachable at. Throws
     * {@link com.cricketlegend.exception.UnsupportedMediaTypeException} when the content type
     * isn't allowed.
     */
    MediaUploadResponse upload(MultipartFile file);
}
