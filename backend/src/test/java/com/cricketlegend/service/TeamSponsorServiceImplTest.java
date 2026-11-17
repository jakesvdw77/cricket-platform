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
                null,
                false);
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

    // --- main sponsor (docs/specs/158-main-sponsor.md) ---

    private SponsorDto named(String name) {
        return new SponsorDto(UUID.randomUUID(), UUID.randomUUID(), name, null, null, null, null, null, List.of(), true, null, null, null, false);
    }

    private void teamInClub(UUID clubId, UUID sectionId, UUID teamId) {
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId)));
    }

    @Test
    void listPutsTheMainSponsorFirstThenTheRestByNameIgnoringCase() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        teamInClub(clubId, sectionId, teamId);
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        when(teamSponsorRepository.findByTeamId(teamId)).thenReturn(List.of(
                TeamSponsor.builder().teamId(teamId).sponsorId(a).build(),
                TeamSponsor.builder().teamId(teamId).sponsorId(b).isMain(true).build(),
                TeamSponsor.builder().teamId(teamId).sponsorId(c).build()));
        Sponsor sa = sponsor(a, clubId);
        Sponsor sb = sponsor(b, clubId);
        Sponsor sc = sponsor(c, clubId);
        when(sponsorRepository.findById(a)).thenReturn(Optional.of(sa));
        when(sponsorRepository.findById(b)).thenReturn(Optional.of(sb));
        when(sponsorRepository.findById(c)).thenReturn(Optional.of(sc));
        when(sponsorMapper.toDto(sa)).thenReturn(named("zeta Foods"));
        when(sponsorMapper.toDto(sb)).thenReturn(named("Porsche"));
        when(sponsorMapper.toDto(sc)).thenReturn(named("Alpha Bank"));

        List<SponsorDto> result = teamSponsorService.list(clubId, sectionId, teamId);

        assertThat(result).extracting(SponsorDto::name).containsExactly("Porsche", "Alpha Bank", "zeta Foods");
        assertThat(result).extracting(SponsorDto::main).containsExactly(true, false, false);
    }

    @Test
    void makingASponsorMainClearsThePreviousMainOneFirstAndSetsTheNewOne() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        teamInClub(clubId, sectionId, teamId);
        UUID oldMain = UUID.randomUUID();
        UUID next = UUID.randomUUID();
        TeamSponsor oldLink = TeamSponsor.builder().teamId(teamId).sponsorId(oldMain).isMain(true).build();
        TeamSponsor nextLink = TeamSponsor.builder().teamId(teamId).sponsorId(next).build();
        when(teamSponsorRepository.findByTeamId(teamId)).thenReturn(List.of(oldLink, nextLink));

        teamSponsorService.setMain(clubId, sectionId, teamId, next, true);

        assertThat(oldLink.isMain()).isFalse();
        assertThat(nextLink.isMain()).isTrue();
        org.mockito.InOrder order = org.mockito.Mockito.inOrder(teamSponsorRepository);
        order.verify(teamSponsorRepository).saveAllAndFlush(List.of(oldLink, nextLink));
        order.verify(teamSponsorRepository).save(nextLink);
    }

    @Test
    void clearingTheMainFlagLeavesTheOthersAlone() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        teamInClub(clubId, sectionId, teamId);
        UUID main = UUID.randomUUID();
        TeamSponsor link = TeamSponsor.builder().teamId(teamId).sponsorId(main).isMain(true).build();
        when(teamSponsorRepository.findByTeamId(teamId)).thenReturn(List.of(link));

        teamSponsorService.setMain(clubId, sectionId, teamId, main, false);

        assertThat(link.isMain()).isFalse();
        verify(teamSponsorRepository).save(link);
        verify(teamSponsorRepository, never()).saveAllAndFlush(ArgumentMatchers.anyList());
    }

    @Test
    void settingTheStateItAlreadyHasChangesNothing() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        teamInClub(clubId, sectionId, teamId);
        UUID main = UUID.randomUUID();
        TeamSponsor link = TeamSponsor.builder().teamId(teamId).sponsorId(main).isMain(true).build();
        when(teamSponsorRepository.findByTeamId(teamId)).thenReturn(List.of(link));

        teamSponsorService.setMain(clubId, sectionId, teamId, main, true);

        verify(teamSponsorRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void makingAnUnlinkedSponsorMainIsNotFoundAndACrossClubParentNeverGetsThatFar() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        teamInClub(clubId, sectionId, teamId);
        when(teamSponsorRepository.findByTeamId(teamId)).thenReturn(List.of());
        assertThatThrownBy(() -> teamSponsorService.setMain(clubId, sectionId, teamId, UUID.randomUUID(), true)).isInstanceOf(NotFoundException.class);

        UUID otherSection = UUID.randomUUID();
        when(sectionRepository.findById(otherSection)).thenReturn(Optional.of(section(otherSection, UUID.randomUUID())));
        assertThatThrownBy(() -> teamSponsorService.setMain(clubId, otherSection, teamId, UUID.randomUUID(), true)).isInstanceOf(NotFoundException.class);
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
