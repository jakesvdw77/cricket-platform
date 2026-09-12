package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.dto.CreateLeagueRequest;
import com.cricketlegend.dto.LeagueDto;
import com.cricketlegend.dto.UpdateLeagueRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.LeagueMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.service.impl.LeagueServiceImpl;
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
 * Unit tests for LeagueServiceImpl's business rules from docs/specs/029-league-management.md:
 * create/update default {@code source}/{@code maxPlayingXiSize}/{@code allowSubstitutions} when
 * left null, the {@code minAge <= maxAge} validation, deactivate/reactivate's one-way transition
 * guard, and cross-club isolation. Per docs/standards/backend.md, every @Service method carrying
 * a business rule ships a unit test in the same change.
 */
@ExtendWith(MockitoExtension.class)
class LeagueServiceImplTest {

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private LeagueMapper leagueMapper;

    private LeagueServiceImpl leagueService;

    @BeforeEach
    void setUp() {
        leagueService = new LeagueServiceImpl(leagueRepository, leagueMapper);
    }

    private LeagueDto dummyDto() {
        return new LeagueDto(
                UUID.randomUUID(), UUID.randomUUID(), "Premier League", LeagueSource.INTERNAL, 11,
                false, null, null, null, true, null, null, null);
    }

    private League existingLeague(UUID id, UUID clubId, boolean active) {
        return League.builder().id(id).clubId(clubId).name("Premier League").source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11).allowSubstitutions(false).active(active).build();
    }

    @Test
    void createDefaultsSourceMaxXiSizeAndAllowSubstitutionsWhenNull() {
        UUID clubId = UUID.randomUUID();
        CreateLeagueRequest request =
                new CreateLeagueRequest("Vets League", null, null, null, null, null, null);
        ArgumentCaptor<League> captor = ArgumentCaptor.forClass(League.class);
        when(leagueRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(leagueMapper.toDto(any(League.class))).thenReturn(dummyDto());

        leagueService.create(clubId, request);

        League saved = captor.getValue();
        assertThat(saved.getClubId()).isEqualTo(clubId);
        assertThat(saved.getSource()).isEqualTo(LeagueSource.INTERNAL);
        assertThat(saved.getMaxPlayingXiSize()).isEqualTo(11);
        assertThat(saved.isAllowSubstitutions()).isFalse();
        assertThat(saved.isActive()).isTrue();
    }

    @Test
    void createWithACustomMaxPlayingXiSizeAndVetsFlagsIsPersisted() {
        UUID clubId = UUID.randomUUID();
        CreateLeagueRequest request =
                new CreateLeagueRequest("Vets League", LeagueSource.INTERNAL, 12, true, 35, null, null);
        ArgumentCaptor<League> captor = ArgumentCaptor.forClass(League.class);
        when(leagueRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(leagueMapper.toDto(any(League.class))).thenReturn(dummyDto());

        leagueService.create(clubId, request);

        League saved = captor.getValue();
        assertThat(saved.getMaxPlayingXiSize()).isEqualTo(12);
        assertThat(saved.isAllowSubstitutions()).isTrue();
        assertThat(saved.getMinAge()).isEqualTo(35);
    }

    @Test
    void createWithMinAgeGreaterThanMaxAgeThrowsValidationExceptionAndNeverSaves() {
        UUID clubId = UUID.randomUUID();
        CreateLeagueRequest request =
                new CreateLeagueRequest("U15s", null, null, null, 20, 15, null);

        assertThatThrownBy(() -> leagueService.create(clubId, request))
                .isInstanceOf(ValidationException.class);

        org.mockito.Mockito.verify(leagueRepository, never()).save(any());
    }

    @Test
    void updateAppliesRequestFieldsOntoTheExistingEntity() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        League existing = existingLeague(leagueId, clubId, true);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(existing));
        when(leagueRepository.save(existing)).thenReturn(existing);
        when(leagueMapper.toDto(existing)).thenReturn(dummyDto());

        UpdateLeagueRequest request =
                new UpdateLeagueRequest("Renamed League", LeagueSource.INTERNAL, 12, true, 10, 20, null);

        leagueService.update(clubId, leagueId, request);

        assertThat(existing.getName()).isEqualTo("Renamed League");
        assertThat(existing.getMaxPlayingXiSize()).isEqualTo(12);
        assertThat(existing.isAllowSubstitutions()).isTrue();
        assertThat(existing.getMinAge()).isEqualTo(10);
        assertThat(existing.getMaxAge()).isEqualTo(20);
    }

    @Test
    void updateOnALeagueBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        League existing = existingLeague(leagueId, otherClubId, true);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(existing));

        UpdateLeagueRequest request =
                new UpdateLeagueRequest("Renamed League", null, null, null, null, null, null);

        assertThatThrownBy(() -> leagueService.update(clubId, leagueId, request))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void deactivateOnActiveLeagueTransitionsToInactive() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        League existing = existingLeague(leagueId, clubId, true);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(existing));
        when(leagueRepository.save(existing)).thenReturn(existing);
        when(leagueMapper.toDto(existing)).thenReturn(dummyDto());

        leagueService.deactivate(clubId, leagueId);

        assertThat(existing.isActive()).isFalse();
    }

    @Test
    void deactivateOnAlreadyInactiveLeagueThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        League existing = existingLeague(leagueId, clubId, false);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> leagueService.deactivate(clubId, leagueId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void reactivateOnInactiveLeagueTransitionsToActive() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        League existing = existingLeague(leagueId, clubId, false);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(existing));
        when(leagueRepository.save(existing)).thenReturn(existing);
        when(leagueMapper.toDto(existing)).thenReturn(dummyDto());

        leagueService.reactivate(clubId, leagueId);

        assertThat(existing.isActive()).isTrue();
    }

    @Test
    void reactivateOnAlreadyActiveLeagueThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        League existing = existingLeague(leagueId, clubId, true);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> leagueService.reactivate(clubId, leagueId))
                .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void listMapsEveryLeagueForTheClub() {
        UUID clubId = UUID.randomUUID();
        League league = existingLeague(UUID.randomUUID(), clubId, true);
        LeagueDto dto = dummyDto();
        when(leagueRepository.findByClubId(clubId)).thenReturn(List.of(league));
        when(leagueMapper.toDto(league)).thenReturn(dto);

        List<LeagueDto> result = leagueService.list(clubId);

        assertThat(result).containsExactly(dto);
    }
}
