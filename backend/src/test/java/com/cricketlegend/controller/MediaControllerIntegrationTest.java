package com.cricketlegend.controller;

import static com.cricketlegend.PlatformRoleJwtPostProcessors.platformAdmin;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

/**
 * HTTP-layer integration test for MediaController — per docs/specs/012-club-profile.md's Test
 * Plan and docs/plans/012-club-profile.md's Test tier list: a successful image upload round-trips
 * to a retrievable {@code /media/**} URL, and a non-image upload is rejected with 400. Uses a
 * dedicated temp directory for {@code app.media.storage-path} so it doesn't pollute or depend on
 * any real dev-environment media directory.
 */
@SpringBootTest(properties = "app.media.storage-path=${java.io.tmpdir}/club-profile-media-controller-test")
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MediaControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Value("${app.media.storage-path}")
    private String storagePath;

    @AfterEach
    void cleanUpStorageDirectory() throws Exception {
        Path dir = Path.of(storagePath);
        if (Files.exists(dir)) {
            try (var paths = Files.walk(dir)) {
                paths.sorted((a, b) -> b.compareTo(a)).forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (Exception ignored) {
                        // best-effort cleanup
                    }
                });
            }
        }
    }

    @Test
    void uploadingAnAllowedImageRoundTripsToARetrievableMediaUrl() throws Exception {
        MockMultipartFile file =
                new MockMultipartFile("file", "logo.png", "image/png", "fake-image-bytes".getBytes());

        String responseBody = mockMvc.perform(multipart("/api/v1/platform/media")
                        .file(file)
                        .with(platformAdmin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").exists())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String url = com.jayway.jsonpath.JsonPath.read(responseBody, "$.url");
        assertThat(url).startsWith("/media/");

        mockMvc.perform(get(url)).andExpect(status().isOk());
    }

    @Test
    void uploadingANonImageFileIsRejectedWith400() throws Exception {
        MockMultipartFile file =
                new MockMultipartFile("file", "document.pdf", "application/pdf", "not-an-image".getBytes());

        mockMvc.perform(multipart("/api/v1/platform/media")
                        .file(file)
                        .with(platformAdmin()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadWithoutAuthenticationReturns401() throws Exception {
        MockMultipartFile file =
                new MockMultipartFile("file", "logo.png", "image/png", "fake-image-bytes".getBytes());

        mockMvc.perform(multipart("/api/v1/platform/media").file(file)).andExpect(status().isUnauthorized());
    }
}
