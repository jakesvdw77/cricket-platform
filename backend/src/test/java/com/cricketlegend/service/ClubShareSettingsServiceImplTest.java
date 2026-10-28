package com.cricketlegend.service;

import org.springframework.security.access.AccessDeniedException;
import com.cricketlegend.exception.ValidationException;
import java.util.Map;
import java.util.List;
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

    // --- docs/specs/122-league-sharing.md: disabledFormats ---

    private ClubProfile profileWith(String disabledJson) {
        return ClubProfile.builder().clubId(clubId).shareDisabledFormats(disabledJson).build();
    }

    private void existingProfile(ClubProfile profile) {
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.of(profile));
        org.mockito.Mockito.lenient().when(clubProfileRepository.save(any(ClubProfile.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void getDefaultsToNoDisabledFormatsWhenTheClubHasNoProfileRow() {
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.empty());

        assertThat(service.get(clubId).disabledFormats()).isEmpty();
    }

    @Test
    void getReadsTheStoredDisabledFormats() {
        existingProfile(profileWith("{\"LEAGUE\":[\"FACEBOOK\"],\"RESULT\":[\"TV\"]}"));

        assertThat(service.get(clubId).disabledFormats())
                .containsEntry("LEAGUE", List.of("FACEBOOK"))
                .containsEntry("RESULT", List.of("TV"));
    }

    @Test
    void anAdministratorStoresNormalisedDisabledFormatsSortedAndDeduplicated() {
        ClubProfile existing = profileWith("{}");
        existingProfile(existing);

        ShareSettingsDto result = service.put(
                clubId, new ShareSettingsDto(false, Map.of("LEAGUE", List.of("POSTER", "FACEBOOK", "POSTER"))), true);

        assertThat(result.disabledFormats()).containsExactly(Map.entry("LEAGUE", List.of("FACEBOOK", "POSTER")));
        assertThat(existing.getShareDisabledFormats()).isEqualTo("{\"LEAGUE\":[\"FACEBOOK\",\"POSTER\"]}");
    }

    @Test
    void anEmptyListForAContentTypeClearsIt() {
        ClubProfile existing = profileWith("{\"RESULT\":[\"TV\"]}");
        existingProfile(existing);

        ShareSettingsDto result = service.put(clubId, new ShareSettingsDto(false, Map.of("RESULT", List.of())), true);

        assertThat(result.disabledFormats()).isEmpty();
        assertThat(existing.getShareDisabledFormats()).isEqualTo("{}");
    }

    @Test
    void aNullDisabledFormatsLeavesTheStoredValueAlone() {
        ClubProfile existing = profileWith("{\"RESULT\":[\"TV\"]}");
        existingProfile(existing);

        ShareSettingsDto result = service.put(clubId, new ShareSettingsDto(true, null), false);

        assertThat(result.initialsOnlyDefault()).isTrue();
        assertThat(result.disabledFormats()).containsEntry("RESULT", List.of("TV"));
        assertThat(existing.getShareDisabledFormats()).isEqualTo("{\"RESULT\":[\"TV\"]}");
    }

    @Test
    void switchingOffEveryFormatOfAContentTypeIsRejected() {
        existingProfile(profileWith("{}"));
        List<String> allLeague = List.of("PDF", "POSTER", "CALENDAR", "WHATSAPP", "FACEBOOK");

        assertThatThrownBy(() -> service.put(clubId, new ShareSettingsDto(false, Map.of("LEAGUE", allLeague)), true))
                .isInstanceOf(ValidationException.class);
        verify(clubProfileRepository, never()).save(any());
    }

    @Test
    void switchingOffAllButOneFormatIsAllowed() {
        existingProfile(profileWith("{}"));

        ShareSettingsDto result = service.put(clubId,
                new ShareSettingsDto(false, Map.of("RESULT", List.of("PDF", "IMAGE", "TV", "WHATSAPP"))), true);

        assertThat(result.disabledFormats().get("RESULT")).hasSize(4);
    }

    @Test
    void anUnknownContentTypeOrFormatCodeIsRejected() {
        existingProfile(profileWith("{}"));

        assertThatThrownBy(() -> service.put(clubId, new ShareSettingsDto(false, Map.of("BOGUS", List.of("PDF"))), true))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.put(clubId, new ShareSettingsDto(false, Map.of("LEAGUE", List.of("TV"))), true))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.put(clubId, new ShareSettingsDto(false, Map.of("RESULT", List.of("POSTER"))), true))
                .isInstanceOf(ValidationException.class);
        verify(clubProfileRepository, never()).save(any());
    }

    @Test
    void aNonAdministratorChangingTheFormatsIsRefusedAndSavesNothing() {
        existingProfile(profileWith("{}"));

        assertThatThrownBy(() -> service.put(clubId, new ShareSettingsDto(false, Map.of("RESULT", List.of("TV"))), false))
                .isInstanceOf(AccessDeniedException.class);
        verify(clubProfileRepository, never()).save(any());
    }

    @Test
    void aNonAdministratorResendingTheUnchangedFormatsMayStillSaveTheInitialsFlag() {
        existingProfile(profileWith("{\"RESULT\":[\"TV\"]}"));

        ShareSettingsDto result = service.put(clubId,
                new ShareSettingsDto(true, Map.of("RESULT", List.of("TV"))), false);

        assertThat(result.initialsOnlyDefault()).isTrue();
        assertThat(result.disabledFormats()).containsEntry("RESULT", List.of("TV"));
    }

    @Test
    void creatingTheProfileRowFromScratchStoresTheFormats() {
        when(clubRepository.existsById(clubId)).thenReturn(true);
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.empty());
        when(clubProfileRepository.save(any(ClubProfile.class))).thenAnswer(i -> i.getArgument(0));

        ShareSettingsDto result = service.put(clubId, new ShareSettingsDto(false, Map.of("LEAGUE", List.of("CALENDAR"))), true);

        assertThat(result.disabledFormats()).containsEntry("LEAGUE", List.of("CALENDAR"));
    }
}
