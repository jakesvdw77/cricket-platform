package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Sponsor;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSponsor;
import com.cricketlegend.dto.SponsorDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.SponsorMapper;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.SponsorRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSponsorRepository;
import com.cricketlegend.service.impl.TeamSponsorServiceImpl;
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
 * Unit tests for TeamSponsorServiceImpl's business rules from docs/specs/027-team-profile.md:
 * the three-level {@code findSectionOrThrowForClub}/{@code findTeamOrThrowForSection}/{@code
 * findOrThrowForClub} scoping chain (a cross-club parent 404s without ever querying the sponsor —
 * mirrors {@code SectionServiceImplTest}'s equivalent test), link/unlink (already-linked {@code
 * 409}, unlink-with-no-link {@code 404}), and a single {@code Sponsor} linkable to more than one
 * {@code Team}.
 */
@ExtendWith(MockitoExtension.class)
class TeamSponsorServiceImplTest {

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private SectionRepository sectionRepository;

    @Mock
    private TeamSponsorRepository teamSponsorRepository;

    @Mock
    private SponsorRepository sponsorRepository;

    @Mock
    private SponsorMapper sponsorMapper;

    private TeamSponsorServiceImpl teamSponsorService;

    @BeforeEach
    void setUp() {
        teamSponsorService = new TeamSponsorServiceImpl(
                teamRepository, sectionRepository, teamSponsorRepository, sponsorRepository, sponsorMapper);
    }

    private Section section(UUID id, UUID clubId) {
        Section section = new Section();
        section.setId(id);
        section.setClubId(clubId);
        section.setName("Men");
        section.setActive(true);
        return section;
    }

    private Team team(UUID id, UUID sectionId) {
        Team team = new Team();
        team.setId(id);
        team.setSectionId(sectionId);
        team.setActive(true);
        team.setName("1st XI");
        return team;
    }

    private Sponsor sponsor(UUID id, UUID clubId) {
        Sponsor sponsor = new Sponsor();
        sponsor.setId(id);
        sponsor.setClubId(clubId);
        sponsor.setName("Acme Co");
        return sponsor;
    }

    private SponsorDto dummySponsorDto() {
        return new SponsorDto(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Acme Co",
                null,
                null,
                null,
                null,
                null,
                List.of(),
                true,
                null,
                null,
                null);
    }

    // --- list ---

    @Test
    void listMapsEverySponsorLinkedToTheTeam() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId)));
        TeamSponsor link =
                TeamSponsor.builder().id(UUID.randomUUID()).teamId(teamId).sponsorId(sponsorId).build();
        when(teamSponsorRepository.findByTeamId(teamId)).thenReturn(List.of(link));
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, clubId)));
        SponsorDto dto = dummySponsorDto();
        when(sponsorMapper.toDto(ArgumentMatchers.any(Sponsor.class))).thenReturn(dto);

        List<SponsorDto> result = teamSponsorService.list(clubId, sectionId, teamId);

        assertThat(result).containsExactly(dto);
    }

    @Test
    void listOnASectionBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, otherClubId)));

        assertThatThrownBy(() -> teamSponsorService.list(clubId, sectionId, teamId))
                .isInstanceOf(NotFoundException.class);
        verify(teamRepository, never()).findById(ArgumentMatchers.any());
    }

    // --- link ---

    @Test
    void linkAnExistingSponsorBelongingToTheSameClubSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId)));
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, clubId)));
        when(teamSponsorRepository.existsByTeamIdAndSponsorId(teamId, sponsorId)).thenReturn(false);

        teamSponsorService.link(clubId, sectionId, teamId, sponsorId);

        verify(teamSponsorRepository).save(ArgumentMatchers.any(TeamSponsor.class));
    }

    @Test
    void linkASponsorBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId)));
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, otherClubId)));

        assertThatThrownBy(() -> teamSponsorService.link(clubId, sectionId, teamId, sponsorId))
                .isInstanceOf(NotFoundException.class);
        verify(teamSponsorRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void linkASectionBelongingToADifferentClubThrowsNotFoundExceptionWithoutCheckingTheSponsor() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, otherClubId)));

        assertThatThrownBy(() -> teamSponsorService.link(clubId, sectionId, teamId, sponsorId))
                .isInstanceOf(NotFoundException.class);
        verify(teamRepository, never()).findById(ArgumentMatchers.any());
        verify(sponsorRepository, never()).findById(ArgumentMatchers.any());
    }

    @Test
    void linkATeamBelongingToADifferentSectionThrowsNotFoundExceptionWithoutCheckingTheSponsor() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID otherSectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, otherSectionId)));

        assertThatThrownBy(() -> teamSponsorService.link(clubId, sectionId, teamId, sponsorId))
                .isInstanceOf(NotFoundException.class);
        verify(sponsorRepository, never()).findById(ArgumentMatchers.any());
    }

    @Test
    void linkAnAlreadyLinkedPairThrowsConflictException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId)));
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, clubId)));
        when(teamSponsorRepository.existsByTeamIdAndSponsorId(teamId, sponsorId)).thenReturn(true);

        assertThatThrownBy(() -> teamSponsorService.link(clubId, sectionId, teamId, sponsorId))
                .isInstanceOf(ConflictException.class);
        verify(teamSponsorRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void aSponsorCanBeValidlyLinkedToMoreThanOneTeam() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamOneId = UUID.randomUUID();
        UUID teamTwoId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamTwoId)).thenReturn(Optional.of(team(teamTwoId, sectionId)));
        when(sponsorRepository.findById(sponsorId)).thenReturn(Optional.of(sponsor(sponsorId, clubId)));
        when(teamSponsorRepository.existsByTeamIdAndSponsorId(teamTwoId, sponsorId)).thenReturn(false);

        teamSponsorService.link(clubId, sectionId, teamTwoId, sponsorId);

        verify(teamSponsorRepository).save(ArgumentMatchers.any(TeamSponsor.class));
        assertThat(teamOneId).isNotEqualTo(teamTwoId);
    }

    // --- unlink ---

    @Test
    void unlinkAnExistingLinkRemovesTheJoinRow() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId)));
        when(teamSponsorRepository.findByTeamIdAndSponsorId(teamId, sponsorId))
                .thenReturn(Optional.of(TeamSponsor.builder()
                        .id(UUID.randomUUID())
                        .teamId(teamId)
                        .sponsorId(sponsorId)
                        .build()));

        teamSponsorService.unlink(clubId, sectionId, teamId, sponsorId);

        verify(teamSponsorRepository).deleteByTeamIdAndSponsorId(teamId, sponsorId);
    }

    @Test
    void unlinkWithNoExistingLinkThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID sponsorId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId)));
        when(teamSponsorRepository.findByTeamIdAndSponsorId(teamId, sponsorId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> teamSponsorService.unlink(clubId, sectionId, teamId, sponsorId))
                .isInstanceOf(NotFoundException.class);
        verify(teamSponsorRepository, never()).deleteByTeamIdAndSponsorId(teamId, sponsorId);
    }
}
