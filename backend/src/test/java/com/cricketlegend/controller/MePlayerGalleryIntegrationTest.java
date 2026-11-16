package com.cricketlegend.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cricketlegend.AbstractIntegrationTest;
import com.cricketlegend.domain.Club;
import com.cricketlegend.domain.Person;
import com.cricketlegend.dto.MediaUploadResponse;
import com.cricketlegend.service.MediaService;
import com.fasterxml.jackson.databind.JsonNode;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.multipart.MultipartFile;

/**
 * docs/specs/157-photo-gallery.md, Integration: who may read, add and delete gallery photos through the Hub
 * ({@code /api/v1/me/players/{playerKey}/gallery}) and the manager ({@code /api/v1/manage/clubs/{clubId}/gallery}), the
 * club boundary, and that a photo is stored and listed end to end. {@code MediaService} is mocked so no file is written.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(AbstractIntegrationTest.class)
class MePlayerGalleryIntegrationTest extends AbstractClubInfoIntegrationTest {

    @MockitoBean private MediaService media;

    private final List<UUID> clubs = new ArrayList<>();

    @AfterEach
    void clean() {
        clubs.forEach(id -> jdbc.update("delete from gallery_image where club_id = ?", id));
        clubs.clear();
    }

    private Club club() {
        Club club = clubWithProfile();
        clubs.add(club.getId());
        when(media.upload(any(MultipartFile.class), any(Map.class)))
                .thenReturn(new MediaUploadResponse("/media/" + UUID.randomUUID() + ".jpg"), new MediaUploadResponse("/media/" + UUID.randomUUID() + ".jpg"))
                .thenReturn(new MediaUploadResponse("/media/" + UUID.randomUUID() + ".jpg"), new MediaUploadResponse("/media/" + UUID.randomUUID() + ".jpg"));
        return club;
    }

    private static byte[] jpeg() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB), "jpg", out);
        return out.toByteArray();
    }

    private org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder upload(String path, Object... vars) throws Exception {
        return multipart(path, vars)
                .file(new MockMultipartFile("medium", "m.jpg", "image/jpeg", jpeg()))
                .file(new MockMultipartFile("thumb", "t.jpg", "image/jpeg", jpeg()));
    }

    private String addAsHub(Own me, String caption) throws Exception {
        String body = mockMvc.perform(upload("/api/v1/me/players/{key}/gallery", me.key()).param("caption", caption).param("tagMyPlayer", "true").with(as(me.person())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mine").value(true))
                .andExpect(jsonPath("$.tags[0].type").value("PLAYER"))
                .andReturn().getResponse().getContentAsString();
        JsonNode json = JSON.readTree(body);
        return json.get("id").asText();
    }

    @Test
    void aPlayerAddsAPhotoSeesItInTheListAndTheLatestAndDeletesIt() throws Exception {
        Club club = club();
        Own me = adultSelf(club);
        String id = addAsHub(me, "Team photo");

        mockMvc.perform(get("/api/v1/me/players/{key}/gallery", me.key()).with(as(me.person())))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].caption").value("Team photo"))
                .andExpect(jsonPath("$.items[0].mine").value(true))
                .andExpect(jsonPath("$.items[0].uploadedByName").doesNotExist());
        mockMvc.perform(get("/api/v1/me/players/{key}/gallery/latest", me.key()).with(as(me.person())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(id));
        mockMvc.perform(get("/api/v1/me/players/{key}/gallery/filters", me.key()).with(as(me.person())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.players[0].name").value("Own Player"));
        mockMvc.perform(get("/api/v1/me/players/{key}/gallery", me.key()).param("q", "own play").with(as(me.person())))
                .andExpect(jsonPath("$.total").value(1));
        mockMvc.perform(get("/api/v1/me/players/{key}/gallery", me.key()).param("q", "nobody").with(as(me.person())))
                .andExpect(jsonPath("$.total").value(0));

        mockMvc.perform(delete("/api/v1/me/players/{key}/gallery/{id}", me.key(), id).with(as(me.person()))).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/me/players/{key}/gallery", me.key()).with(as(me.person()))).andExpect(jsonPath("$.total").value(0));
    }

    @Test
    void aKeyTheCallerDoesNotHoldIsANotFoundAndAnotherClubSeesNothing() throws Exception {
        Club club = club();
        Own me = adultSelf(club);
        addAsHub(me, "Ours");

        Club other = club();
        Own stranger = adultSelf(other);
        mockMvc.perform(get("/api/v1/me/players/{key}/gallery", me.key()).with(as(stranger.person()))).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/me/players/{key}/gallery", stranger.key()).with(as(stranger.person())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));
    }

    @Test
    void aPlayerCannotDeleteAnotherPersonsPhoto() throws Exception {
        Club club = club();
        Own owner = adultSelf(club);
        Own neighbour = adultSelf(club);
        String id = addAsHub(owner, "Not yours");
        mockMvc.perform(delete("/api/v1/me/players/{key}/gallery/{id}", neighbour.key(), id).with(as(neighbour.person()))).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/me/players/{key}/gallery", neighbour.key()).with(as(neighbour.person())))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].mine").value(false));
    }

    @Test
    void aBadPageSizeIsABadRequestAndAFileThatIsNotAJpegIsRefused() throws Exception {
        Club club = club();
        Own me = adultSelf(club);
        mockMvc.perform(get("/api/v1/me/players/{key}/gallery", me.key()).param("size", "49").with(as(me.person()))).andExpect(status().isBadRequest());
        mockMvc.perform(multipart("/api/v1/me/players/{key}/gallery", me.key())
                        .file(new MockMultipartFile("medium", "m.png", "image/png", jpeg()))
                        .file(new MockMultipartFile("thumb", "t.jpg", "image/jpeg", jpeg()))
                        .with(as(me.person())))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aManagerListsWithTheUploaderNameAndDeletesAnyPhotoButAPlayerNeedsAGrantToTouchTheManagerRoutes() throws Exception {
        Club club = club();
        Own me = adultSelf(club);
        String id = addAsHub(me, "A parent's photo");
        Person admin = clubAdmin(club);

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/gallery", club.getId()).with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].uploadedByName").value("Own Player"))
                .andExpect(jsonPath("$.items[0].mine").value(false));
        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/gallery", club.getId()).with(as(me.person()))).andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/manage/clubs/{clubId}/gallery/{id}", club.getId(), id).with(as(me.person()))).andExpect(status().isForbidden());
        mockMvc.perform(upload("/api/v1/manage/clubs/{clubId}/gallery", club.getId()).with(as(admin)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mine").value(true));
        mockMvc.perform(delete("/api/v1/manage/clubs/{clubId}/gallery/{id}", club.getId(), id).with(as(admin))).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/gallery", club.getId()).with(as(admin))).andExpect(jsonPath("$.total").value(1));
    }

    @Test
    void aManagerOfAnotherClubCannotReadOrDeleteThisClubsPhotos() throws Exception {
        Club club = club();
        Own me = adultSelf(club);
        String id = addAsHub(me, "Ours");
        Club other = club();
        Person otherAdmin = clubAdmin(other);

        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/gallery", club.getId()).with(as(otherAdmin))).andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/manage/clubs/{clubId}/gallery/{id}", club.getId(), id).with(as(otherAdmin))).andExpect(status().isForbidden());
        // Through their own club's path, another club's photo id is simply not found.
        mockMvc.perform(delete("/api/v1/manage/clubs/{clubId}/gallery/{id}", other.getId(), id).with(as(otherAdmin))).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/manage/clubs/{clubId}/gallery", other.getId()).with(as(otherAdmin))).andExpect(jsonPath("$.total").value(0));
    }
}
