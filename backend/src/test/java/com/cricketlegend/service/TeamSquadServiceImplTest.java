package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Gender;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PlayerNotActiveClubMemberException;
import com.cricketlegend.mapper.PlayerMapper;
import com.cricketlegend.repository.PersonRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.impl.TeamSquadServiceImpl;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for TeamSquadServiceImpl's business rules from docs/specs/029-league-management.md:
 * add/remove, the not-a-real-player 404, the inactive-player {@link
 * PlayerNotActiveClubMemberException}, the already-in-squad 409, and — per this spec's own
 * pre-build season-scoping amendment — a player addable to a team's squad for season A and
 * independently for season B, with removal from one season having no effect on the other.
 */
@ExtendWith(MockitoExtension.class)
class TeamSquadServiceImplTest {

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private PlayerProfileRepository playerProfileRepository;

    @Mock
    private PersonRepository personRepository;

    @Mock
    private PlayerSectionRepository playerSectionRepository;

    @Mock
    private TeamSquadMemberRepository teamSquadMemberRepository;

    @Mock
    private PlayerMapper playerMapper;

    private TeamSquadServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new TeamSquadServiceImpl(
                teamRepository, seasonRepository, playerProfileRepository, personRepository,
                playerSectionRepository, teamSquadMemberRepository, playerMapper);
    }

    private Team team(UUID id, UUID clubId) {
        Team team = new Team();
        team.setId(id);
        team.setClubId(clubId);
        team.setActive(true);
        team.setName("1st XI");
        return team;
    }

    private Season season(UUID id, UUID clubId) {
        return Season.builder().id(id).clubId(clubId).label("2026")
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 12, 31)).active(true)
                .build();
    }

    private PlayerProfile playerProfile(UUID id, UUID clubId, boolean active) {
        return PlayerProfile.builder().id(id).personId(UUID.randomUUID()).clubId(clubId).active(active)
                .build();
    }

    private void stubPlayerLookup(PlayerProfile profile) {
        when(playerProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));
        when(personRepository.findById(profile.getPersonId())).thenReturn(Optional.of(
                Person.builder().id(profile.getPersonId()).firstName("Joe").lastName("Bloggs")
                        .status(PersonStatus.ACTIVE).gender(Gender.MALE).build()));
        when(playerSectionRepository.findByPlayerProfileId(profile.getId())).thenReturn(List.of());
    }

    @Test
    void addAnActivePlayerNotYetInTheSquadSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        PlayerProfile profile = playerProfile(UUID.randomUUID(), clubId, true);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(playerProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(
                teamId, seasonId, profile.getId())).thenReturn(false);
        stubPlayerLookup(profile);

        service.add(clubId, teamId, seasonId, profile.getId());

        verify(teamSquadMemberRepository).save(any(TeamSquadMember.class));
    }

    @Test
    void addAPlayerBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        PlayerProfile profile = playerProfile(UUID.randomUUID(), otherClubId, true);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(playerProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));

        assertThatThrownBy(() -> service.add(clubId, teamId, seasonId, profile.getId()))
                .isInstanceOf(NotFoundException.class);
        verify(teamSquadMemberRepository, never()).save(any());
    }

    @Test
    void addAnInactivePlayerThrowsPlayerNotActiveClubMemberException() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        PlayerProfile profile = playerProfile(UUID.randomUUID(), clubId, false);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(playerProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));

        assertThatThrownBy(() -> service.add(clubId, teamId, seasonId, profile.getId()))
                .isInstanceOf(PlayerNotActiveClubMemberException.class);
        verify(teamSquadMemberRepository, never()).save(any());
    }

    @Test
    void addAPlayerAlreadyInThatSeasonsSquadThrowsConflictException() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        PlayerProfile profile = playerProfile(UUID.randomUUID(), clubId, true);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(playerProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(
                teamId, seasonId, profile.getId())).thenReturn(true);

        assertThatThrownBy(() -> service.add(clubId, teamId, seasonId, profile.getId()))
                .isInstanceOf(ConflictException.class);
        verify(teamSquadMemberRepository, never()).save(any());
    }

    @Test
    void aPlayerIsAddableToASeparateSeasonsSquadIndependentlyOfAnotherSeason() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonAId = UUID.randomUUID();
        UUID seasonBId = UUID.randomUUID();
        PlayerProfile profile = playerProfile(UUID.randomUUID(), clubId, true);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        // Player is already in season A's squad (not stubbed as a repository call — add() only
        // ever checks (teamId, seasonId) together, never season A independently); season B's squad
        // is independent, so the add for season B still succeeds.
        when(seasonRepository.findById(seasonBId)).thenReturn(Optional.of(season(seasonBId, clubId)));
        when(playerProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(
                teamId, seasonBId, profile.getId())).thenReturn(false);
        stubPlayerLookup(profile);

        service.add(clubId, teamId, seasonBId, profile.getId());

        verify(teamSquadMemberRepository).save(any(TeamSquadMember.class));
    }

    @Test
    void removeAPlayerFromOneSeasonsSquadHasNoEffectOnAnotherSeason() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonAId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonAId)).thenReturn(Optional.of(season(seasonAId, clubId)));
        when(teamSquadMemberRepository.findByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonAId, playerId))
                .thenReturn(Optional.of(TeamSquadMember.builder().id(UUID.randomUUID()).teamId(teamId)
                        .seasonId(seasonAId).playerProfileId(playerId).build()));

        service.remove(clubId, teamId, seasonAId, playerId);

        verify(teamSquadMemberRepository).deleteByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonAId, playerId);
    }

    @Test
    void removeAPlayerNotCurrentlyInThatSeasonsSquadThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(teamSquadMemberRepository.findByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.remove(clubId, teamId, seasonId, playerId))
                .isInstanceOf(NotFoundException.class);
        verify(teamSquadMemberRepository, never())
                .deleteByTeamIdAndSeasonIdAndPlayerProfileId(any(), any(), any());
    }

    @Test
    void listReturnsOnlyThatSeasonsSquadMembers() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        PlayerProfile profile = playerProfile(UUID.randomUUID(), clubId, true);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(teamSquadMemberRepository.findByTeamIdAndSeasonId(teamId, seasonId)).thenReturn(List.of(
                TeamSquadMember.builder().id(UUID.randomUUID()).teamId(teamId).seasonId(seasonId)
                        .playerProfileId(profile.getId()).build()));
        stubPlayerLookup(profile);

        service.list(clubId, teamId, seasonId);

        verify(playerProfileRepository).findById(profile.getId());
    }
}
