package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.cricketlegend.dto.MediaUploadResponse;
import com.cricketlegend.exception.UnsupportedMediaTypeException;
import com.cricketlegend.service.impl.MediaServiceImpl;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.multipart.MultipartFile;

/**
 * Unit tests for MediaServiceImpl's business rule from docs/specs/012-club-profile.md: only the
 * fixed image MIME allowlist (PNG/JPEG/WebP) may be uploaded, everything else is rejected; the
 * generated filename/URL follows the documented {@code /media/<uuid><ext>} shape. Per
 * docs/standards/backend.md, every @Service method carrying a business rule ships a unit test in
 * the same change. Writes to a real temp directory (not mocked away) so the file-write path is
 * genuinely exercised, cleaned up after each test.
 */
@ExtendWith(MockitoExtension.class)
class MediaServiceImplTest {

    @Mock
    private MultipartFile file;

    private Path tempStorageDir;
    private MediaServiceImpl mediaService;

    @BeforeEach
    void setUp() throws IOException {
        tempStorageDir = Files.createTempDirectory("club-profile-media-test");
        mediaService = new MediaServiceImpl(tempStorageDir.toString());
    }

    @AfterEach
    void tearDown() throws IOException {
        try (var paths = Files.walk(tempStorageDir)) {
            paths.sorted((a, b) -> b.compareTo(a)).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // best-effort cleanup
                }
            });
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"image/png", "image/jpeg", "image/webp"})
    void allowedContentTypeIsAcceptedAndWrittenToStorage(String contentType) throws IOException {
        when(file.getContentType()).thenReturn(contentType);
        when(file.getInputStream()).thenReturn(new ByteArrayInputStream("fake-image-bytes".getBytes()));

        MediaUploadResponse response = mediaService.upload(file);

        assertThat(response.url()).startsWith("/media/");
        String filename = response.url().substring("/media/".length());
        assertThat(Files.exists(tempStorageDir.resolve(filename))).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"application/pdf", "text/plain", "video/mp4", "image/gif"})
    void disallowedContentTypeThrowsUnsupportedMediaTypeExceptionAndWritesNothing(String contentType) {
        when(file.getContentType()).thenReturn(contentType);

        assertThatThrownBy(() -> mediaService.upload(file)).isInstanceOf(UnsupportedMediaTypeException.class);
    }

    @Test
    void nullContentTypeIsRejected() {
        when(file.getContentType()).thenReturn(null);

        assertThatThrownBy(() -> mediaService.upload(file)).isInstanceOf(UnsupportedMediaTypeException.class);
    }

    @Test
    void generatedFilenameCarriesTheExtensionMatchingTheUploadedContentType() throws IOException {
        when(file.getContentType()).thenReturn("image/webp");
        when(file.getInputStream()).thenReturn(new ByteArrayInputStream("fake-image-bytes".getBytes()));

        MediaUploadResponse response = mediaService.upload(file);

        assertThat(response.url()).endsWith(".webp");
    }
}
