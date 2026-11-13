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
import com.cricketlegend.dto.ClubHubSettingsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.impl.ClubHubSettingsServiceImpl;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Unit tests for docs/specs/148-player-hub-club-info.md's Club info switches. */
@ExtendWith(MockitoExtension.class)
class ClubHubSettingsServiceImplTest {

    @Mock private ClubRepository clubRepository;
    @Mock private ClubProfileRepository clubProfileRepository;

    private ClubHubSettingsServiceImpl service;
    private final UUID clubId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new ClubHubSettingsServiceImpl(clubRepository, clubProfileRepository);
    }

    @Test
    void getWithNoProfileRowReturnsTheDefaults() {
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.empty());

        assertThat(service.get(clubId)).isEqualTo(new ClubHubSettingsDto(true, true, true, true, false, false, false, false));
    }

    @Test
    void getOnAnUnknownClubIsNotFound() {
        when(clubRepository.existsById(clubId)).thenReturn(false);

        assertThatThrownBy(() -> service.get(clubId)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void putOnAnUnknownClubIsNotFound() {
        when(clubRepository.existsById(clubId)).thenReturn(false);

        assertThatThrownBy(() -> service.put(clubId, new ClubHubSettingsDto(true, true, true, true, false, false, false, false)))
                .isInstanceOf(NotFoundException.class);
        verify(clubProfileRepository, never()).save(any());
    }

    @Test
    void directoryPhoneOnWhileTheDirectoryIsOffIsRejected() {
        when(clubRepository.existsById(clubId)).thenReturn(true);

        assertThatThrownBy(() -> service.put(clubId, new ClubHubSettingsDto(true, true, true, true, false, false, true, false)))
                .isInstanceOf(ValidationException.class);
        verify(clubProfileRepository, never()).save(any());
    }

    @Test
    void directoryEmailOnWhileTheDirectoryIsOffIsRejected() {
        when(clubRepository.existsById(clubId)).thenReturn(true);

        assertThatThrownBy(() -> service.put(clubId, new ClubHubSettingsDto(true, true, true, true, false, false, false, true)))
                .isInstanceOf(ValidationException.class);
        verify(clubProfileRepository, never()).save(any());
    }

    @Test
    void phoneAndEmailAreAcceptedWhileTheDirectoryIsOn() {
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.empty());
        when(clubProfileRepository.save(any(ClubProfile.class))).thenAnswer(i -> i.getArgument(0));

        ClubHubSettingsDto result = service.put(clubId, new ClubHubSettingsDto(false, false, false, false, true, true, true, true));

        assertThat(result).isEqualTo(new ClubHubSettingsDto(false, false, false, false, true, true, true, true));
    }

    @Test
    void putWithNoProfileRowCreatesTheRowForThisClubWithOnlyTheSwitchesSet() {
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.empty());
        when(clubProfileRepository.save(any(ClubProfile.class))).thenAnswer(i -> i.getArgument(0));

        service.put(clubId, new ClubHubSettingsDto(true, false, true, false, true, true, false, true));

        ArgumentCaptor<ClubProfile> saved = ArgumentCaptor.forClass(ClubProfile.class);
        verify(clubProfileRepository).save(saved.capture());
        ClubProfile profile = saved.getValue();
        assertThat(profile.getClubId()).isEqualTo(clubId);
        assertThat(profile.isHubInfoIdentity()).isTrue();
        assertThat(profile.isHubInfoContact()).isFalse();
        assertThat(profile.isHubInfoLinks()).isTrue();
        assertThat(profile.isHubInfoLogos()).isFalse();
        assertThat(profile.isHubInfoLogoDownload()).isTrue();
        assertThat(profile.isHubInfoDirectory()).isTrue();
        assertThat(profile.isHubInfoDirectoryPhone()).isFalse();
        assertThat(profile.isHubInfoDirectoryEmail()).isTrue();
        assertThat(profile.getType()).isNull();
        assertThat(profile.getPhone()).isNull();
    }

    @Test
    void putLeavesEveryProfileFieldOfAnExistingRowAlone() {
        ClubProfile existing = ClubProfile.builder().clubId(clubId).type(ClubProfileType.SCHOOL).email("hi@club.test")
                .phone("0821234567").website("https://club.test").logoUrl("/media/logo.png").bannerUrl("/media/banner.png")
                .address(Address.builder().city("Cape Town").build()).shareInitialsOnly(true).shareDisabledFormats("{\"RESULT\":[\"TV\"]}")
                .build();
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.of(existing));
        when(clubProfileRepository.save(any(ClubProfile.class))).thenAnswer(i -> i.getArgument(0));

        service.put(clubId, new ClubHubSettingsDto(false, false, false, false, false, false, false, false));

        assertThat(existing.getType()).isEqualTo(ClubProfileType.SCHOOL);
        assertThat(existing.getEmail()).isEqualTo("hi@club.test");
        assertThat(existing.getPhone()).isEqualTo("0821234567");
        assertThat(existing.getWebsite()).isEqualTo("https://club.test");
        assertThat(existing.getLogoUrl()).isEqualTo("/media/logo.png");
        assertThat(existing.getBannerUrl()).isEqualTo("/media/banner.png");
        assertThat(existing.getAddress().getCity()).isEqualTo("Cape Town");
        assertThat(existing.isShareInitialsOnly()).isTrue();
        assertThat(existing.getShareDisabledFormats()).isEqualTo("{\"RESULT\":[\"TV\"]}");
        assertThat(existing.isHubInfoIdentity()).isFalse();
    }
}
