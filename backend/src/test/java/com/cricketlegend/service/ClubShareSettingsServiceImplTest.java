package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.dto.ShareSettingsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.impl.ClubShareSettingsServiceImpl;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Unit tests for docs/specs/114-share-result.md's club share settings rules. */
@ExtendWith(MockitoExtension.class)
class ClubShareSettingsServiceImplTest {

    @Mock
    private ClubRepository clubRepository;

    @Mock
    private ClubProfileRepository clubProfileRepository;

    private ClubShareSettingsServiceImpl service;

    private final UUID clubId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new ClubShareSettingsServiceImpl(clubRepository, clubProfileRepository);
    }

    @Test
    void getReturnsFalseWhenTheClubHasNoProfileRow() {
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.empty());

        assertThat(service.get(clubId).initialsOnlyDefault()).isFalse();
    }

    @Test
    void getReturnsTheStoredFlag() {
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId))
                .thenReturn(Optional.of(ClubProfile.builder().clubId(clubId).shareInitialsOnly(true).build()));

        assertThat(service.get(clubId).initialsOnlyDefault()).isTrue();
    }

    @Test
    void getOnAnUnknownClubIsNotFound() {
        when(clubRepository.existsById(clubId)).thenReturn(false);

        assertThatThrownBy(() -> service.get(clubId)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void putCreatesTheProfileRowWithOnlyTheFlagSet() {
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.empty());
        when(clubProfileRepository.save(any(ClubProfile.class))).thenAnswer(i -> i.getArgument(0));

        ShareSettingsDto result = service.put(clubId, new ShareSettingsDto(true, null), false);

        assertThat(result.initialsOnlyDefault()).isTrue();
        ArgumentCaptor<ClubProfile> saved = ArgumentCaptor.forClass(ClubProfile.class);
        verify(clubProfileRepository).save(saved.capture());
        assertThat(saved.getValue().getClubId()).isEqualTo(clubId);
        assertThat(saved.getValue().isShareInitialsOnly()).isTrue();
        assertThat(saved.getValue().getType()).isNull();
        assertThat(saved.getValue().getEmail()).isNull();
        assertThat(saved.getValue().getAddress()).isNull();
    }

    @Test
    void putUpdatesTheExistingRowAndLeavesTheOtherColumnsAlone() {
        ClubProfile existing = ClubProfile.builder().clubId(clubId).email("hello@club.test").build();
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.of(existing));
        when(clubProfileRepository.save(existing)).thenReturn(existing);

        ShareSettingsDto result = service.put(clubId, new ShareSettingsDto(true, null), false);

        assertThat(result.initialsOnlyDefault()).isTrue();
        assertThat(existing.getEmail()).isEqualTo("hello@club.test");
    }

    @Test
    void putOnAnUnknownClubIsNotFoundAndSavesNothing() {
        when(clubRepository.existsById(clubId)).thenReturn(false);

        assertThatThrownBy(() -> service.put(clubId, new ShareSettingsDto(true, null), false))
                .isInstanceOf(NotFoundException.class);

        verify(clubProfileRepository, never()).save(any());
    }
}
