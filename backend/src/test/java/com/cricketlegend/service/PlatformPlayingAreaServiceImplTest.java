package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
import com.cricketlegend.dto.PlayingAreaRequest;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.FieldNotEditableException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.PlayingAreaMapperImpl;
import com.cricketlegend.repository.ClubPlayingAreaRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayingAreaRepository;
import com.cricketlegend.service.impl.PlatformPlayingAreaServiceImpl;
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

/**
 * Unit tests for the moderation rules of {@link PlatformPlayingAreaServiceImpl} (docs/specs/099-fields-directory.md):
 * verify / reject / reopen transitions and the invalid ones, reject needs a reason, platform edit, and merge target
 * validity, link de-duplication and home-stays-home.
 */
@ExtendWith(MockitoExtension.class)
class PlatformPlayingAreaServiceImplTest {

    @Mock
    private PlayingAreaRepository playingAreaRepository;

    @Mock
    private ClubPlayingAreaRepository clubPlayingAreaRepository;

    @Mock
    private ClubRepository clubRepository;

    @Mock
    private MatchRepository matchRepository;

    private PlatformPlayingAreaServiceImpl service;

    @BeforeEach
    void setUp() {
        PlayingAreaMapperImpl mapper = new PlayingAreaMapperImpl();
        service = new PlatformPlayingAreaServiceImpl(
                playingAreaRepository,
                clubPlayingAreaRepository,
                clubRepository,
                matchRepository,
                mapper,
                new PlayingAreaWriter(playingAreaRepository, mapper));
    }

    private PlayingArea stored(PlayingAreaVerificationStatus status) {
        PlayingArea area = PlayingArea.builder()
                .id(UUID.randomUUID())
                .areaType(PlayingAreaType.CRICKET_FIELD)
                .name("Field")
                .category(PlayingAreaCategory.CLUB)
                .ownerType(PlayingAreaOwnerType.CLUB)
                .ownerName("Owner")
                .verificationStatus(status)
                .build();
        when(playingAreaRepository.findById(area.getId())).thenReturn(Optional.of(area));
        lenient(area);
        return area;
    }

    private void lenient(PlayingArea area) {
        org.mockito.Mockito.lenient().when(playingAreaRepository.save(area)).thenReturn(area);
    }

    @Test
    void verifyMovesUnverifiedToVerifiedAndRecordsWho() {
        PlayingArea area = stored(PlayingAreaVerificationStatus.UNVERIFIED);
        area.setRejectionReason("stale");

        service.verify(area.getId(), "admin-sub");

        assertThat(area.getVerificationStatus()).isEqualTo(PlayingAreaVerificationStatus.VERIFIED);
        assertThat(area.getVerifiedBySubject()).isEqualTo("admin-sub");
        assertThat(area.getVerifiedAt()).isNotNull();
        assertThat(area.getRejectionReason()).isNull();
    }

    @Test
    void verifyOfAnAlreadyVerifiedFieldIsIdempotent() {
        PlayingArea area = stored(PlayingAreaVerificationStatus.VERIFIED);

        service.verify(area.getId(), "admin-sub");

        verify(playingAreaRepository, never()).save(any());
    }

    @Test
    void verifyOfARejectedFieldIsRefusedUntilReopened() {
        PlayingArea area = stored(PlayingAreaVerificationStatus.REJECTED);

        assertThatThrownBy(() -> service.verify(area.getId(), "admin-sub"))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void verifyOfAMergedAwayFieldIsRefused() {
        PlayingArea area = stored(PlayingAreaVerificationStatus.UNVERIFIED);
        area.setMergedIntoId(UUID.randomUUID());

        assertThatThrownBy(() -> service.verify(area.getId(), "admin-sub"))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void rejectStoresTheTrimmedReason() {
        PlayingArea area = stored(PlayingAreaVerificationStatus.UNVERIFIED);

        service.reject(area.getId(), "  Not a cricket field ");

        assertThat(area.getVerificationStatus()).isEqualTo(PlayingAreaVerificationStatus.REJECTED);
        assertThat(area.getRejectionReason()).isEqualTo("Not a cricket field");
    }

    @Test
    void rejectRequiresAReason() {
        UUID id = UUID.randomUUID();
        assertThatThrownBy(() -> service.reject(id, null)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.reject(id, "   ")).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.reject(id, "x".repeat(501))).isInstanceOf(ValidationException.class);
        verify(playingAreaRepository, never()).findById(any());
    }

    @Test
    void onlyAnUnverifiedFieldCanBeRejected() {
        PlayingArea verified = stored(PlayingAreaVerificationStatus.VERIFIED);
        PlayingArea rejected = stored(PlayingAreaVerificationStatus.REJECTED);

        assertThatThrownBy(() -> service.reject(verified.getId(), "no"))
                .isInstanceOf(InvalidStatusTransitionException.class);
        assertThatThrownBy(() -> service.reject(rejected.getId(), "no"))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void reopenMovesRejectedBackToUnverifiedAndClearsTheReason() {
        PlayingArea area = stored(PlayingAreaVerificationStatus.REJECTED);
        area.setRejectionReason("no");

        service.reopen(area.getId());

        assertThat(area.getVerificationStatus()).isEqualTo(PlayingAreaVerificationStatus.UNVERIFIED);
        assertThat(area.getRejectionReason()).isNull();
    }

    @Test
    void onlyARejectedFieldCanBeReopened() {
        PlayingArea unverified = stored(PlayingAreaVerificationStatus.UNVERIFIED);
        PlayingArea verified = stored(PlayingAreaVerificationStatus.VERIFIED);

        assertThatThrownBy(() -> service.reopen(unverified.getId())).isInstanceOf(InvalidStatusTransitionException.class);
        assertThatThrownBy(() -> service.reopen(verified.getId())).isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void platformCanEditAVerifiedFieldButNotAMergedAwayOne() {
        PlayingArea verified = stored(PlayingAreaVerificationStatus.VERIFIED);
        PlayingArea merged = stored(PlayingAreaVerificationStatus.UNVERIFIED);
        merged.setMergedIntoId(UUID.randomUUID());
        PlayingAreaRequest request = new PlayingAreaRequest(
                "Renamed", PlayingAreaCategory.SCHOOL, PlayingAreaOwnerType.SCHOOL, "School",
                new AddressDto(null, null, "Cape Town", null, "ZA", null), null, null);

        org.mockito.Mockito.lenient()
                .when(playingAreaRepository.findAll(
                        any(org.springframework.data.jpa.domain.Specification.class),
                        any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(org.springframework.data.domain.Page.empty());

        service.update(verified.getId(), request);

        assertThat(verified.getName()).isEqualTo("Renamed");
        assertThatThrownBy(() -> service.update(merged.getId(), request)).isInstanceOf(FieldNotEditableException.class);
    }

    @Test
    void mergeIntoItselfIsRefused() {
        UUID id = UUID.randomUUID();
        assertThatThrownBy(() -> service.merge(id, id)).isInstanceOf(ConflictException.class);
    }

    @Test
    void mergeRefusesAMergedAwaySourceTargetAndARejectedTarget() {
        PlayingArea source = stored(PlayingAreaVerificationStatus.UNVERIFIED);
        PlayingArea mergedTarget = stored(PlayingAreaVerificationStatus.VERIFIED);
        mergedTarget.setMergedIntoId(UUID.randomUUID());
        PlayingArea rejectedTarget = stored(PlayingAreaVerificationStatus.REJECTED);

        assertThatThrownBy(() -> service.merge(source.getId(), mergedTarget.getId())).isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.merge(source.getId(), rejectedTarget.getId())).isInstanceOf(ConflictException.class);

        PlayingArea okTarget = stored(PlayingAreaVerificationStatus.VERIFIED);
        source.setMergedIntoId(UUID.randomUUID());
        assertThatThrownBy(() -> service.merge(source.getId(), okTarget.getId())).isInstanceOf(ConflictException.class);
        verify(matchRepository, never()).repointPlayingArea(any(), any(), any(), any());
    }

    @Test
    void mergeToAnUnknownTargetIsNotFound() {
        PlayingArea source = stored(PlayingAreaVerificationStatus.UNVERIFIED);
        UUID missing = UUID.randomUUID();
        when(playingAreaRepository.findById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.merge(source.getId(), missing)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void mergeRepointsMatchesMovesUnsharedLinksAndDeDuplicatesSharedOnes() {
        PlayingArea source = stored(PlayingAreaVerificationStatus.UNVERIFIED);
        PlayingArea target = stored(PlayingAreaVerificationStatus.VERIFIED);
        target.setName("Target Name");
        UUID onlySourceClub = UUID.randomUUID();
        UUID sharedClub = UUID.randomUUID();
        ClubPlayingArea sourceOnly = link(onlySourceClub, source.getId(), true);
        ClubPlayingArea sourceShared = link(sharedClub, source.getId(), false);
        ClubPlayingArea targetShared = link(sharedClub, target.getId(), false);
        when(clubPlayingAreaRepository.findByPlayingAreaId(target.getId())).thenReturn(List.of(targetShared));
        when(clubPlayingAreaRepository.findByPlayingAreaId(source.getId())).thenReturn(List.of(sourceOnly, sourceShared));

        service.merge(source.getId(), target.getId());

        verify(matchRepository).repointPlayingArea(eq(source.getId()), eq(target.getId()), eq("Target Name"), any());
        assertThat(sourceOnly.getPlayingAreaId()).isEqualTo(target.getId());
        verify(clubPlayingAreaRepository).save(sourceOnly);
        verify(clubPlayingAreaRepository).delete(sourceShared);
        verify(clubPlayingAreaRepository, never()).delete(sourceOnly);
        assertThat(source.getMergedIntoId()).isEqualTo(target.getId());
    }

    @Test
    void mergeKeepsHomeWhenOnlyTheSourceLinkWasHome() {
        PlayingArea source = stored(PlayingAreaVerificationStatus.UNVERIFIED);
        PlayingArea target = stored(PlayingAreaVerificationStatus.VERIFIED);
        UUID club = UUID.randomUUID();
        ClubPlayingArea sourceHome = link(club, source.getId(), true);
        ClubPlayingArea targetNotHome = link(club, target.getId(), false);
        when(clubPlayingAreaRepository.findByPlayingAreaId(target.getId())).thenReturn(List.of(targetNotHome));
        when(clubPlayingAreaRepository.findByPlayingAreaId(source.getId())).thenReturn(List.of(sourceHome));

        service.merge(source.getId(), target.getId());

        assertThat(targetNotHome.isHome()).isTrue();
        verify(clubPlayingAreaRepository).save(targetNotHome);
        verify(clubPlayingAreaRepository).delete(sourceHome);
    }

    @Test
    void mergeNeverDowngradesAnExistingHomeTargetLink() {
        PlayingArea source = stored(PlayingAreaVerificationStatus.UNVERIFIED);
        PlayingArea target = stored(PlayingAreaVerificationStatus.VERIFIED);
        UUID club = UUID.randomUUID();
        ClubPlayingArea sourceNotHome = link(club, source.getId(), false);
        ClubPlayingArea targetHome = link(club, target.getId(), true);
        when(clubPlayingAreaRepository.findByPlayingAreaId(target.getId())).thenReturn(List.of(targetHome));
        when(clubPlayingAreaRepository.findByPlayingAreaId(source.getId())).thenReturn(List.of(sourceNotHome));

        service.merge(source.getId(), target.getId());

        assertThat(targetHome.isHome()).isTrue();
        verify(clubPlayingAreaRepository, never()).save(targetHome);
        verify(clubPlayingAreaRepository).delete(sourceNotHome);
    }

    private static ClubPlayingArea link(UUID clubId, UUID areaId, boolean home) {
        return ClubPlayingArea.builder().id(UUID.randomUUID()).clubId(clubId).playingAreaId(areaId).home(home).build();
    }
}
