package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.ClubProfile;
import com.cricketlegend.dto.LeaderboardSettingsDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.ClubProfileRepository;
import com.cricketlegend.repository.ClubRepository;
import com.cricketlegend.service.impl.ClubLeaderboardSettingsServiceImpl;
import com.cricketlegend.service.support.LeaderboardBoard;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Unit tests for docs/specs/103-player-stats.md decision 18: the club's chosen award categories. */
@ExtendWith(MockitoExtension.class)
class ClubLeaderboardSettingsServiceImplTest {

    @Mock
    private ClubRepository clubRepository;

    @Mock
    private ClubProfileRepository clubProfileRepository;

    private ClubLeaderboardSettingsServiceImpl service;

    private final UUID clubId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new ClubLeaderboardSettingsServiceImpl(clubRepository, clubProfileRepository);
    }

    private void clubExists() {
        when(clubRepository.existsById(clubId)).thenReturn(true);
    }

    private static List<String> defaultCodes() {
        return LeaderboardBoard.awardDefaults().stream().map(LeaderboardBoard::getCode).toList();
    }

    @Test
    void getReturnsTheDefaultsWhenTheProfileHasNoChoice() {
        clubExists();
        when(clubProfileRepository.findById(clubId))
                .thenReturn(Optional.of(ClubProfile.builder().clubId(clubId).leaderboardAwardCategories(null).build()));

        LeaderboardSettingsDto dto = service.get(clubId);

        assertThat(dto.awardCategories()).isEqualTo(defaultCodes());
        assertThat(dto.selectableCategories())
                .isEqualTo(LeaderboardBoard.awardEligibleBoards().stream()
                        .map(LeaderboardBoard::getCode)
                        .toList());
    }

    @Test
    void getReturnsTheDefaultsWhenThereIsNoProfileRow() {
        clubExists();
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.empty());

        assertThat(service.get(clubId).awardCategories()).isEqualTo(defaultCodes());
    }

    @Test
    void getReturnsTheDefaultsWhenTheStoredListIsEmpty() {
        clubExists();
        when(clubProfileRepository.findById(clubId))
                .thenReturn(Optional.of(ClubProfile.builder().clubId(clubId).leaderboardAwardCategories(List.of()).build()));

        assertThat(service.get(clubId).awardCategories()).isEqualTo(defaultCodes());
    }

    @Test
    void getReturnsTheStoredChoiceDroppingACodeThatNoLongerExists() {
        clubExists();
        when(clubProfileRepository.findById(clubId))
                .thenReturn(Optional.of(ClubProfile.builder()
                        .clubId(clubId)
                        .leaderboardAwardCategories(List.of("MOST_RUNS", "GONE"))
                        .build()));

        assertThat(service.get(clubId).awardCategories()).containsExactly("MOST_RUNS");
    }

    @Test
    void getOfAnUnknownClubIsNotFound() {
        when(clubRepository.existsById(clubId)).thenReturn(false);

        assertThatThrownBy(() -> service.get(clubId)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void putOfAnEmptyListIsRefused() {
        clubExists();

        assertThatThrownBy(() -> service.put(clubId, new LeaderboardSettingsDto(List.of(), null)))
                .isInstanceOf(ValidationException.class);
        verify(clubProfileRepository, never()).save(any());
    }

    @Test
    void putOfNothingIsRefused() {
        clubExists();

        assertThatThrownBy(() -> service.put(clubId, null)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.put(clubId, new LeaderboardSettingsDto(null, null)))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void putOfAnUnknownCodeIsRefused() {
        clubExists();

        assertThatThrownBy(() -> service.put(clubId, new LeaderboardSettingsDto(List.of("MOST_RUNS", "NOPE"), null)))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("NOPE");
        verify(clubProfileRepository, never()).save(any());
    }

    @Test
    void putOfACodeThatIsNotAwardEligibleIsRefused() {
        clubExists();
        assertThat(LeaderboardBoard.MOST_30S.isAwardEligible()).isFalse();

        assertThatThrownBy(() -> service.put(clubId, new LeaderboardSettingsDto(List.of("MOST_30S"), null)))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("MOST_30S");
        verify(clubProfileRepository, never()).save(any());
    }

    @Test
    void putDropsDuplicatesAndStoresTheCodesInCatalogueOrder() {
        clubExists();
        ClubProfile profile = ClubProfile.builder().clubId(clubId).build();
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.of(profile));

        LeaderboardSettingsDto saved = service.put(
                clubId,
                new LeaderboardSettingsDto(List.of("MOST_WICKETS", "MOST_RUNS", "MOST_WICKETS", "MOST_RUNS"), null));

        assertThat(saved.awardCategories()).containsExactly("MOST_RUNS", "MOST_WICKETS");
        ArgumentCaptor<ClubProfile> stored = ArgumentCaptor.forClass(ClubProfile.class);
        verify(clubProfileRepository).save(stored.capture());
        assertThat(stored.getValue().getLeaderboardAwardCategories()).containsExactly("MOST_RUNS", "MOST_WICKETS");
    }

    @Test
    void putCreatesTheProfileRowWhenAbsent() {
        clubExists();
        when(clubProfileRepository.findById(clubId)).thenReturn(Optional.empty());

        service.put(clubId, new LeaderboardSettingsDto(List.of("MOST_CATCHES"), null));

        ArgumentCaptor<ClubProfile> stored = ArgumentCaptor.forClass(ClubProfile.class);
        verify(clubProfileRepository).save(stored.capture());
        assertThat(stored.getValue().getClubId()).isEqualTo(clubId);
        assertThat(stored.getValue().getLeaderboardAwardCategories()).containsExactly("MOST_CATCHES");
    }

    @Test
    void putOfAnUnknownClubIsNotFound() {
        when(clubRepository.existsById(clubId)).thenReturn(false);

        assertThatThrownBy(() -> service.put(clubId, new LeaderboardSettingsDto(List.of("MOST_RUNS"), null)))
                .isInstanceOf(NotFoundException.class);
        verify(clubProfileRepository, never()).save(any());
    }
}
