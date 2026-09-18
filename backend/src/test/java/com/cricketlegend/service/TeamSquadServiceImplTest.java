package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.Gender;
import com.cricketlegend.domain.Person;
import com.cricketlegend.domain.PersonStatus;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.dto.TeamSquadMemberDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.DuplicateSquadJerseyNumberException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PlayerNotActiveClubMemberException;
import com.cricketlegend.exception.ValidationException;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Unit tests for TeamSquadServiceImpl's business rules from docs/specs/029-league-management.md:
 * add/remove, the not-a-real-player 404, the inactive-player {@link
 * PlayerNotActiveClubMemberException}, the already-in-squad 409, and — per this spec's own
 * pre-build season-scoping amendment — a player addable to a team's squad for season A and
 * independently for season B, with removal from one season having no effect on the other. Also
 * covers docs/specs/031-jersey-numbers.md: {@code add} copying the player's current standing
 * jersey number into the new row at creation time only, and the new {@code update} (jersey-number
 * only) business rules — happy path, 404/400/409, and independence from {@code PlayerProfile} and
 * other seasons' rows.
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

    @Mock
    private AccessService accessService;

    private TeamSquadServiceImpl service;
    private final Authentication authentication = new TestingAuthenticationToken(
            "club-admin-subject", null, List.of(new SimpleGrantedAuthority("ROLE_someone_else")));

    @BeforeEach
    void setUp() {
        service = new TeamSquadServiceImpl(
                teamRepository, seasonRepository, playerProfileRepository, personRepository,
                playerSectionRepository, teamSquadMemberRepository, playerMapper, accessService);
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
        when(teamSquadMemberRepository.save(any(TeamSquadMember.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        stubPlayerLookup(profile);

        service.add(authentication, clubId, teamId, seasonId, profile.getId());

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

        assertThatThrownBy(() -> service.add(authentication, clubId, teamId, seasonId, profile.getId()))
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

        assertThatThrownBy(() -> service.add(authentication, clubId, teamId, seasonId, profile.getId()))
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

        assertThatThrownBy(() -> service.add(authentication, clubId, teamId, seasonId, profile.getId()))
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
        when(teamSquadMemberRepository.save(any(TeamSquadMember.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        stubPlayerLookup(profile);

        service.add(authentication, clubId, teamId, seasonBId, profile.getId());

        verify(teamSquadMemberRepository).save(any(TeamSquadMember.class));
    }

    @Test
    void addCopiesTheCurrentPlayerProfileJerseyNumberIntoTheNewRowsJerseyNumberAtCreationTimeOnly() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        PlayerProfile profile = playerProfile(UUID.randomUUID(), clubId, true);
        profile.setJerseyNumber(7);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(playerProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(
                teamId, seasonId, profile.getId())).thenReturn(false);
        when(teamSquadMemberRepository.save(any(TeamSquadMember.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        stubPlayerLookup(profile);

        service.add(authentication, clubId, teamId, seasonId, profile.getId());

        ArgumentCaptor<TeamSquadMember> captor = ArgumentCaptor.forClass(TeamSquadMember.class);
        verify(teamSquadMemberRepository).save(captor.capture());
        assertThat(captor.getValue().getJerseyNumber()).isEqualTo(7);

        // Changing the profile's standing number afterward never retroactively changes the
        // already-created squad row's own value — the copy was a plain value, not a reference.
        profile.setJerseyNumber(99);
        assertThat(captor.getValue().getJerseyNumber()).isEqualTo(7);
    }

    @Test
    void addNeverChecksJerseyNumberUniquenessEvenWhenTheCopiedValueWouldCollide() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        PlayerProfile profile = playerProfile(UUID.randomUUID(), clubId, true);
        profile.setJerseyNumber(7);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(playerProfileRepository.findById(profile.getId())).thenReturn(Optional.of(profile));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndPlayerProfileId(
                teamId, seasonId, profile.getId())).thenReturn(false);
        when(teamSquadMemberRepository.save(any(TeamSquadMember.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        stubPlayerLookup(profile);

        service.add(authentication, clubId, teamId, seasonId, profile.getId());

        verify(teamSquadMemberRepository, never())
                .existsByTeamIdAndSeasonIdAndJerseyNumberAndIdNot(any(), any(), any(), any());
    }

    // --- update ---

    @Test
    void updateSetsTheNewJerseyNumberAndReturnsItAsSquadJerseyNumber() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();
        TeamSquadMember member = TeamSquadMember.builder().id(memberId).teamId(teamId).seasonId(seasonId)
                .playerProfileId(playerId).jerseyNumber(3).build();
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(teamSquadMemberRepository.findByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId))
                .thenReturn(Optional.of(member));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndJerseyNumberAndIdNot(
                teamId, seasonId, 9, memberId)).thenReturn(false);
        when(teamSquadMemberRepository.save(any(TeamSquadMember.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        PlayerProfile profile = playerProfile(playerId, clubId, true);
        stubPlayerLookup(profile);
        when(playerMapper.toSquadMemberDto(any(), any(), any(), any())).thenReturn(new TeamSquadMemberDto(
                memberId, playerId, profile.getPersonId(), clubId, "Joe", "Bloggs", null, Gender.MALE,
                null, null, null, null, null, null, null, null, null, null, null, false, true,
                List.of(), null, 9));

        var dto = service.update(authentication, clubId, teamId, seasonId, playerId, 9);

        verify(teamSquadMemberRepository).save(any(TeamSquadMember.class));
        assertThat(member.getJerseyNumber()).isEqualTo(9);
        assertThat(dto.squadJerseyNumber()).isEqualTo(9);
    }

    @Test
    void updateForAPlayerNotCurrentlyInThatSeasonsSquadThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(teamSquadMemberRepository.findByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(authentication, clubId, teamId, seasonId, playerId, 9))
                .isInstanceOf(NotFoundException.class);
        verify(teamSquadMemberRepository, never()).save(any());
    }

    @Test
    void updateWithANegativeJerseyNumberThrowsValidationException() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        TeamSquadMember member = TeamSquadMember.builder().id(UUID.randomUUID()).teamId(teamId)
                .seasonId(seasonId).playerProfileId(playerId).build();
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(teamSquadMemberRepository.findByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId))
                .thenReturn(Optional.of(member));

        assertThatThrownBy(() -> service.update(authentication, clubId, teamId, seasonId, playerId, -1))
                .isInstanceOf(ValidationException.class);
        verify(teamSquadMemberRepository, never()).save(any());
    }

    @Test
    void updateToANumberAnotherSquadMemberAlreadyHoldsThrowsDuplicateSquadJerseyNumberException() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();
        TeamSquadMember member = TeamSquadMember.builder().id(memberId).teamId(teamId).seasonId(seasonId)
                .playerProfileId(playerId).build();
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(teamSquadMemberRepository.findByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId))
                .thenReturn(Optional.of(member));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndJerseyNumberAndIdNot(
                teamId, seasonId, 5, memberId)).thenReturn(true);

        assertThatThrownBy(() -> service.update(authentication, clubId, teamId, seasonId, playerId, 5))
                .isInstanceOf(DuplicateSquadJerseyNumberException.class);
        verify(teamSquadMemberRepository, never()).save(any());
    }

    @Test
    void updatingASquadMembersJerseyNumberNeverTouchesThePlayerProfileOrAnotherSeasonsRow() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();
        TeamSquadMember member = TeamSquadMember.builder().id(memberId).teamId(teamId).seasonId(seasonId)
                .playerProfileId(playerId).jerseyNumber(3).build();
        PlayerProfile profile = playerProfile(playerId, clubId, true);
        profile.setJerseyNumber(3);
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(teamSquadMemberRepository.findByTeamIdAndSeasonIdAndPlayerProfileId(teamId, seasonId, playerId))
                .thenReturn(Optional.of(member));
        when(teamSquadMemberRepository.existsByTeamIdAndSeasonIdAndJerseyNumberAndIdNot(
                teamId, seasonId, 9, memberId)).thenReturn(false);
        when(teamSquadMemberRepository.save(any(TeamSquadMember.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        stubPlayerLookup(profile);

        service.update(authentication, clubId, teamId, seasonId, playerId, 9);

        assertThat(member.getJerseyNumber()).isEqualTo(9);
        assertThat(profile.getJerseyNumber()).isEqualTo(3);
        verify(playerProfileRepository, never()).save(any());
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

        service.remove(authentication, clubId, teamId, seasonAId, playerId);

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

        assertThatThrownBy(() -> service.remove(authentication, clubId, teamId, seasonId, playerId))
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

        service.list(authentication, clubId, teamId, seasonId);

        verify(playerProfileRepository).findById(profile.getId());
    }

    // --- 035: section-scoped access ---

    @Test
    void addThrowsAccessDeniedWhenCallerCannotAdministerTheTeamsSection() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Team team = team(teamId, clubId);
        team.setSectionId(UUID.randomUUID());
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        org.mockito.Mockito.doThrow(new org.springframework.security.access.AccessDeniedException("denied"))
                .when(accessService)
                .assertCanAdministerSection(authentication, clubId, team.getSectionId());

        assertThatThrownBy(() -> service.add(authentication, clubId, teamId, seasonId, UUID.randomUUID()))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(teamSquadMemberRepository, never()).save(any());
    }
}
