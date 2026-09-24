package com.cricketlegend.service;

import com.cricketlegend.dto.MediaUploadResponse;
import java.util.Map;
import org.springframework.web.multipart.MultipartFile;

/**
 * A first, generically-reusable image-upload mechanism — not scoped to {@code ClubProfile}
 * specifically; any future consumer (Sponsors, Club Contacts) calls the same
 * {@code POST /api/v1/platform/media} endpoint this backs. See docs/specs/012-club-profile.md.
 *
 * <p>Per docs/specs/050-league-schedule-and-fixtures.md: {@link #upload(MultipartFile, Map)} is
 * the shared storage plumbing (UUID filename, {@code Files.createDirectories}/{@code Files.copy})
 * extracted so a non-image consumer (Playing Conditions PDFs) can reuse it against its own
 * allowed-content-type map, rather than duplicating that plumbing in a second class. {@link
 * #upload(MultipartFile)} is a thin delegate to it using the fixed image allowlist.
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

    /**
     * Same storage mechanism as {@link #upload(MultipartFile)}, parameterized on {@code
     * allowedContentTypes} (a content-type -&gt; file-extension map, e.g. {@code
     * Map.of("application/pdf", ".pdf")}) instead of the fixed image allowlist — lets a non-image
     * consumer (e.g. Playing Conditions PDFs, docs/specs/050-league-schedule-and-fixtures.md) reuse
     * the same storage plumbing without accepting image content types. Throws {@link
     * com.cricketlegend.exception.UnsupportedMediaTypeException} when {@code file}'s content type
     * isn't a key of {@code allowedContentTypes}.
     */
    MediaUploadResponse upload(MultipartFile file, Map<String, String> allowedContentTypes);
}
