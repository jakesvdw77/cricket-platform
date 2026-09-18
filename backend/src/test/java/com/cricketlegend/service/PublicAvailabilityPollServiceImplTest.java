package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.League;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.Season;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.PlayerAvailabilityRowDto;
import com.cricketlegend.dto.PublicAvailabilityPollDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PollClosedException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.PublicAvailabilityPollServiceImpl;
import java.time.Instant;
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
 * Unit tests for PublicAvailabilityPollServiceImpl's business rules from
 * docs/specs/032-match-availability-polls.md: {@code getPoll} happy path and unknown-{@code
 * pollId} {@link NotFoundException}; {@code setAvailability} happy path (insert and
 * update-in-place for a repeat call from the same {@code playerProfileId}), the
 * not-in-this-poll's-squad {@link NotFoundException}, and the closed-poll {@link
 * PollClosedException}.
 */
@ExtendWith(MockitoExtension.class)
class PublicAvailabilityPollServiceImplTest {

    @Mock
    private MatchAvailabilityPollRepository matchAvailabilityPollRepository;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private SeasonRepository seasonRepository;

    @Mock
    private PlayerAvailabilityRepository playerAvailabilityRepository;

    @Mock
    private AvailabilityPollSquadResolver squadResolver;

    private PublicAvailabilityPollServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new PublicAvailabilityPollServiceImpl(
                matchAvailabilityPollRepository,
                matchRepository,
                teamRepository,
                leagueRepository,
                seasonRepository,
                playerAvailabilityRepository,
                squadResolver);
    }

    private Match match(UUID matchId, UUID homeTeamId, UUID awayTeamId, UUID seasonId, UUID leagueId) {
        return Match.builder()
                .id(matchId)
                .clubId(UUID.randomUUID())
                .homeTeamId(homeTeamId)
                .awayTeamId(awayTeamId)
                .seasonId(seasonId)
                .leagueId(leagueId)
                .matchDate(Instant.now())
                .venue("The Oval")
                .active(true)
                .build();
    }

    private MatchAvailabilityPoll poll(UUID id, UUID matchId, UUID teamId, boolean open) {
        return MatchAvailabilityPoll.builder().id(id).matchId(matchId).teamId(teamId).open(open).build();
    }

    // --- getPoll ---

    @Test
    void getPollResolvesMatchContextAndSquadFromThePollIdAlone() {
        UUID matchId = UUID.randomUUID();
        UUID homeTeamId = UUID.randomUUID();
        UUID awayTeamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID playerA = UUID.randomUUID();
        Match match = match(matchId, homeTeamId, awayTeamId, seasonId, leagueId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, homeTeamId, true);
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(homeTeamId))
                .thenReturn(Optional.of(Team.builder().id(homeTeamId).name("Riverside 1st XI").build()));
        when(teamRepository.findById(awayTeamId))
                .thenReturn(Optional.of(Team.builder().id(awayTeamId).name("Lakeside 1st XI").build()));
        when(leagueRepository.findById(leagueId))
                .thenReturn(Optional.of(League.builder().id(leagueId).name("Premier League").build()));
        when(seasonRepository.findById(seasonId))
                .thenReturn(Optional.of(Season.builder().id(seasonId).label("2026").build()));
        when(squadResolver.resolveSquadRows(homeTeamId, seasonId))
                .thenReturn(List.of(new PlayerAvailabilityRowDto(playerA, "Alice", "A", 7, null)));
        when(playerAvailabilityRepository.findByPollId(pollId)).thenReturn(List.of());

        PublicAvailabilityPollDto dto = service.getPoll(pollId);

        assertThat(dto.pollId()).isEqualTo(pollId);
        assertThat(dto.open()).isTrue();
        assertThat(dto.homeTeamName()).isEqualTo("Riverside 1st XI");
        assertThat(dto.awayTeamName()).isEqualTo("Lakeside 1st XI");
        assertThat(dto.teamName()).isEqualTo("Riverside 1st XI");
        assertThat(dto.leagueName()).isEqualTo("Premier League");
        assertThat(dto.seasonLabel()).isEqualTo("2026");
        assertThat(dto.responses()).hasSize(1);
        assertThat(dto.responses().get(0).status()).isNull();
    }

    @Test
    void getPollThrowsNotFoundForAnUnknownPollId() {
        UUID pollId = UUID.randomUUID();
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getPoll(pollId)).isInstanceOf(NotFoundException.class);
    }

    // --- setAvailability ---

    @Test
    void setAvailabilityInsertsANewRowOnFirstResponse() {
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = match(matchId, teamId, UUID.randomUUID(), seasonId, null);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(squadResolver.resolveSquadRows(teamId, seasonId))
                .thenReturn(List.of(new PlayerAvailabilityRowDto(playerId, "Alice", "A", null, null)));
        when(playerAvailabilityRepository.findByPollIdAndPlayerProfileId(pollId, playerId))
                .thenReturn(Optional.empty());
        when(playerAvailabilityRepository.findByPollId(pollId)).thenReturn(List.of());
        when(playerAvailabilityRepository.save(any(PlayerAvailability.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        // Avoid unnecessary stubbing failures for team/league/season name resolution — not under
        // test here, but reached while building the response dto.
        org.mockito.Mockito.lenient()
                .when(teamRepository.findById(teamId))
                .thenReturn(Optional.of(Team.builder().id(teamId).name("Riverside 1st XI").build()));
        org.mockito.Mockito.lenient()
                .when(seasonRepository.findById(seasonId))
                .thenReturn(Optional.of(Season.builder().id(seasonId).label("2026").build()));

        service.setAvailability(pollId, playerId, AvailabilityStatus.AVAILABLE);

        ArgumentCaptor<PlayerAvailability> captor = ArgumentCaptor.forClass(PlayerAvailability.class);
        verify(playerAvailabilityRepository).save(captor.capture());
        assertThat(captor.getValue().getPollId()).isEqualTo(pollId);
        assertThat(captor.getValue().getPlayerProfileId()).isEqualTo(playerId);
        assertThat(captor.getValue().getStatus()).isEqualTo(AvailabilityStatus.AVAILABLE);
        assertThat(captor.getValue().getUpdatedBy()).isNull();
    }

    @Test
    void setAvailabilityUpdatesTheExistingRowInPlaceOnARepeatCallFromTheSamePlayer() {
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        UUID existingRowId = UUID.randomUUID();
        Match match = match(matchId, teamId, UUID.randomUUID(), seasonId, null);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        PlayerAvailability existing = PlayerAvailability.builder()
                .id(existingRowId)
                .pollId(pollId)
                .playerProfileId(playerId)
                .status(AvailabilityStatus.AVAILABLE)
                .build();
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(squadResolver.resolveSquadRows(teamId, seasonId))
                .thenReturn(List.of(new PlayerAvailabilityRowDto(playerId, "Alice", "A", null, null)));
        when(playerAvailabilityRepository.findByPollIdAndPlayerProfileId(pollId, playerId))
                .thenReturn(Optional.of(existing));
        when(playerAvailabilityRepository.findByPollId(pollId)).thenReturn(List.of(existing));
        when(playerAvailabilityRepository.save(any(PlayerAvailability.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        org.mockito.Mockito.lenient()
                .when(teamRepository.findById(teamId))
                .thenReturn(Optional.of(Team.builder().id(teamId).name("Riverside 1st XI").build()));
        org.mockito.Mockito.lenient()
                .when(seasonRepository.findById(seasonId))
                .thenReturn(Optional.of(Season.builder().id(seasonId).label("2026").build()));

        service.setAvailability(pollId, playerId, AvailabilityStatus.UNSURE);

        ArgumentCaptor<PlayerAvailability> captor = ArgumentCaptor.forClass(PlayerAvailability.class);
        verify(playerAvailabilityRepository).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo(existingRowId);
        assertThat(captor.getValue().getStatus()).isEqualTo(AvailabilityStatus.UNSURE);
    }

    @Test
    void setAvailabilityThrowsNotFoundWhenPlayerIsNotPartOfThisPollsOwnSquad() {
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID strangerId = UUID.randomUUID();
        Match match = match(matchId, teamId, UUID.randomUUID(), seasonId, null);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(squadResolver.resolveSquadRows(teamId, seasonId)).thenReturn(List.of());

        assertThatThrownBy(() -> service.setAvailability(pollId, strangerId, AvailabilityStatus.AVAILABLE))
                .isInstanceOf(NotFoundException.class);

        verify(playerAvailabilityRepository, never()).save(any());
    }

    @Test
    void setAvailabilityThrowsPollClosedExceptionWhenPollIsClosed() {
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = match(matchId, teamId, UUID.randomUUID(), seasonId, null);
        MatchAvailabilityPoll closedPoll = poll(pollId, matchId, teamId, false);
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(closedPoll));
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(squadResolver.resolveSquadRows(teamId, seasonId))
                .thenReturn(List.of(new PlayerAvailabilityRowDto(playerId, "Alice", "A", null, null)));

        assertThatThrownBy(() -> service.setAvailability(pollId, playerId, AvailabilityStatus.AVAILABLE))
                .isInstanceOf(PollClosedException.class);

        verify(playerAvailabilityRepository, never()).save(any());
    }
}
