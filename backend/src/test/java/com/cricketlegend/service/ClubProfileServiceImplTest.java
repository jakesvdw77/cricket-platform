package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Address;
import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.domain.ClubProfileType;
import com.cricketlegend.dto.AddressDto;
import com.cricketlegend.dto.ClubProfileDto;
import com.cricketlegend.dto.UpdateClubProfileRequest;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.ClubProfileMapper;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.impl.ClubProfileServiceImpl;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for ClubProfileServiceImpl's business rules from docs/specs/012-club-profile.md:
 * {@code get} returns a default-shaped DTO (no 404) when a Club has no profile row yet vs. the
 * real row when one does, and throws NotFoundException only when the Club itself doesn't exist;
 * {@code upsert} creates on first save vs. updates in place on the second, and applies a
 * full-resource replace (an omitted/null field nulls out a previously-saved value). Per
 * docs/standards/backend.md, every @Service method carrying a business rule ships a unit test in
 * the same change.
 */
@ExtendWith(MockitoExtension.class)
class ClubProfileServiceImplTest {

    @Mock
    private ClubRepository clubRepository;

    @Mock
    private ClubProfileRepository clubProfileRepository;

    @Mock
    private ClubProfileMapper clubProfileMapper;

    private ClubProfileServiceImpl clubProfileService;

    @BeforeEach
    void setUp() {
        clubProfileService = new ClubProfileServiceImpl(clubRepository, clubProfileRepository, clubProfileMapper);
    }

    @Test
    void getOnClubWithNoProfileRowReturnsDefaultShapedDtoRatherThanThrowing() {
        UUID clubId = UUID.randomUUID();
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.empty());

        ClubProfileDto result = clubProfileService.get(clubId);

        assertThat(result.clubId()).isEqualTo(clubId);
        assertThat(result.type()).isNull();
        assertThat(result.logoUrl()).isNull();
        assertThat(result.bannerUrl()).isNull();
        assertThat(result.address()).isNull();
        assertThat(result.email()).isNull();
        assertThat(result.phone()).isNull();
        assertThat(result.website()).isNull();
    }

    @Test
    void getOnClubWithExistingProfileRowReturnsTheMappedRow() {
        UUID clubId = UUID.randomUUID();
        ClubProfile existing = ClubProfile.builder().clubId(clubId).type(ClubProfileType.CLUB).build();
        ClubProfileDto mapped = dummyDto(clubId);
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.of(existing));
        when(clubProfileMapper.toDto(existing)).thenReturn(mapped);

        ClubProfileDto result = clubProfileService.get(clubId);

        assertThat(result).isEqualTo(mapped);
    }

    @Test
    void getOnNonexistentClubThrowsNotFoundExceptionAndNeverTouchesProfileRepository() {
        UUID clubId = UUID.randomUUID();
        when(clubRepository.existsById(clubId)).thenReturn(false);

        assertThatThrownBy(() -> clubProfileService.get(clubId)).isInstanceOf(NotFoundException.class);

        verify(clubProfileRepository, never()).findById(any());
    }

    @Test
    void upsertOnNonexistentClubThrowsNotFoundExceptionAndNeverSaves() {
        UUID clubId = UUID.randomUUID();
        when(clubRepository.existsById(clubId)).thenReturn(false);
        UpdateClubProfileRequest request = new UpdateClubProfileRequest(
                ClubProfileType.CLUB, null, null, null, null, null, null);

        assertThatThrownBy(() -> clubProfileService.upsert(clubId, request)).isInstanceOf(NotFoundException.class);

        verify(clubProfileRepository, never()).save(any());
    }

    @Test
    void upsertWithNoExistingRowCreatesANewProfileWithClubIdSet() {
        UUID clubId = UUID.randomUUID();
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.empty());
        ArgumentCaptor<ClubProfile> captor = ArgumentCaptor.forClass(ClubProfile.class);
        when(clubProfileRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(clubProfileMapper.toDto(any(ClubProfile.class))).thenReturn(dummyDto(clubId));

        UpdateClubProfileRequest request = new UpdateClubProfileRequest(
                ClubProfileType.ACADEMY, "logo.png", "banner.png",
                new AddressDto("1", "Main St", "Riverside", "Gauteng", "South Africa", "0001"),
                "club@example.com", "0123456789", "https://example.com");

        clubProfileService.upsert(clubId, request);

        ClubProfile saved = captor.getValue();
        assertThat(saved.getClubId()).isEqualTo(clubId);
        assertThat(saved.getType()).isEqualTo(ClubProfileType.ACADEMY);
        assertThat(saved.getLogoUrl()).isEqualTo("logo.png");
        assertThat(saved.getBannerUrl()).isEqualTo("banner.png");
        assertThat(saved.getAddress().getCity()).isEqualTo("Riverside");
        assertThat(saved.getEmail()).isEqualTo("club@example.com");
        assertThat(saved.getPhone()).isEqualTo("0123456789");
        assertThat(saved.getWebsite()).isEqualTo("https://example.com");
    }

    @Test
    void upsertWithExistingRowUpdatesInPlaceRatherThanCreatingASecondRow() {
        UUID clubId = UUID.randomUUID();
        ClubProfile existing = ClubProfile.builder()
                .clubId(clubId)
                .type(ClubProfileType.CLUB)
                .email("old@example.com")
                .build();
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.of(existing));
        when(clubProfileRepository.save(existing)).thenReturn(existing);
        when(clubProfileMapper.toDto(existing)).thenReturn(dummyDto(clubId));

        UpdateClubProfileRequest request = new UpdateClubProfileRequest(
                ClubProfileType.SCHOOL, null, null, null, "new@example.com", null, null);

        clubProfileService.upsert(clubId, request);

        assertThat(existing.getType()).isEqualTo(ClubProfileType.SCHOOL);
        assertThat(existing.getEmail()).isEqualTo("new@example.com");
        verify(clubProfileRepository).save(existing);
    }

    @Test
    void upsertIsAFullReplaceSoAFieldOmittedFromTheRequestNullsOutAPreviouslySavedValue() {
        UUID clubId = UUID.randomUUID();
        ClubProfile existing = ClubProfile.builder()
                .clubId(clubId)
                .type(ClubProfileType.CLUB)
                .logoUrl("old-logo.png")
                .email("old@example.com")
                .phone("0123456789")
                .website("https://old.example.com")
                .address(Address.builder().city("Old City").build())
                .build();
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.of(existing));
        when(clubProfileRepository.save(existing)).thenReturn(existing);
        when(clubProfileMapper.toDto(existing)).thenReturn(dummyDto(clubId));

        // Second save omits every field except type — per Flag #4, this nulls them all out
        // rather than leaving the previous values in place.
        UpdateClubProfileRequest request = new UpdateClubProfileRequest(
                ClubProfileType.CLUB, null, null, null, null, null, null);

        clubProfileService.upsert(clubId, request);

        assertThat(existing.getLogoUrl()).isNull();
        assertThat(existing.getEmail()).isNull();
        assertThat(existing.getPhone()).isNull();
        assertThat(existing.getWebsite()).isNull();
        assertThat(existing.getAddress()).isNull();
    }

    private ClubProfileDto dummyDto(UUID clubId) {
        return new ClubProfileDto(clubId, null, null, null, null, null, null, null, null, null, null);
    }
}
