package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.League;
import com.cricketlegend.domain.LeagueAffiliation;
import com.cricketlegend.domain.LeagueSource;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.CreateLeagueAffiliationRequest;
import com.cricketlegend.dto.LeagueAffiliationDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.mapper.LeagueAffiliationMapper;
import com.cricketlegend.repository.LeagueAffiliationRepository;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.LeagueAffiliationServiceImpl;
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
 * Unit tests for LeagueAffiliationServiceImpl's business rules from
 * docs/specs/029-league-management.md: the three same-club consistency checks (league/team/season
 * each independently 404 when mismatched), the triple-uniqueness 409, and unaffiliate's hard
 * delete + 404-when-missing.
 */
@ExtendWith(MockitoExtension.class)
class LeagueAffiliationServiceImplTest {

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private LeagueAffiliationRepository leagueAffiliationRepository;

    @Mock
    private LeagueAffiliationMapper leagueAffiliationMapper;

    private LeagueAffiliationServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new LeagueAffiliationServiceImpl(
                leagueRepository, teamRepository, seasonRepository, leagueAffiliationRepository,
                leagueAffiliationMapper);
    }

    private League league(UUID id, UUID clubId) {
        return League.builder().id(id).clubId(clubId).name("Premier League")
                .source(LeagueSource.INTERNAL).maxPlayingXiSize(11).active(true).build();
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

    @Test
    void createWithATeamAndSeasonBelongingToTheSameClubSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leagueAffiliationRepository.existsByLeagueIdAndTeamIdAndSeasonId(leagueId, teamId, seasonId))
                .thenReturn(false);
        when(leagueAffiliationRepository.save(any(LeagueAffiliation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(leagueAffiliationMapper.toDto(any(LeagueAffiliation.class))).thenReturn(
                new LeagueAffiliationDto(UUID.randomUUID(), leagueId, teamId, seasonId, null, null));

        CreateLeagueAffiliationRequest request = new CreateLeagueAffiliationRequest(teamId, seasonId);
        service.create(clubId, leagueId, request);

        verify(leagueAffiliationRepository).save(any(LeagueAffiliation.class));
    }

    @Test
    void createWithATeamBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, otherClubId)));

        CreateLeagueAffiliationRequest request = new CreateLeagueAffiliationRequest(teamId, seasonId);

        assertThatThrownBy(() -> service.create(clubId, leagueId, request))
                .isInstanceOf(NotFoundException.class);
        verify(leagueAffiliationRepository, never()).save(any());
    }

    @Test
    void createWithASeasonBelongingToADifferentClubThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, otherClubId)));

        CreateLeagueAffiliationRequest request = new CreateLeagueAffiliationRequest(teamId, seasonId);

        assertThatThrownBy(() -> service.create(clubId, leagueId, request))
                .isInstanceOf(NotFoundException.class);
        verify(leagueAffiliationRepository, never()).save(any());
    }

    @Test
    void createWithALeagueBelongingToADifferentClubThrowsNotFoundExceptionWithoutCheckingTeamOrSeason() {
        UUID clubId = UUID.randomUUID();
        UUID otherClubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, otherClubId)));

        CreateLeagueAffiliationRequest request = new CreateLeagueAffiliationRequest(teamId, seasonId);

        assertThatThrownBy(() -> service.create(clubId, leagueId, request))
                .isInstanceOf(NotFoundException.class);
        verify(teamRepository, never()).findById(any());
        verify(seasonRepository, never()).findById(any());
    }

    @Test
    void createAnAlreadyAffiliatedTripleThrowsConflictException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonId)).thenReturn(Optional.of(season(seasonId, clubId)));
        when(leagueAffiliationRepository.existsByLeagueIdAndTeamIdAndSeasonId(leagueId, teamId, seasonId))
                .thenReturn(true);

        CreateLeagueAffiliationRequest request = new CreateLeagueAffiliationRequest(teamId, seasonId);

        assertThatThrownBy(() -> service.create(clubId, leagueId, request))
                .isInstanceOf(ConflictException.class);
        verify(leagueAffiliationRepository, never()).save(any());
    }

    @Test
    void aTeamCanBeAffiliatedToTheSameLeagueAcrossDifferentSeasons() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonTwoId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team(teamId, clubId)));
        when(seasonRepository.findById(seasonTwoId)).thenReturn(Optional.of(season(seasonTwoId, clubId)));
        when(leagueAffiliationRepository.existsByLeagueIdAndTeamIdAndSeasonId(leagueId, teamId, seasonTwoId))
                .thenReturn(false);
        when(leagueAffiliationRepository.save(any(LeagueAffiliation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(leagueAffiliationMapper.toDto(any(LeagueAffiliation.class))).thenReturn(
                new LeagueAffiliationDto(UUID.randomUUID(), leagueId, teamId, seasonTwoId, null, null));

        CreateLeagueAffiliationRequest request = new CreateLeagueAffiliationRequest(teamId, seasonTwoId);
        service.create(clubId, leagueId, request);

        verify(leagueAffiliationRepository).save(any(LeagueAffiliation.class));
    }

    @Test
    void unaffiliateRemovesTheJoinRow() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID affiliationId = UUID.randomUUID();
        LeagueAffiliation affiliation =
                LeagueAffiliation.builder().id(affiliationId).leagueId(leagueId).teamId(UUID.randomUUID())
                        .seasonId(UUID.randomUUID()).build();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(leagueAffiliationRepository.findById(affiliationId)).thenReturn(Optional.of(affiliation));

        service.unaffiliate(clubId, leagueId, affiliationId);

        verify(leagueAffiliationRepository).delete(affiliation);
    }

    @Test
    void unaffiliateWithNoSuchAffiliationThrowsNotFoundException() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID affiliationId = UUID.randomUUID();
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(leagueAffiliationRepository.findById(affiliationId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.unaffiliate(clubId, leagueId, affiliationId))
                .isInstanceOf(NotFoundException.class);
        verify(leagueAffiliationRepository, never()).delete(any());
    }

    @Test
    void listReturnsEveryAffiliationForTheLeague() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        LeagueAffiliation affiliation = LeagueAffiliation.builder().id(UUID.randomUUID()).leagueId(leagueId)
                .teamId(UUID.randomUUID()).seasonId(UUID.randomUUID()).build();
        LeagueAffiliationDto dto =
                new LeagueAffiliationDto(affiliation.getId(), leagueId, affiliation.getTeamId(),
                        affiliation.getSeasonId(), null, null);
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(league(leagueId, clubId)));
        when(leagueAffiliationRepository.findByLeagueId(leagueId)).thenReturn(List.of(affiliation));
        when(leagueAffiliationMapper.toDto(affiliation)).thenReturn(dto);

        List<LeagueAffiliationDto> result = service.list(clubId, leagueId);

        assertThat(result).containsExactly(dto);
    }
}
