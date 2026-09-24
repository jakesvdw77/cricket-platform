package com.cricketlegend.service.impl;

import com.cricketlegend.dto.MediaUploadResponse;
import com.cricketlegend.exception.UnsupportedMediaTypeException;
import com.cricketlegend.service.MediaService;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Business rule per docs/specs/012-club-profile.md: only a fixed image MIME allowlist
 * (PNG/JPEG/WebP, matching {@code ClubBranding}'s existing logo/favicon handling) may be
 * uploaded — everything else is rejected, not silently accepted or stored. Local-disk storage is
 * a known, deliberately-flagged limitation (doesn't survive/scale across multiple backend
 * instances), not a finished decision — see the spec's Rollout Notes.
 *
 * <p>Per docs/specs/050-league-schedule-and-fixtures.md: the storage plumbing (content-type check,
 * UUID filename, {@code Files.createDirectories}/{@code Files.copy}) lives in {@link
 * #upload(MultipartFile, Map)}; {@link #upload(MultipartFile)} is now a thin delegate to it using
 * {@link #ALLOWED_CONTENT_TYPES}, preserving its own behavior byte-for-byte for every existing
 * image-upload caller.
 */
@Service
public class MediaServiceImpl implements MediaService {

    private static final Map<String, String> ALLOWED_CONTENT_TYPES =
            Map.of("image/png", ".png", "image/jpeg", ".jpg", "image/webp", ".webp");

    private final String storagePath;

    public MediaServiceImpl(@Value("${app.media.storage-path}") String storagePath) {
        this.storagePath = storagePath;
    }

    @Override
    public MediaUploadResponse upload(MultipartFile file) {
        return upload(file, ALLOWED_CONTENT_TYPES);
    }

    @Override
    public MediaUploadResponse upload(MultipartFile file, Map<String, String> allowedContentTypes) {
        String contentType = file.getContentType();
        String extension = contentType == null ? null : allowedContentTypes.get(contentType);
        if (extension == null) {
            throw new UnsupportedMediaTypeException("Unsupported media type: " + contentType);
        }

        String filename = UUID.randomUUID() + extension;
        Path directory = Path.of(storagePath);
        Path target = directory.resolve(filename);

        try {
            Files.createDirectories(directory);
            Files.copy(file.getInputStream(), target);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to store uploaded media file", e);
        }

        return new MediaUploadResponse("/media/" + filename);
    }
}
