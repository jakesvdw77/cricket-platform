package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.CreateTeamRequest;
import com.cricketlegend.dto.TeamDto;
import com.cricketlegend.dto.UpdateTeamRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.TeamMapper;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.TeamServiceImpl;
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
 * Unit tests for TeamServiceImpl's business rules from docs/specs/026-teams.md: create/update,
 * the plain one-way-transition-guard shape for deactivate/reactivate (mirrors {@code
 * ClubContactServiceImpl}, no hard-delete branch), the two-level {@code
 * findSectionOrThrowForClub}/{@code findTeamOrThrowForSection} cross-club/cross-section {@link
 * NotFoundException} isolation, and {@code listBySection}/{@code listByClub}.
 */
@ExtendWith(MockitoExtension.class)
class TeamServiceImplTest {

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private SectionRepository sectionRepository;

    @Mock
    private TeamMapper teamMapper;

    private TeamServiceImpl teamService;

    @BeforeEach
    void setUp() {
        teamService = new TeamServiceImpl(teamRepository, sectionRepository, teamMapper);
    }

    private Section section(UUID id, UUID clubId) {
        Section section = new Section();
        section.setId(id);
        section.setClubId(clubId);
        section.setName("Men");
        section.setActive(true);
        return section;
    }

    private Team team(UUID id, UUID sectionId, boolean active) {
        Team team = new Team();
        team.setId(id);
        team.setSectionId(sectionId);
        team.setActive(active);
        team.setName("1st XI");
        return team;
    }

    private TeamDto dummyDto() {
        return new TeamDto(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "1st XI", null, true, null, null, null);
    }

    // --- create ---

    @Test
    void createUnderASectionBelongingToTheClubSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        CreateTeamRequest request = new CreateTeamRequest("1st XI", null);
        Team mapped = new Team();
        when(teamMapper.toEntity(request)).thenReturn(mapped);
        when(teamRepository.save(mapped)).thenReturn(mapped);
        when(teamMapper.toDto(mapped)).thenReturn(dummyDto());

        teamService.create(clubId, sectionId, request);

        assertThat(mapped.getClubId()).isEqualTo(clubId);
        assertThat(mapped.getSectionId()).isEqualTo(sectionId);
        assertThat(mapped.isActive()).isTrue();
    }

    @Test
    void createUnderASectionBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, otherClubId)));

        CreateTeamRequest request = new CreateTeamRequest("1st XI", null);

        assertThatThrownBy(() -> teamService.create(clubId, sectionId, request))
                .isInstanceOf(NotFoundException.class);
        verify(teamRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void createUnderANonexistentSectionThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.empty());

        CreateTeamRequest request = new CreateTeamRequest("1st XI", null);

        assertThatThrownBy(() -> teamService.create(clubId, sectionId, request))
                .isInstanceOf(NotFoundException.class);
        verify(teamRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void createWithALogoUrlSetsItOnTheEntity() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        CreateTeamRequest request = new CreateTeamRequest("1st XI", "https://example.com/logo.png");
        Team mapped = new Team();
        when(teamMapper.toEntity(request)).thenReturn(mapped);
        when(teamRepository.save(mapped)).thenReturn(mapped);
        when(teamMapper.toDto(mapped)).thenReturn(dummyDto());

        teamService.create(clubId, sectionId, request);

        assertThat(mapped.getLogoUrl()).isEqualTo("https://example.com/logo.png");
    }

    // --- update ---

    @Test
    void updateAppliesTheNewNameOntoTheExistingEntity() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        Team existing = team(teamId, sectionId, true);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(existing));
        when(teamRepository.save(existing)).thenReturn(existing);
        when(teamMapper.toDto(existing)).thenReturn(dummyDto());

        teamService.update(clubId, sectionId, teamId, new UpdateTeamRequest("2nd XI", null));

        assertThat(existing.getName()).isEqualTo("2nd XI");
    }

    @Test
    void updateSetsANewLogoUrlOverride() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        Team existing = team(teamId, sectionId, true);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(existing));
        when(teamRepository.save(existing)).thenReturn(existing);
        when(teamMapper.toDto(existing)).thenReturn(dummyDto());

        teamService.update(clubId, sectionId, teamId, new UpdateTeamRequest("1st XI", "https://example.com/logo.png"));

        assertThat(existing.getLogoUrl()).isEqualTo("https://example.com/logo.png");
    }

    @Test
    void updateWithANullLogoUrlClearsAnExistingOverride() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        Team existing = team(teamId, sectionId, true);
        existing.setLogoUrl("https://example.com/old-logo.png");
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(existing));
        when(teamRepository.save(existing)).thenReturn(existing);
        when(teamMapper.toDto(existing)).thenReturn(dummyDto());

        teamService.update(clubId, sectionId, teamId, new UpdateTeamRequest("1st XI", null));

        assertThat(existing.getLogoUrl()).isNull();
    }

    @Test
    void updateOnASectionBelongingToADifferentClubThrowsNotFoundExceptionWithoutLoadingTheTeam() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, otherClubId)));

        assertThatThrownBy(
                        () -> teamService.update(clubId, sectionId, teamId, new UpdateTeamRequest("2nd XI", null)))
                .isInstanceOf(NotFoundException.class);
        verify(teamRepository, never()).findById(ArgumentMatchers.any());
    }

    @Test
    void updateOnATeamBelongingToADifferentSectionThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID otherSectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, otherSectionId, true)));

        assertThatThrownBy(
                        () -> teamService.update(clubId, sectionId, teamId, new UpdateTeamRequest("2nd XI", null)))
                .isInstanceOf(NotFoundException.class);
        verify(teamRepository, never()).save(ArgumentMatchers.any());
    }

    // --- deactivate/reactivate: plain one-way-transition-guard shape, no hard-delete branch ---

    @Test
    void deactivateOnAnActiveTeamTransitionsToInactive() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        Team existing = team(teamId, sectionId, true);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(existing));
        when(teamRepository.save(existing)).thenReturn(existing);
        when(teamMapper.toDto(existing)).thenReturn(dummyDto());

        teamService.deactivate(clubId, sectionId, teamId);

        assertThat(existing.isActive()).isFalse();
        verify(teamRepository, never()).delete(ArgumentMatchers.any());
    }

    @Test
    void deactivateOnAlreadyInactiveTeamThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId, false)));

        assertThatThrownBy(() -> teamService.deactivate(clubId, sectionId, teamId))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .hasMessageContaining("already inactive");
        verify(teamRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void reactivateOnAnInactiveTeamTransitionsToActive() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        Team existing = team(teamId, sectionId, false);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(existing));
        when(teamRepository.save(existing)).thenReturn(existing);
        when(teamMapper.toDto(existing)).thenReturn(dummyDto());

        teamService.reactivate(clubId, sectionId, teamId);

        assertThat(existing.isActive()).isTrue();
    }

    @Test
    void reactivateOnAlreadyActiveTeamThrowsInvalidStatusTransitionException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId, true)));

        assertThatThrownBy(() -> teamService.reactivate(clubId, sectionId, teamId))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .hasMessageContaining("already active");
        verify(teamRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void deactivateOnATeamBelongingToADifferentSectionThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID otherSectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, otherSectionId, true)));

        assertThatThrownBy(() -> teamService.deactivate(clubId, sectionId, teamId))
                .isInstanceOf(NotFoundException.class);
    }

    // --- list ---

    @Test
    void listBySectionMapsEveryTeamUnderTheSectionAndValidatesSectionOwnership() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        Team a = team(UUID.randomUUID(), sectionId, true);
        Team b = team(UUID.randomUUID(), sectionId, false);
        when(teamRepository.findByClubIdAndSectionId(clubId, sectionId)).thenReturn(List.of(a, b));
        when(teamMapper.toDto(a)).thenReturn(dummyDto());
        when(teamMapper.toDto(b)).thenReturn(dummyDto());

        List<TeamDto> result = teamService.listBySection(clubId, sectionId);

        assertThat(result).hasSize(2);
    }

    @Test
    void listBySectionOnASectionBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, otherClubId)));

        assertThatThrownBy(() -> teamService.listBySection(clubId, sectionId))
                .isInstanceOf(NotFoundException.class);
        verify(teamRepository, never()).findByClubIdAndSectionId(ArgumentMatchers.any(), ArgumentMatchers.any());
    }

    @Test
    void listByClubMapsEveryTeamAcrossMultipleSectionsWithoutAnySectionCheck() {
        UUID clubId = UUID.randomUUID();
        UUID sectionOneId = UUID.randomUUID();
        UUID sectionTwoId = UUID.randomUUID();
        Team a = team(UUID.randomUUID(), sectionOneId, true);
        Team b = team(UUID.randomUUID(), sectionTwoId, true);
        when(teamRepository.findByClubId(clubId)).thenReturn(List.of(a, b));
        when(teamMapper.toDto(a)).thenReturn(dummyDto());
        when(teamMapper.toDto(b)).thenReturn(dummyDto());

        List<TeamDto> result = teamService.listByClub(clubId);

        assertThat(result).hasSize(2);
        verify(sectionRepository, never()).findById(ArgumentMatchers.any());
    }
}
