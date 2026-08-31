package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.Section;
import com.cricketlegend.dto.SectionDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.SectionMapper;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.service.impl.PlayerSectionServiceImpl;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for PlayerSectionServiceImpl's business rules from docs/specs/028-players.md: the
 * two-level scoping chain (parent {@code playerId} checked against {@code clubId} first, then
 * {@code sectionId} independently against {@code clubId} — a cross-club parent 404s without ever
 * querying the section, mirrors {@code TeamSponsorServiceImplTest}'s equivalent test), link/
 * unlink (already-tagged {@code 409}, not-tagged {@code 404}), cross-club rejection for {@code
 * sectionId}.
 */
@ExtendWith(MockitoExtension.class)
class PlayerSectionServiceImplTest {

    @Mock
    private PlayerProfileRepository playerProfileRepository;

    @Mock
    private PlayerSectionRepository playerSectionRepository;

    @Mock
    private SectionRepository sectionRepository;

    @Mock
    private SectionMapper sectionMapper;

    private PlayerSectionServiceImpl playerSectionService;

    @BeforeEach
    void setUp() {
        playerSectionService = new PlayerSectionServiceImpl(
                playerProfileRepository, playerSectionRepository, sectionRepository, sectionMapper);
    }

    private PlayerProfile profile(UUID id, UUID clubId) {
        return PlayerProfile.builder().id(id).clubId(clubId).personId(UUID.randomUUID()).active(true).build();
    }

    private Section section(UUID id, UUID clubId) {
        Section section = new Section();
        section.setId(id);
        section.setClubId(clubId);
        section.setName("Men");
        section.setActive(true);
        return section;
    }

    private SectionDto dummySectionDto() {
        return new SectionDto(UUID.randomUUID(), UUID.randomUUID(), null, "Men", null, null, null, true, null, null, null);
    }

    // --- list ---

    @Test
    void listMapsEverySectionTaggedToThePlayer() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.of(profile(playerId, clubId)));
        PlayerSection link = PlayerSection.builder()
                .id(UUID.randomUUID())
                .playerProfileId(playerId)
                .sectionId(sectionId)
                .build();
        when(playerSectionRepository.findByPlayerProfileId(playerId)).thenReturn(List.of(link));
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        SectionDto dto = dummySectionDto();
        when(sectionMapper.toDto(ArgumentMatchers.any(Section.class))).thenReturn(dto);

        List<SectionDto> result = playerSectionService.list(clubId, playerId);

        assertThat(result).containsExactly(dto);
    }

    @Test
    void listOnAPlayerBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId))
                .thenReturn(Optional.of(profile(playerId, otherClubId)));

        assertThatThrownBy(() -> playerSectionService.list(clubId, playerId))
                .isInstanceOf(NotFoundException.class);
        verify(playerSectionRepository, never()).findByPlayerProfileId(ArgumentMatchers.any());
    }

    // --- link ---

    @Test
    void linkAnExistingSectionBelongingToTheSameClubSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.of(profile(playerId, clubId)));
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(playerSectionRepository.existsByPlayerProfileIdAndSectionId(playerId, sectionId))
                .thenReturn(false);

        playerSectionService.link(clubId, playerId, sectionId);

        verify(playerSectionRepository).save(ArgumentMatchers.any(PlayerSection.class));
    }

    @Test
    void linkASectionBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.of(profile(playerId, clubId)));
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, otherClubId)));

        assertThatThrownBy(() -> playerSectionService.link(clubId, playerId, sectionId))
                .isInstanceOf(NotFoundException.class);
        verify(playerSectionRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void linkOnAPlayerBelongingToADifferentClubThrowsNotFoundExceptionWithoutCheckingTheSection() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId))
                .thenReturn(Optional.of(profile(playerId, otherClubId)));

        assertThatThrownBy(() -> playerSectionService.link(clubId, playerId, sectionId))
                .isInstanceOf(NotFoundException.class);
        verify(sectionRepository, never()).findById(ArgumentMatchers.any());
    }

    @Test
    void linkAnAlreadyTaggedPairThrowsConflictException() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.of(profile(playerId, clubId)));
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(playerSectionRepository.existsByPlayerProfileIdAndSectionId(playerId, sectionId))
                .thenReturn(true);

        assertThatThrownBy(() -> playerSectionService.link(clubId, playerId, sectionId))
                .isInstanceOf(ConflictException.class);
        verify(playerSectionRepository, never()).save(ArgumentMatchers.any());
    }

    // --- unlink ---

    @Test
    void unlinkAnExistingTagRemovesTheJoinRow() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.of(profile(playerId, clubId)));
        when(playerSectionRepository.findByPlayerProfileIdAndSectionId(playerId, sectionId))
                .thenReturn(Optional.of(PlayerSection.builder()
                        .id(UUID.randomUUID())
                        .playerProfileId(playerId)
                        .sectionId(sectionId)
                        .build()));

        playerSectionService.unlink(clubId, playerId, sectionId);

        verify(playerSectionRepository).deleteByPlayerProfileIdAndSectionId(playerId, sectionId);
    }

    @Test
    void unlinkWithNoExistingTagThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(playerProfileRepository.findById(playerId)).thenReturn(Optional.of(profile(playerId, clubId)));
        when(playerSectionRepository.findByPlayerProfileIdAndSectionId(playerId, sectionId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> playerSectionService.unlink(clubId, playerId, sectionId))
                .isInstanceOf(NotFoundException.class);
        verify(playerSectionRepository, never()).deleteByPlayerProfileIdAndSectionId(playerId, sectionId);
    }
}
