package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.ClubPlayingArea;
import com.cricketlegend.domain.PlayingArea;
import com.cricketlegend.domain.PlayingAreaCategory;
import com.cricketlegend.domain.PlayingAreaOwnerType;
import com.cricketlegend.domain.PlayingAreaType;
import com.cricketlegend.domain.PlayingAreaVerificationStatus;
import com.cricketlegend.dto.AddressDto;
import com.cricketlegend.dto.PlayingAreaDto;
import com.cricketlegend.dto.PlayingAreaRequest;
import com.cricketlegend.exception.DuplicateFieldException;
import com.cricketlegend.exception.FieldNotEditableException;
import com.cricketlegend.exception.FieldRejectedException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.PlayingAreaMapperImpl;
import com.cricketlegend.repository.ClubPlayingAreaRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayingAreaRepository;
import com.cricketlegend.service.impl.PlayingAreaServiceImpl;
import com.cricketlegend.service.support.PlayingAreaMatchResolver;
import com.cricketlegend.service.support.PlayingAreaWriter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

/**
 * Unit tests for the club-scoped rules of {@link PlayingAreaServiceImpl} from docs/specs/099-fields-directory.md:
 * area type forced, home link only when {@code linkHome} is true (never automatic), edit only by the creating club
 * while unverified, rejected field cannot be linked, home links never duplicate.
 */
@ExtendWith(MockitoExtension.class)
class PlayingAreaServiceImplTest {

    private static final UUID CLUB = UUID.randomUUID();
    private static final UUID OTHER_CLUB = UUID.randomUUID();

    @Mock
    private PlayingAreaRepository playingAreaRepository;

    @Mock
    private ClubPlayingAreaRepository clubPlayingAreaRepository;

    @Mock
    private ClubRepository clubRepository;

    @Mock
    private MatchRepository matchRepository;

    private PlayingAreaServiceImpl service;

    @BeforeEach
    void setUp() {
        PlayingAreaMapperImpl mapper = new PlayingAreaMapperImpl();
        service = new PlayingAreaServiceImpl(
                playingAreaRepository,
                clubPlayingAreaRepository,
                clubRepository,
                matchRepository,
                mapper,
                new PlayingAreaWriter(playingAreaRepository, mapper),
                new PlayingAreaMatchResolver(playingAreaRepository));
    }

    private static PlayingAreaRequest request(String name) {
        return new PlayingAreaRequest(
                name,
                PlayingAreaCategory.MUNICIPAL,
                PlayingAreaOwnerType.OTHER,
                "City Council",
                new AddressDto(null, null, "Pretoria", null, "ZA", null),
                null,
                null);
    }

    private PlayingArea stored(UUID createdBy, PlayingAreaVerificationStatus status) {
        PlayingArea area = PlayingArea.builder()
                .id(UUID.randomUUID())
                .areaType(PlayingAreaType.CRICKET_FIELD)
                .name("Old Name")
                .category(PlayingAreaCategory.CLUB)
                .ownerType(PlayingAreaOwnerType.CLUB)
                .ownerName("Owner")
                .verificationStatus(status)
                .createdByClubId(createdBy)
                .build();
        when(playingAreaRepository.findById(area.getId())).thenReturn(Optional.of(area));
        return area;
    }

    private void saveReturnsArgumentWithId() {
        when(playingAreaRepository.save(any(PlayingArea.class))).thenAnswer(inv -> {
            PlayingArea a = inv.getArgument(0);
            if (a.getId() == null) {
                a.setId(UUID.randomUUID());
            }
            return a;
        });
    }

    @Test
    void createForcesCricketFieldUnverifiedAndRecordsTheCreatingClub() {
        when(clubRepository.existsById(CLUB)).thenReturn(true);
        saveReturnsArgumentWithId();

        PlayingAreaDto dto = service.create(CLUB, request("Centurion Oval"), false);

        ArgumentCaptor<PlayingArea> saved = ArgumentCaptor.forClass(PlayingArea.class);
        verify(playingAreaRepository).save(saved.capture());
        assertThat(saved.getValue().getAreaType()).isEqualTo(PlayingAreaType.CRICKET_FIELD);
        assertThat(saved.getValue().getVerificationStatus()).isEqualTo(PlayingAreaVerificationStatus.UNVERIFIED);
        assertThat(saved.getValue().getCreatedByClubId()).isEqualTo(CLUB);
        assertThat(dto.verificationStatus()).isEqualTo(PlayingAreaVerificationStatus.UNVERIFIED);
    }

    @Test
    void createDoesNotLinkTheClubUnlessLinkHomeIsTrue() {
        when(clubRepository.existsById(CLUB)).thenReturn(true);
        saveReturnsArgumentWithId();

        PlayingAreaDto dto = service.create(CLUB, request("Centurion Oval"), false);

        verify(clubPlayingAreaRepository, never()).save(any());
        assertThat(dto.linkedHome()).isFalse();
    }

    @Test
    void createLinksTheClubAsHomeWhenLinkHomeIsTrue() {
        when(clubRepository.existsById(CLUB)).thenReturn(true);
        saveReturnsArgumentWithId();

        service.create(CLUB, request("Centurion Oval"), true);

        ArgumentCaptor<ClubPlayingArea> link = ArgumentCaptor.forClass(ClubPlayingArea.class);
        verify(clubPlayingAreaRepository).save(link.capture());
        assertThat(link.getValue().getClubId()).isEqualTo(CLUB);
        assertThat(link.getValue().isHome()).isTrue();
    }

    @Test
    void createForAnUnknownClubIsNotFound() {
        when(clubRepository.existsById(CLUB)).thenReturn(false);

        assertThatThrownBy(() -> service.create(CLUB, request("X"), true)).isInstanceOf(NotFoundException.class);
        verify(playingAreaRepository, never()).save(any());
    }

    @Test
    void createRefusesAnExactDuplicateWithTheExistingId() {
        when(clubRepository.existsById(CLUB)).thenReturn(true);
        PlayingArea existing = PlayingArea.builder().id(UUID.randomUUID()).name("Centurion Oval").build();
        when(playingAreaRepository.findByIdentity(any(), any(), any(), any())).thenReturn(List.of(existing));

        assertThatThrownBy(() -> service.create(CLUB, request("Centurion Oval"), true))
                .isInstanceOfSatisfying(DuplicateFieldException.class,
                        ex -> assertThat(ex.getExistingPlayingAreaId()).isEqualTo(existing.getId()));
        verify(playingAreaRepository, never()).save(any());
    }

    @Test
    void creatorClubCanEditAnUnverifiedField() {
        PlayingArea area = stored(CLUB, PlayingAreaVerificationStatus.UNVERIFIED);
        saveReturnsArgumentWithId();

        PlayingAreaDto dto = service.update(CLUB, area.getId(), request("New Name"));

        assertThat(dto.name()).isEqualTo("New Name");
        assertThat(area.getCategory()).isEqualTo(PlayingAreaCategory.MUNICIPAL);
    }

    @Test
    void anotherClubCannotEditAnUnverifiedField() {
        PlayingArea area = stored(CLUB, PlayingAreaVerificationStatus.UNVERIFIED);

        assertThatThrownBy(() -> service.update(OTHER_CLUB, area.getId(), request("New Name")))
                .isInstanceOf(FieldNotEditableException.class);
        verify(playingAreaRepository, never()).save(any());
    }

    @Test
    void creatorCannotEditAVerifiedField() {
        PlayingArea area = stored(CLUB, PlayingAreaVerificationStatus.VERIFIED);

        assertThatThrownBy(() -> service.update(CLUB, area.getId(), request("New Name")))
                .isInstanceOf(FieldNotEditableException.class);
    }

    @Test
    void creatorCannotEditARejectedField() {
        PlayingArea area = stored(CLUB, PlayingAreaVerificationStatus.REJECTED);

        assertThatThrownBy(() -> service.update(CLUB, area.getId(), request("New Name")))
                .isInstanceOf(FieldNotEditableException.class);
    }

    @Test
    void creatorCannotEditAMergedAwayField() {
        PlayingArea area = stored(CLUB, PlayingAreaVerificationStatus.UNVERIFIED);
        area.setMergedIntoId(UUID.randomUUID());

        assertThatThrownBy(() -> service.update(CLUB, area.getId(), request("New Name")))
                .isInstanceOf(FieldNotEditableException.class);
    }

    @Test
    void updateOfAnUnknownFieldIsNotFound() {
        UUID id = UUID.randomUUID();
        when(playingAreaRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(CLUB, id, request("X"))).isInstanceOf(NotFoundException.class);
    }

    @Test
    void linkHomeCreatesANewHomeLink() {
        when(clubRepository.existsById(CLUB)).thenReturn(true);
        PlayingArea area = stored(OTHER_CLUB, PlayingAreaVerificationStatus.VERIFIED);
        when(clubPlayingAreaRepository.findByClubIdAndPlayingAreaId(CLUB, area.getId())).thenReturn(Optional.empty());

        service.linkHome(CLUB, area.getId());

        ArgumentCaptor<ClubPlayingArea> link = ArgumentCaptor.forClass(ClubPlayingArea.class);
        verify(clubPlayingAreaRepository).save(link.capture());
        assertThat(link.getValue().getPlayingAreaId()).isEqualTo(area.getId());
        assertThat(link.getValue().isHome()).isTrue();
    }

    @Test
    void linkHomeReusesAnExistingLinkInsteadOfDuplicatingIt() {
        when(clubRepository.existsById(CLUB)).thenReturn(true);
        PlayingArea area = stored(OTHER_CLUB, PlayingAreaVerificationStatus.VERIFIED);
        ClubPlayingArea existing = ClubPlayingArea.builder().clubId(CLUB).playingAreaId(area.getId()).home(false).build();
        when(clubPlayingAreaRepository.findByClubIdAndPlayingAreaId(CLUB, area.getId())).thenReturn(Optional.of(existing));

        service.linkHome(CLUB, area.getId());

        ArgumentCaptor<ClubPlayingArea> link = ArgumentCaptor.forClass(ClubPlayingArea.class);
        verify(clubPlayingAreaRepository).save(link.capture());
        assertThat(link.getValue()).isSameAs(existing);
        assertThat(existing.isHome()).isTrue();
    }

    @Test
    void linkHomeOfARejectedFieldIsRefused() {
        when(clubRepository.existsById(CLUB)).thenReturn(true);
        PlayingArea area = stored(OTHER_CLUB, PlayingAreaVerificationStatus.REJECTED);

        assertThatThrownBy(() -> service.linkHome(CLUB, area.getId())).isInstanceOf(FieldRejectedException.class);
        verify(clubPlayingAreaRepository, never()).save(any());
    }

    @Test
    void linkHomeFollowsAMergedFieldToItsTarget() {
        when(clubRepository.existsById(CLUB)).thenReturn(true);
        PlayingArea target = stored(OTHER_CLUB, PlayingAreaVerificationStatus.VERIFIED);
        PlayingArea merged = stored(OTHER_CLUB, PlayingAreaVerificationStatus.UNVERIFIED);
        merged.setMergedIntoId(target.getId());
        when(clubPlayingAreaRepository.findByClubIdAndPlayingAreaId(CLUB, target.getId())).thenReturn(Optional.empty());

        service.linkHome(CLUB, merged.getId());

        ArgumentCaptor<ClubPlayingArea> link = ArgumentCaptor.forClass(ClubPlayingArea.class);
        verify(clubPlayingAreaRepository).save(link.capture());
        assertThat(link.getValue().getPlayingAreaId()).isEqualTo(target.getId());
    }

    @Test
    void unlinkHomeDeletesTheLinkWhenPresentAndIsANoOpOtherwise() {
        PlayingArea area = stored(OTHER_CLUB, PlayingAreaVerificationStatus.VERIFIED);
        ClubPlayingArea link = ClubPlayingArea.builder().clubId(CLUB).playingAreaId(area.getId()).home(true).build();
        when(clubPlayingAreaRepository.findByClubIdAndPlayingAreaId(CLUB, area.getId())).thenReturn(Optional.of(link));

        service.unlinkHome(CLUB, area.getId());

        verify(clubPlayingAreaRepository).delete(link);
    }

    @Test
    void unlinkHomeWithoutALinkDeletesNothing() {
        PlayingArea area = stored(OTHER_CLUB, PlayingAreaVerificationStatus.VERIFIED);
        when(clubPlayingAreaRepository.findByClubIdAndPlayingAreaId(CLUB, area.getId())).thenReturn(Optional.empty());

        service.unlinkHome(CLUB, area.getId());

        verify(clubPlayingAreaRepository, never()).delete(any());
    }

    @Test
    void listRefusesARejectedVerificationFilter() {
        assertThatThrownBy(() -> service.list(
                        CLUB, null, null, null, null, null, null, PlayingAreaVerificationStatus.REJECTED, false,
                        PageRequest.of(0, 10)))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void similarWithoutACountryOrNameReturnsNothingWithoutQuerying() {
        assertThat(service.similar(CLUB, "Oval", "Pretoria", null)).isEmpty();
        assertThat(service.similar(CLUB, "  !! ", "Pretoria", "ZA")).isEmpty();
        verify(playingAreaRepository, never()).findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class));
    }
}
