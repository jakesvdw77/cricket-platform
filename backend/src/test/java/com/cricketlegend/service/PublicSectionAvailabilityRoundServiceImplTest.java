package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.dto.PublicSectionAvailabilityRoundDto;
import com.cricketlegend.dto.SectionAvailabilityResponseRowDto;
import com.cricketlegend.dto.SectionAvailabilityRoundStatusDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.SectionAvailabilityWindowClosedException;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.service.impl.PublicSectionAvailabilityRoundServiceImpl;
import java.time.LocalDate;
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
 * Unit tests for PublicSectionAvailabilityRoundServiceImpl — the fixture-group-selection
 * revision's public, unauthenticated surface (docs/specs/063-section-availability-and-flexible-
 * squads.md): happy-path get/set against a specific {@code windowId}, unknown {@code roundId} 404,
 * a {@code windowId} not belonging to this round 404, not-in-audience 404, closed-bracket 409.
 */
@ExtendWith(MockitoExtension.class)
class PublicSectionAvailabilityRoundServiceImplTest {

    @Mock
    private SectionAvailabilityRoundRepository sectionAvailabilityRoundRepository;

    @Mock
    private SectionAvailabilityWindowRepository sectionAvailabilityWindowRepository;

    @Mock
    private SectionAvailabilityResponseRepository sectionAvailabilityResponseRepository;

    @Mock
    private SectionRepository sectionRepository;

    @Mock
    private SectionAvailabilityAudienceResolver audienceResolver;

    private PublicSectionAvailabilityRoundServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new PublicSectionAvailabilityRoundServiceImpl(
                sectionAvailabilityRoundRepository,
                sectionAvailabilityWindowRepository,
                sectionAvailabilityResponseRepository,
                sectionRepository,
                audienceResolver);
    }

    private SectionAvailabilityRound round(UUID id, UUID sectionId) {
        return SectionAvailabilityRound.builder()
                .id(id)
                .clubId(UUID.randomUUID())
                .sectionId(sectionId)
                .description("Saturday fixtures")
                .firstMatchDate(LocalDate.of(2026, 9, 27))
                .lastMatchDate(LocalDate.of(2026, 9, 27))
                .autoClose(true)
                .open(true)
                .build();
    }

    @Test
    void getRoundReturns404WhenRoundIdDoesNotExist() {
        UUID roundId = UUID.randomUUID();
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getRound(roundId)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void getRoundReturnsEachBracketsOwnPerPlayerStatuses() {
        UUID roundId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID morningWindowId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        SectionAvailabilityRound round = round(roundId, sectionId);
        SectionAvailabilityWindow morning = SectionAvailabilityWindow.builder()
                .id(morningWindowId).roundId(roundId).sectionId(sectionId)
                .windowDate(LocalDate.of(2026, 9, 27)).dayPart(DayPart.MORNING).open(true).build();
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(round));
        when(sectionAvailabilityWindowRepository.findByRoundId(roundId)).thenReturn(List.of(morning));
        when(audienceResolver.resolveAudience(sectionId))
                .thenReturn(List.of(new SectionAvailabilityResponseRowDto(playerId, "Alice", "A", 7, null)));
        when(sectionAvailabilityResponseRepository.findByWindowId(morningWindowId)).thenReturn(List.of(
                SectionAvailabilityResponse.builder().windowId(morningWindowId).playerProfileId(playerId)
                        .status(AvailabilityStatus.AVAILABLE).build()));

        PublicSectionAvailabilityRoundDto dto = service.getRound(roundId);

        assertThat(dto.roundId()).isEqualTo(roundId);
        assertThat(dto.description()).isEqualTo("Saturday fixtures");
        assertThat(dto.responses()).hasSize(1);
        assertThat(dto.responses().get(0).statuses()).hasSize(1);
        SectionAvailabilityRoundStatusDto status = dto.responses().get(0).statuses().get(0);
        assertThat(status.windowId()).isEqualTo(morningWindowId);
        assertThat(status.status()).isEqualTo(AvailabilityStatus.AVAILABLE);
    }

    @Test
    void setAvailabilityRejectsAPlayerNotInTheRoundsOwnAudience() {
        UUID roundId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(round(roundId, sectionId)));
        when(audienceResolver.resolveAudience(sectionId)).thenReturn(List.of());

        assertThatThrownBy(() -> service.setAvailability(
                        roundId, playerId, UUID.randomUUID(), AvailabilityStatus.AVAILABLE))
                .isInstanceOf(NotFoundException.class);
        verify(sectionAvailabilityResponseRepository, never()).save(any());
    }

    @Test
    void setAvailabilityRejectsAWindowNotBelongingToThisRound() {
        UUID roundId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID windowId = UUID.randomUUID();
        SectionAvailabilityWindow otherRoundsWindow = SectionAvailabilityWindow.builder()
                .id(windowId).roundId(UUID.randomUUID()).sectionId(sectionId).dayPart(DayPart.MORNING).open(true)
                .build();
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(round(roundId, sectionId)));
        when(audienceResolver.resolveAudience(sectionId))
                .thenReturn(List.of(new SectionAvailabilityResponseRowDto(playerId, "Alice", "A", null, null)));
        when(sectionAvailabilityWindowRepository.findById(windowId)).thenReturn(Optional.of(otherRoundsWindow));

        assertThatThrownBy(() -> service.setAvailability(roundId, playerId, windowId, AvailabilityStatus.AVAILABLE))
                .isInstanceOf(NotFoundException.class);
        verify(sectionAvailabilityResponseRepository, never()).save(any());
    }

    @Test
    void setAvailabilityRejectsAWriteAgainstAClosedBracket() {
        UUID roundId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID windowId = UUID.randomUUID();
        SectionAvailabilityWindow closedWindow = SectionAvailabilityWindow.builder()
                .id(windowId).roundId(roundId).sectionId(sectionId).dayPart(DayPart.MORNING).open(false).build();
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(round(roundId, sectionId)));
        when(audienceResolver.resolveAudience(sectionId))
                .thenReturn(List.of(new SectionAvailabilityResponseRowDto(playerId, "Alice", "A", null, null)));
        when(sectionAvailabilityWindowRepository.findById(windowId)).thenReturn(Optional.of(closedWindow));

        assertThatThrownBy(() -> service.setAvailability(roundId, playerId, windowId, AvailabilityStatus.AVAILABLE))
                .isInstanceOf(SectionAvailabilityWindowClosedException.class);
        verify(sectionAvailabilityResponseRepository, never()).save(any());
    }

    @Test
    void setAvailabilityUpsertsTheResponseAgainstTheResolvedWindow() {
        UUID roundId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID windowId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        SectionAvailabilityWindow openWindow = SectionAvailabilityWindow.builder()
                .id(windowId).roundId(roundId).sectionId(sectionId).dayPart(DayPart.MORNING).open(true).build();
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(round(roundId, sectionId)));
        when(audienceResolver.resolveAudience(sectionId))
                .thenReturn(List.of(new SectionAvailabilityResponseRowDto(playerId, "Alice", "A", null, null)));
        when(sectionAvailabilityWindowRepository.findById(windowId)).thenReturn(Optional.of(openWindow));
        when(sectionAvailabilityResponseRepository.findByWindowIdAndPlayerProfileId(windowId, playerId))
                .thenReturn(Optional.empty());
        when(sectionAvailabilityWindowRepository.findByRoundId(roundId)).thenReturn(List.of(openWindow));
        when(sectionAvailabilityResponseRepository.findByWindowId(windowId)).thenReturn(List.of());

        service.setAvailability(roundId, playerId, windowId, AvailabilityStatus.AVAILABLE);

        ArgumentCaptor<SectionAvailabilityResponse> captor = ArgumentCaptor.forClass(SectionAvailabilityResponse.class);
        verify(sectionAvailabilityResponseRepository).save(captor.capture());
        assertThat(captor.getValue().getWindowId()).isEqualTo(windowId);
        assertThat(captor.getValue().getPlayerProfileId()).isEqualTo(playerId);
        assertThat(captor.getValue().getStatus()).isEqualTo(AvailabilityStatus.AVAILABLE);
    }
}
