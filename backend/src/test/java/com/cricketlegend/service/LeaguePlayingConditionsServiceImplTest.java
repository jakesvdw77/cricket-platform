package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeaguePlayingConditions;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Season;
import com.cricketlegend.dto.LeaguePlayingConditionsDto;
import com.cricketlegend.dto.MediaUploadResponse;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.LeaguePlayingConditionsMapper;
import com.cricketlegend.repository.LeaguePlayingConditionsRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.service.impl.LeaguePlayingConditionsServiceImpl;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.multipart.MultipartFile;

/**
 * Unit tests for LeaguePlayingConditionsServiceImpl's business rules from
 * docs/specs/050-league-schedule-and-fixtures.md: same-club consistency for {@code leagueId}/
 * {@code seasonId} (each independently 404 when mismatched, {@code leagueId} always required
 * unlike {@code Match}'s optional one), the {@code (league, season)} upsert (first upload creates
 * a row, a second replaces it in place rather than creating a second one), and {@code get()}'s
 * 404 when nothing has been uploaded yet. Mirrors {@code LeagueAffiliationServiceImplTest}'s shape.
 */
@ExtendWith(MockitoExtension.class)
class LeaguePlayingConditionsServiceImplTest {

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private LeaguePlayingConditionsRepository leaguePlayingConditionsRepository;

    @Mock
    private MediaService mediaService;

    @Mock
    private LeaguePlayingConditionsMapper leaguePlayingConditionsMapper;

    @Mock
    private MultipartFile file;

    private LeaguePlayingConditionsServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new LeaguePlayingConditionsServiceImpl(
                leagueRepository, seasonRepository, leaguePlayingConditionsRepository, mediaService,
                leaguePlayingConditionsMapper);
    }

    private League league(UUID id, UUID clubId) {
        return League.builder().id(id).clubId(clubId).name("Premier League").source(LeagueSource.INTERNAL)
                .maxPlayingXiSize(11).active(true).build();
    }

    private Season season(UUID id, UUID clubId) {
        return Season.builder().id(id).clubId(clubId).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true)
                .build();
    }

    // --- get() ---

    @Test
    void getWithALeagueBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, otherClubId)));

        assertThatThrownBy(() -> service.get(clubId, leagueId, seasonId)).isInstanceOf(NotFoundException.class);
        verify(seasonRepository, never()).findById(any());
    }

    @Test
    void getWithASeasonBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, otherClubId)));

        assertThatThrownBy(() -> service.get(clubId, leagueId, seasonId)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void getWithNothingUploadedYetThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leaguePlayingConditionsRepository.findByLeagueIdAndSeasonId(leagueId, seasonId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(clubId, leagueId, seasonId)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void getReturnsTheMappedDtoWhenADocumentExists() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        LeaguePlayingConditions existing = LeaguePlayingConditions.builder()
                .id(UUID.randomUUID()).leagueId(leagueId).seasonId(seasonId).documentUrl("/media/rules.pdf")
                .uploadedAt(Instant.now()).build();
        LeaguePlayingConditionsDto dto = new LeaguePlayingConditionsDto(
                existing.getId(), leagueId, seasonId, "/media/rules.pdf", existing.getUploadedAt(), null);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leaguePlayingConditionsRepository.findByLeagueIdAndSeasonId(leagueId, seasonId))
                .thenReturn(Optional.of(existing));
        when(leaguePlayingConditionsMapper.toDto(existing)).thenReturn(dto);

        LeaguePlayingConditionsDto result = service.get(clubId, leagueId, seasonId);

        assertThat(result).isEqualTo(dto);
    }

    // --- upload() ---

    @Test
    void uploadWithALeagueBelongingToADifferentClubThrowsNotFoundExceptionAndNeverCallsMediaService() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, otherClubId)));

        assertThatThrownBy(() -> service.upload(clubId, leagueId, seasonId, file, null))
                .isInstanceOf(NotFoundException.class);
        verify(mediaService, never()).upload(any(), any());
        verify(leaguePlayingConditionsRepository, never()).save(any());
    }

    @Test
    void uploadWithASeasonBelongingToADifferentClubThrowsNotFoundExceptionAndNeverCallsMediaService() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, otherClubId)));

        assertThatThrownBy(() -> service.upload(clubId, leagueId, seasonId, file, null))
                .isInstanceOf(NotFoundException.class);
        verify(mediaService, never()).upload(any(), any());
        verify(leaguePlayingConditionsRepository, never()).save(any());
    }

    @Test
    void uploadUsesTheMediaServicesTwoArgOverloadWithThePdfOnlyAllowlist() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leaguePlayingConditionsRepository.findByLeagueIdAndSeasonId(leagueId, seasonId))
                .thenReturn(Optional.empty());
        when(mediaService.upload(eq(file), any())).thenReturn(new MediaUploadResponse("/media/rules.pdf"));
        when(leaguePlayingConditionsRepository.save(any(LeaguePlayingConditions.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(leaguePlayingConditionsMapper.toDto(any(LeaguePlayingConditions.class))).thenReturn(
                new LeaguePlayingConditionsDto(UUID.randomUUID(), leagueId, seasonId, "/media/rules.pdf",
                        Instant.now(), null));

        service.upload(clubId, leagueId, seasonId, file, null);

        verify(mediaService).upload(file, Map.of("application/pdf", ".pdf"));
    }

    @Test
    void firstUploadForAPairCreatesANewRow() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID uploadedBy = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leaguePlayingConditionsRepository.findByLeagueIdAndSeasonId(leagueId, seasonId))
                .thenReturn(Optional.empty());
        when(mediaService.upload(eq(file), any())).thenReturn(new MediaUploadResponse("/media/rules.pdf"));
        ArgumentCaptor<LeaguePlayingConditions> captor = ArgumentCaptor.forClass(LeaguePlayingConditions.class);
        when(leaguePlayingConditionsRepository.save(captor.capture()))
                .thenAnswer(invocation -> captor.getValue());
        when(leaguePlayingConditionsMapper.toDto(any(LeaguePlayingConditions.class))).thenReturn(
                new LeaguePlayingConditionsDto(UUID.randomUUID(), leagueId, seasonId, "/media/rules.pdf",
                        Instant.now(), uploadedBy));

        service.upload(clubId, leagueId, seasonId, file, uploadedBy);

        LeaguePlayingConditions saved = captor.getValue();
        assertThat(saved.getId()).isNull(); // no id yet — a genuinely new row, not an update
        assertThat(saved.getLeagueId()).isEqualTo(leagueId);
        assertThat(saved.getSeasonId()).isEqualTo(seasonId);
        assertThat(saved.getDocumentUrl()).isEqualTo("/media/rules.pdf");
        assertThat(saved.getUploadedBy()).isEqualTo(uploadedBy);
        verify(leaguePlayingConditionsRepository).save(any(LeaguePlayingConditions.class));
    }

    @Test
    void aSecondUploadForTheSamePairReplacesTheExistingRowInPlaceRatherThanCreatingASecondOne() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID existingId = UUID.randomUUID();
        UUID newUploadedBy = UUID.randomUUID();
        LeaguePlayingConditions existing = LeaguePlayingConditions.builder()
                .id(existingId).leagueId(leagueId).seasonId(seasonId).documentUrl("/media/old-rules.pdf")
                .uploadedAt(Instant.now().minusSeconds(3600)).uploadedBy(UUID.randomUUID()).build();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leaguePlayingConditionsRepository.findByLeagueIdAndSeasonId(leagueId, seasonId))
                .thenReturn(Optional.of(existing));
        when(mediaService.upload(eq(file), any())).thenReturn(new MediaUploadResponse("/media/new-rules.pdf"));
        ArgumentCaptor<LeaguePlayingConditions> captor = ArgumentCaptor.forClass(LeaguePlayingConditions.class);
        when(leaguePlayingConditionsRepository.save(captor.capture()))
                .thenAnswer(invocation -> captor.getValue());
        when(leaguePlayingConditionsMapper.toDto(any(LeaguePlayingConditions.class))).thenReturn(
                new LeaguePlayingConditionsDto(existingId, leagueId, seasonId, "/media/new-rules.pdf",
                        Instant.now(), newUploadedBy));

        service.upload(clubId, leagueId, seasonId, file, newUploadedBy);

        LeaguePlayingConditions saved = captor.getValue();
        assertThat(saved.getId()).isEqualTo(existingId); // same row, same id — not a second row
        assertThat(saved.getDocumentUrl()).isEqualTo("/media/new-rules.pdf");
        assertThat(saved.getUploadedBy()).isEqualTo(newUploadedBy);
        verify(leaguePlayingConditionsRepository, org.mockito.Mockito.times(1)).save(any());
    }
}
