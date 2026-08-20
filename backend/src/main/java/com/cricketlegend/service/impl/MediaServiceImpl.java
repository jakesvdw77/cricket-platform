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
        String contentType = file.getContentType();
        String extension = contentType == null ? null : ALLOWED_CONTENT_TYPES.get(contentType);
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
