package com.cricketlegend.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.GalleryImage;
import com.cricketlegend.domain.GalleryImageTag;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.GalleryImageDto;
import com.cricketlegend.dto.GalleryQuery;
import com.cricketlegend.dto.MediaUploadResponse;
import com.cricketlegend.exception.GalleryDailyLimitException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.UnsupportedMediaTypeException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.GalleryImageRepository;
import com.cricketlegend.repository.GalleryImageTagRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MediaService;
import com.cricketlegend.service.support.HeldPlayer;
import com.cricketlegend.service.support.MyPlayerAccess;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.multipart.MultipartFile;

/** docs/specs/157-photo-gallery.md: the upload, tag, limit, delete and paging rules, against mocked collaborators. */
class GalleryServiceImplTest {

    private final UUID clubId = UUID.randomUUID();
    private final UUID caller = UUID.randomUUID();
    private final Authentication auth = new TestingAuthenticationToken("pat", "x");

    private MyPlayerAccess access;
    private MediaService media;
    private GalleryImageRepository images;
    private GalleryImageTagRepository tags;
    private LeagueRepository leagues;
    private TeamRepository teams;
    private PlayerProfileRepository profiles;
    private PersonRepository persons;
    private GalleryServiceImpl service;
    private PlayerProfile held;

    @BeforeEach
    void setUp() {
        access = mock(MyPlayerAccess.class);
        media = mock(MediaService.class);
        images = mock(GalleryImageRepository.class);
        tags = mock(GalleryImageTagRepository.class);
        leagues = mock(LeagueRepository.class);
        teams = mock(TeamRepository.class);
        profiles = mock(PlayerProfileRepository.class);
        persons = mock(PersonRepository.class);
        service = new GalleryServiceImpl(access, media, images, tags, leagues, teams, profiles, persons);

        Person person = new Person();
        person.setId(caller);
        held = new PlayerProfile();
        held.setId(UUID.randomUUID());
        held.setClubId(clubId);
        lenient().when(access.resolve(any(), anyString())).thenReturn(new HeldPlayer("self:x", person, person, held, null));
        lenient().when(media.upload(any(MultipartFile.class), any(Map.class)))
                .thenReturn(new MediaUploadResponse("/media/a.jpg"), new MediaUploadResponse("/media/b.jpg"));
        lenient().when(images.countByUploadedByPersonIdAndUploadedAtAfter(any(), any())).thenReturn(0L);
        lenient().when(images.save(any(GalleryImage.class))).thenAnswer(call -> {
            GalleryImage saved = call.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });
        lenient().when(tags.findByImageIdIn(anyCollection())).thenReturn(List.of());
    }

    private static byte[] jpeg() {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB), "jpg", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] jpeg(int width, int height) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), "jpg", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] png() {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB), "png", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static MockMultipartFile file(String name, String type, byte[] bytes) {
        return new MockMultipartFile(name, name + ".jpg", type, bytes);
    }

    private MockMultipartFile medium() {
        return file("medium", "image/jpeg", jpeg());
    }

    private MockMultipartFile thumb() {
        return file("thumb", "image/jpeg", jpeg());
    }

    private GalleryImageDto addAsManager(UUID leagueId, UUID teamId, List<UUID> players) {
        return service.uploadForClub(clubId, caller, medium(), thumb(), " A nice one ", leagueId, teamId, players);
    }

    // ---- files ----

    @Test
    void refusesAPhotoThatIsNotAJpeg() {
        assertThatThrownBy(() -> service.uploadForClub(clubId, caller, file("medium", "image/png", jpeg()), thumb(), null, null, null, null))
                .isInstanceOf(UnsupportedMediaTypeException.class);
    }

    @Test
    void refusesAFileThatDoesNotDecodeAsAnImage() {
        assertThatThrownBy(() -> service.uploadForClub(clubId, caller, file("medium", "image/jpeg", new byte[] {1, 2, 3}), thumb(), null, null, null, null))
                .isInstanceOf(ValidationException.class).hasMessageContaining("not a readable image");
        verify(media, never()).upload(any(MultipartFile.class), any(Map.class));
    }

    @Test
    void refusesAMediumOverTwoMegabytesAndAThumbnailOver200Kilobytes() {
        byte[] big = new byte[(int) GalleryServiceImpl.MAX_MEDIUM_BYTES + 1];
        assertThatThrownBy(() -> service.uploadForClub(clubId, caller, file("medium", "image/jpeg", big), thumb(), null, null, null, null))
                .isInstanceOf(ValidationException.class).hasMessageContaining("too large");
        byte[] bigThumb = new byte[(int) GalleryServiceImpl.MAX_THUMB_BYTES + 1];
        assertThatThrownBy(() -> service.uploadForClub(clubId, caller, medium(), file("thumb", "image/jpeg", bigThumb), null, null, null, null))
                .isInstanceOf(ValidationException.class).hasMessageContaining("too large");
    }

    @Test
    void refusesAPngSentAsAJpegAndAPhotoWithAHugePixelSize() {
        assertThatThrownBy(() -> service.uploadForClub(clubId, caller, file("medium", "image/jpeg", png()), thumb(), null, null, null, null))
                .isInstanceOf(ValidationException.class).hasMessageContaining("not a readable image");
        byte[] wide = jpeg(GalleryServiceImpl.MAX_MEDIUM_SIDE + 1, 4);
        assertThatThrownBy(() -> service.uploadForClub(clubId, caller, file("medium", "image/jpeg", wide), thumb(), null, null, null, null))
                .isInstanceOf(ValidationException.class).hasMessageContaining("too large");
        byte[] wideThumb = jpeg(GalleryServiceImpl.MAX_THUMB_SIDE + 1, 4);
        assertThatThrownBy(() -> service.uploadForClub(clubId, caller, medium(), file("thumb", "image/jpeg", wideThumb), null, null, null, null))
                .isInstanceOf(ValidationException.class).hasMessageContaining("too large");
        verify(media, never()).upload(any(MultipartFile.class), any(Map.class));
    }

    @Test
    void refusesAMissingFile() {
        assertThatThrownBy(() -> service.uploadForClub(clubId, caller, null, thumb(), null, null, null, null)).isInstanceOf(ValidationException.class);
    }

    // ---- tags and limits ----

    @Test
    void refusesMoreThanFivePlayerTags() {
        List<UUID> six = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            six.add(UUID.randomUUID());
        }
        assertThatThrownBy(() -> addAsManager(null, null, six)).isInstanceOf(ValidationException.class).hasMessageContaining("at most 5");
    }

    @Test
    void aTagOfAnotherClubIsNotFound() {
        UUID leagueId = UUID.randomUUID();
        League elsewhere = new League();
        elsewhere.setId(leagueId);
        elsewhere.setClubId(UUID.randomUUID());
        when(leagues.findById(leagueId)).thenReturn(Optional.of(elsewhere));
        assertThatThrownBy(() -> addAsManager(leagueId, null, null)).isInstanceOf(NotFoundException.class);

        UUID teamId = UUID.randomUUID();
        Team other = new Team();
        other.setId(teamId);
        other.setClubId(UUID.randomUUID());
        when(teams.findById(teamId)).thenReturn(Optional.of(other));
        assertThatThrownBy(() -> addAsManager(null, teamId, null)).isInstanceOf(NotFoundException.class);

        UUID playerId = UUID.randomUUID();
        PlayerProfile stranger = new PlayerProfile();
        stranger.setId(playerId);
        stranger.setClubId(UUID.randomUUID());
        when(profiles.findById(playerId)).thenReturn(Optional.of(stranger));
        assertThatThrownBy(() -> addAsManager(null, null, List.of(playerId))).isInstanceOf(NotFoundException.class);
        verify(media, never()).upload(any(MultipartFile.class), any(Map.class));
    }

    @Test
    void stopsAPersonAfterSixtyPhotosInADay() {
        when(images.countByUploadedByPersonIdAndUploadedAtAfter(eq(caller), any())).thenReturn((long) GalleryServiceImpl.DAILY_LIMIT);
        assertThatThrownBy(() -> addAsManager(null, null, null)).isInstanceOf(GalleryDailyLimitException.class);
        verify(media, never()).upload(any(MultipartFile.class), any(Map.class));
    }

    // ---- storing ----

    @Test
    void storesBothFilesTrimsTheCaptionAndTagsTheLeagueTeamAndPlayers() {
        UUID leagueId = UUID.randomUUID();
        League league = new League();
        league.setId(leagueId);
        league.setClubId(clubId);
        when(leagues.findById(leagueId)).thenReturn(Optional.of(league));
        UUID teamId = UUID.randomUUID();
        Team team = new Team();
        team.setId(teamId);
        team.setClubId(clubId);
        when(teams.findById(teamId)).thenReturn(Optional.of(team));
        UUID playerId = UUID.randomUUID();
        PlayerProfile player = new PlayerProfile();
        player.setId(playerId);
        player.setClubId(clubId);
        when(profiles.findById(playerId)).thenReturn(Optional.of(player));

        GalleryImageDto dto = addAsManager(leagueId, teamId, List.of(playerId));

        ArgumentCaptor<GalleryImage> saved = ArgumentCaptor.forClass(GalleryImage.class);
        verify(images).save(saved.capture());
        assertThat(saved.getValue().getCaption()).isEqualTo("A nice one");
        assertThat(saved.getValue().getClubId()).isEqualTo(clubId);
        assertThat(saved.getValue().getUploadedByPersonId()).isEqualTo(caller);
        assertThat(saved.getValue().getStatus()).isEqualTo(GalleryImage.PUBLISHED);
        assertThat(saved.getValue().getMediumUrl()).isEqualTo("/media/a.jpg");
        assertThat(saved.getValue().getThumbUrl()).isEqualTo("/media/b.jpg");
        ArgumentCaptor<List<GalleryImageTag>> tagged = ArgumentCaptor.forClass(List.class);
        verify(tags).saveAll(tagged.capture());
        assertThat(tagged.getValue()).extracting(GalleryImageTag::getTagType)
                .containsExactly(GalleryImageTag.LEAGUE, GalleryImageTag.TEAM, GalleryImageTag.PLAYER);
        assertThat(dto.mine()).isTrue();
    }

    @Test
    void aSecondFileFailureRemovesTheFirstFile() {
        when(media.upload(any(MultipartFile.class), any(Map.class))).thenReturn(new MediaUploadResponse("/media/a.jpg")).thenThrow(new IllegalStateException("disk full"));
        assertThatThrownBy(() -> addAsManager(null, null, null)).isInstanceOf(IllegalStateException.class);
        verify(media).delete("/media/a.jpg");
        verify(images, never()).save(any(GalleryImage.class));
    }

    @Test
    void removesBothFilesWhenTheRowsCannotBeSaved() {
        when(tags.saveAll(anyCollection())).thenThrow(new IllegalStateException("db down"));
        UUID teamId = UUID.randomUUID();
        Team team = new Team();
        team.setId(teamId);
        team.setClubId(clubId);
        when(teams.findById(teamId)).thenReturn(Optional.of(team));
        assertThatThrownBy(() -> addAsManager(null, teamId, null)).isInstanceOf(IllegalStateException.class);
        verify(media).delete("/media/a.jpg");
        verify(media).delete("/media/b.jpg");
    }

    @Test
    void theHubTagsOnlyTheHeldPlayerWhenAsked() {
        when(profiles.findById(held.getId())).thenReturn(Optional.of(held));
        service.upload(auth, "self:x", medium(), thumb(), null, null, null, true);
        ArgumentCaptor<List<GalleryImageTag>> tagged = ArgumentCaptor.forClass(List.class);
        verify(tags).saveAll(tagged.capture());
        assertThat(tagged.getValue()).hasSize(1);
        assertThat(tagged.getValue().get(0).getTagType()).isEqualTo(GalleryImageTag.PLAYER);
        assertThat(tagged.getValue().get(0).getTagId()).isEqualTo(held.getId());
    }

    // ---- delete ----

    private GalleryImage storedBy(UUID uploader, UUID club) {
        return GalleryImage.builder().id(UUID.randomUUID()).clubId(club).uploadedByPersonId(uploader)
                .mediumUrl("/media/m.jpg").thumbUrl("/media/t.jpg").status(GalleryImage.PUBLISHED).build();
    }

    @Test
    void anUploaderDeletesTheirOwnPhotoAndItsTwoFiles() {
        GalleryImage mine = storedBy(caller, clubId);
        when(images.findById(mine.getId())).thenReturn(Optional.of(mine));
        service.delete(auth, "self:x", mine.getId());
        verify(images).delete(mine);
        verify(media).delete("/media/m.jpg");
        verify(media).delete("/media/t.jpg");
    }

    @Test
    void anUploaderCannotDeleteSomeoneElsesPhotoOrAnotherClubsPhoto() {
        GalleryImage theirs = storedBy(UUID.randomUUID(), clubId);
        when(images.findById(theirs.getId())).thenReturn(Optional.of(theirs));
        assertThatThrownBy(() -> service.delete(auth, "self:x", theirs.getId())).isInstanceOf(NotFoundException.class);
        GalleryImage otherClub = storedBy(caller, UUID.randomUUID());
        when(images.findById(otherClub.getId())).thenReturn(Optional.of(otherClub));
        assertThatThrownBy(() -> service.delete(auth, "self:x", otherClub.getId())).isInstanceOf(NotFoundException.class);
        verify(images, never()).delete(any(GalleryImage.class));
    }

    @Test
    void aManagerDeletesAnyPhotoOfTheirClubButNotAnotherClubs() {
        GalleryImage anyones = storedBy(UUID.randomUUID(), clubId);
        when(images.findById(anyones.getId())).thenReturn(Optional.of(anyones));
        service.deleteForClub(clubId, anyones.getId());
        verify(images).delete(anyones);

        GalleryImage elsewhere = storedBy(UUID.randomUUID(), UUID.randomUUID());
        when(images.findById(elsewhere.getId())).thenReturn(Optional.of(elsewhere));
        assertThatThrownBy(() -> service.deleteForClub(clubId, elsewhere.getId())).isInstanceOf(NotFoundException.class);
    }

    // ---- lists ----

    @Test
    void listRejectsABadPageSizeAndAnOverlongSearch() {
        GalleryQuery none = new GalleryQuery(null, null, null, null);
        assertThatThrownBy(() -> service.list(auth, "self:x", none, -1, 24)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.list(auth, "self:x", none, 0, 49)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.list(auth, "self:x", none, 0, 0)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.list(auth, "self:x", new GalleryQuery("x".repeat(61), null, null, null), 0, 24)).isInstanceOf(ValidationException.class);
    }

    @Test
    void latestIsCappedAtTwelve() {
        assertThatThrownBy(() -> service.latest(auth, "self:x", 13)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.latest(auth, "self:x", 0)).isInstanceOf(ValidationException.class);
        when(images.findByClubIdAndStatusOrderByUploadedAtDescIdDesc(eq(clubId), anyString(), any())).thenReturn(List.of());
        assertThat(service.latest(auth, "self:x", null)).isEmpty();
    }

    @Test
    void aListUsesFixedFilterFlagsSoOneStatementServesEveryFilter() {
        when(images.search(any(), anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), any(), anyBoolean(), anyString(), any()))
                .thenReturn(org.springframework.data.domain.Page.empty());
        service.list(auth, "self:x", new GalleryQuery(" Delta ", null, null, null), null, null);
        verify(images).search(eq(clubId), eq(true), any(), eq(true), any(), eq(true), any(), eq(false), eq("%delta%"), any());
    }
}
