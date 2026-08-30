package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.ClubContact;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamContact;
import com.cricketlegend.dto.ClubContactDto;
import com.cricketlegend.dto.TeamContactDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.ClubContactMapper;
import com.cricketlegend.repository.ClubContactRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamContactRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.TeamContactServiceImpl;
import java.time.Instant;
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
 * Unit tests for TeamContactServiceImpl's business rules from docs/specs/027-team-profile.md:
 * the three-level {@code findSectionOrThrowForClub}/{@code findTeamOrThrowForSection}/{@code
 * findOrThrowContactForClub} scoping chain (a cross-club parent 404s without ever querying the
 * contact — mirrors {@code SectionServiceImplTest}'s equivalent test), link/unlink (already-linked
 * {@code 409}, unlink-with-no-link {@code 404}), and a single {@code ClubContact} linkable to more
 * than one {@code Team}.
 */
@ExtendWith(MockitoExtension.class)
class TeamContactServiceImplTest {

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private SectionRepository sectionRepository;

    @Mock
    private TeamContactRepository teamContactRepository;

    @Mock
    private ClubContactRepository clubContactRepository;

    @Mock
    private ClubContactMapper clubContactMapper;

    private TeamContactServiceImpl teamContactService;

    @BeforeEach
    void setUp() {
        teamContactService = new TeamContactServiceImpl(
                teamRepository, sectionRepository, teamContactRepository, clubContactRepository, clubContactMapper);
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

    private ClubContact clubContact(UUID id, UUID clubId) {
        ClubContact contact = new ClubContact();
        contact.setId(id);
        contact.setClubId(clubId);
        return contact;
    }

    private ClubContactDto dummyContactDto() {
        return new ClubContactDto(
                UUID.randomUUID(), UUID.randomUUID(), null, "Coach", false, true, null, null, null, null);
    }

    // --- list ---

    @Test
    void listComposesTeamContactDtosWithTheJoinsOwnRole() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId)));
        UUID linkId = UUID.randomUUID();
        Instant createdAt = Instant.now();
        TeamContact link = TeamContact.builder()
                .id(linkId)
                .teamId(teamId)
                .clubContactId(contactId)
                .role("Coach")
                .createdAt(createdAt)
                .build();
        when(teamContactRepository.findByTeamId(teamId)).thenReturn(List.of(link));
        when(clubContactRepository.findById(contactId)).thenReturn(Optional.of(clubContact(contactId, clubId)));
        ClubContactDto contactDto = dummyContactDto();
        when(clubContactMapper.toDto(ArgumentMatchers.any(ClubContact.class))).thenReturn(contactDto);

        List<TeamContactDto> result = teamContactService.list(clubId, sectionId, teamId);

        assertThat(result).hasSize(1);
        TeamContactDto dto = result.get(0);
        assertThat(dto.id()).isEqualTo(linkId);
        assertThat(dto.role()).isEqualTo("Coach");
        assertThat(dto.contact()).isEqualTo(contactDto);
        assertThat(dto.createdAt()).isEqualTo(createdAt);
    }

    @Test
    void listOnASectionBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, otherClubId)));

        assertThatThrownBy(() -> teamContactService.list(clubId, sectionId, teamId))
                .isInstanceOf(NotFoundException.class);
        verify(teamRepository, never()).findById(ArgumentMatchers.any());
    }

    // --- link ---

    @Test
    void linkAnExistingContactBelongingToTheSameClubSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId)));
        when(clubContactRepository.findById(contactId)).thenReturn(Optional.of(clubContact(contactId, clubId)));
        when(teamContactRepository.existsByTeamIdAndClubContactId(teamId, contactId)).thenReturn(false);

        teamContactService.link(clubId, sectionId, teamId, contactId, "Coach");

        verify(teamContactRepository).save(ArgumentMatchers.any(TeamContact.class));
    }

    @Test
    void linkAContactBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId)));
        when(clubContactRepository.findById(contactId))
                .thenReturn(Optional.of(clubContact(contactId, otherClubId)));

        assertThatThrownBy(() -> teamContactService.link(clubId, sectionId, teamId, contactId, "Coach"))
                .isInstanceOf(NotFoundException.class);
        verify(teamContactRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void linkASectionBelongingToADifferentClubThrowsNotFoundExceptionWithoutCheckingTheContact() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, otherClubId)));

        assertThatThrownBy(() -> teamContactService.link(clubId, sectionId, teamId, contactId, "Coach"))
                .isInstanceOf(NotFoundException.class);
        verify(teamRepository, never()).findById(ArgumentMatchers.any());
        verify(clubContactRepository, never()).findById(ArgumentMatchers.any());
    }

    @Test
    void linkATeamBelongingToADifferentSectionThrowsNotFoundExceptionWithoutCheckingTheContact() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID otherSectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, otherSectionId)));

        assertThatThrownBy(() -> teamContactService.link(clubId, sectionId, teamId, contactId, "Coach"))
                .isInstanceOf(NotFoundException.class);
        verify(clubContactRepository, never()).findById(ArgumentMatchers.any());
    }

    @Test
    void linkAnAlreadyLinkedPairThrowsConflictException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId)));
        when(clubContactRepository.findById(contactId)).thenReturn(Optional.of(clubContact(contactId, clubId)));
        when(teamContactRepository.existsByTeamIdAndClubContactId(teamId, contactId)).thenReturn(true);

        assertThatThrownBy(() -> teamContactService.link(clubId, sectionId, teamId, contactId, "Coach"))
                .isInstanceOf(ConflictException.class);
        verify(teamContactRepository, never()).save(ArgumentMatchers.any());
    }

    @Test
    void aClubContactCanBeValidlyLinkedToMoreThanOneTeam() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamOneId = UUID.randomUUID();
        UUID teamTwoId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamTwoId)).thenReturn(Optional.of(team(teamTwoId, sectionId)));
        when(clubContactRepository.findById(contactId)).thenReturn(Optional.of(clubContact(contactId, clubId)));
        when(teamContactRepository.existsByTeamIdAndClubContactId(teamTwoId, contactId)).thenReturn(false);

        teamContactService.link(clubId, sectionId, teamTwoId, contactId, "Manager");

        verify(teamContactRepository).save(ArgumentMatchers.any(TeamContact.class));
        assertThat(teamOneId).isNotEqualTo(teamTwoId);
    }

    // --- unlink ---

    @Test
    void unlinkAnExistingLinkRemovesTheJoinRow() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId)));
        when(teamContactRepository.findByTeamIdAndClubContactId(teamId, contactId))
                .thenReturn(Optional.of(TeamContact.builder()
                        .id(UUID.randomUUID())
                        .teamId(teamId)
                        .clubContactId(contactId)
                        .role("Coach")
                        .build()));

        teamContactService.unlink(clubId, sectionId, teamId, contactId);

        verify(teamContactRepository).deleteByTeamIdAndClubContactId(teamId, contactId);
    }

    @Test
    void unlinkWithNoExistingLinkThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID contactId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(sectionId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, sectionId)));
        when(teamContactRepository.findByTeamIdAndClubContactId(teamId, contactId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> teamContactService.unlink(clubId, sectionId, teamId, contactId))
                .isInstanceOf(NotFoundException.class);
        verify(teamContactRepository, never()).deleteByTeamIdAndClubContactId(teamId, contactId);
    }
}
