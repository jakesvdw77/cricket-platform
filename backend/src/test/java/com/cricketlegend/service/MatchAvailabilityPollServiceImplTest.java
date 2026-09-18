package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.dto.CreateMatchAvailabilityPollRequest;
import com.cricketlegend.dto.MatchAvailabilityPollResponsesDto;
import com.cricketlegend.dto.PlayerAvailabilityRowDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchAvailabilityPollMapper;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.service.impl.MatchAvailabilityPollServiceImpl;
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
 * Unit tests for MatchAvailabilityPollServiceImpl's business rules from
 * docs/specs/032-match-availability-polls.md: {@code create} restricted to the match's own two
 * team ids (400) and rejecting a duplicate {@code (match, team)} poll (409); {@code open}/{@code
 * close} transitions and their {@code InvalidStatusTransitionException} (409) "already in that
 * state" guards; {@code getResponses} resolving the full season-scoped squad with correct counts,
 * including zero-response members.
 */
@ExtendWith(MockitoExtension.class)
class MatchAvailabilityPollServiceImplTest {

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private MatchAvailabilityPollRepository matchAvailabilityPollRepository;

    @Mock
    private PlayerAvailabilityRepository playerAvailabilityRepository;

    @Mock
    private AvailabilityPollSquadResolver squadResolver;

    @Mock
    private MatchAvailabilityPollMapper matchAvailabilityPollMapper;

    private MatchAvailabilityPollServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new MatchAvailabilityPollServiceImpl(
                matchRepository,
                matchAvailabilityPollRepository,
                playerAvailabilityRepository,
                squadResolver,
                matchAvailabilityPollMapper);
    }

    private Match match(UUID clubId, UUID matchId, UUID homeTeamId, UUID awayTeamId, UUID seasonId) {
        return Match.builder()
                .id(matchId)
                .clubId(clubId)
                .homeTeamId(homeTeamId)
                .awayTeamId(awayTeamId)
                .seasonId(seasonId)
                .matchDate(Instant.now())
                .active(true)
                .build();
    }

    private MatchAvailabilityPoll poll(UUID id, UUID matchId, UUID teamId, boolean open) {
        return MatchAvailabilityPoll.builder().id(id).matchId(matchId).teamId(teamId).open(open).build();
    }

    // --- create ---

    @Test
    void createForOneOfTheMatchsOwnTeamIdsSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID homeTeamId = UUID.randomUUID();
        UUID awayTeamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, homeTeamId, awayTeamId, seasonId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.existsByMatchIdAndTeamId(matchId, homeTeamId)).thenReturn(false);
        when(matchAvailabilityPollRepository.save(any(MatchAvailabilityPoll.class)))
                .thenAnswer(invocation -> {
                    MatchAvailabilityPoll saved = invocation.getArgument(0);
                    saved.setId(UUID.randomUUID());
                    return saved;
                });
        when(squadResolver.resolveSquadRows(eq(homeTeamId), eq(seasonId))).thenReturn(List.of());

        service.create(clubId, matchId, new CreateMatchAvailabilityPollRequest(homeTeamId));

        ArgumentCaptor<MatchAvailabilityPoll> savedCaptor = ArgumentCaptor.forClass(MatchAvailabilityPoll.class);
        verify(matchAvailabilityPollRepository).save(savedCaptor.capture());
        MatchAvailabilityPoll saved = savedCaptor.getValue();
        assertThat(saved.getMatchId()).isEqualTo(matchId);
        assertThat(saved.getTeamId()).isEqualTo(homeTeamId);
        assertThat(saved.isOpen()).isTrue();
    }

    @Test
    void createReturns400WhenTeamIdIsNotOneOfTheMatchsOwnTeams() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID homeTeamId = UUID.randomUUID();
        UUID awayTeamId = UUID.randomUUID();
        UUID unrelatedTeamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, homeTeamId, awayTeamId, seasonId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));

        assertThatThrownBy(() ->
                        service.create(clubId, matchId, new CreateMatchAvailabilityPollRequest(unrelatedTeamId)))
                .isInstanceOf(ValidationException.class);

        verify(matchAvailabilityPollRepository, never()).save(any());
    }

    @Test
    void createReturns409WhenAPollForThatTeamAlreadyExists() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID homeTeamId = UUID.randomUUID();
        UUID awayTeamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, homeTeamId, awayTeamId, seasonId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.existsByMatchIdAndTeamId(matchId, homeTeamId)).thenReturn(true);

        assertThatThrownBy(() ->
                        service.create(clubId, matchId, new CreateMatchAvailabilityPollRequest(homeTeamId)))
                .isInstanceOf(ConflictException.class);

        verify(matchAvailabilityPollRepository, never()).save(any());
    }

    @Test
    void createReturns404WhenMatchBelongsToADifferentClub() {
        UUID matchId = UUID.randomUUID();
        Match match = match(UUID.randomUUID(), matchId, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));

        assertThatThrownBy(() -> service.create(
                        UUID.randomUUID(), matchId, new CreateMatchAvailabilityPollRequest(UUID.randomUUID())))
                .isInstanceOf(NotFoundException.class);
    }

    // --- open/close ---

    @Test
    void openTransitionsAClosedPollToOpen() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll closedPoll = poll(pollId, matchId, teamId, false);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(closedPoll));
        when(matchAvailabilityPollRepository.save(any(MatchAvailabilityPoll.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(squadResolver.resolveSquadRows(eq(teamId), eq(seasonId))).thenReturn(List.of());

        service.open(clubId, matchId, pollId);

        assertThat(closedPoll.isOpen()).isTrue();
    }

    @Test
    void openReturns409WhenPollIsAlreadyOpen() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));

        assertThatThrownBy(() -> service.open(clubId, matchId, pollId))
                .isInstanceOf(InvalidStatusTransitionException.class);

        verify(matchAvailabilityPollRepository, never()).save(any());
    }

    @Test
    void closeTransitionsAnOpenPollToClosed() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));
        when(matchAvailabilityPollRepository.save(any(MatchAvailabilityPoll.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(squadResolver.resolveSquadRows(eq(teamId), eq(seasonId))).thenReturn(List.of());

        service.close(clubId, matchId, pollId);

        assertThat(openPoll.isOpen()).isFalse();
    }

    @Test
    void closeReturns409WhenPollIsAlreadyClosed() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchAvailabilityPoll closedPoll = poll(pollId, matchId, teamId, false);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(closedPoll));

        assertThatThrownBy(() -> service.close(clubId, matchId, pollId))
                .isInstanceOf(InvalidStatusTransitionException.class);

        verify(matchAvailabilityPollRepository, never()).save(any());
    }

    @Test
    void openReturns404WhenPollBelongsToADifferentMatch() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID otherMatchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        Match match = match(clubId, matchId, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        MatchAvailabilityPoll pollOnOtherMatch = poll(pollId, otherMatchId, UUID.randomUUID(), true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(pollOnOtherMatch));

        assertThatThrownBy(() -> service.open(clubId, matchId, pollId)).isInstanceOf(NotFoundException.class);
    }

    // --- getResponses ---

    @Test
    void getResponsesResolvesTheFullSeasonScopedSquadWithCorrectCountsIncludingZeroResponseMembers() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerA = UUID.randomUUID();
        UUID playerB = UUID.randomUUID();
        UUID playerC = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));
        when(squadResolver.resolveSquadRows(teamId, seasonId)).thenReturn(List.of(
                new PlayerAvailabilityRowDto(playerA, "Alice", "A", 1, null),
                new PlayerAvailabilityRowDto(playerB, "Bob", "B", 2, null),
                new PlayerAvailabilityRowDto(playerC, "Cara", "C", null, null)));
        when(playerAvailabilityRepository.findByPollId(pollId)).thenReturn(List.of(
                PlayerAvailability.builder().pollId(pollId).playerProfileId(playerA)
                        .status(AvailabilityStatus.AVAILABLE).build(),
                PlayerAvailability.builder().pollId(pollId).playerProfileId(playerB)
                        .status(AvailabilityStatus.UNAVAILABLE).build()));

        MatchAvailabilityPollResponsesDto responses = service.getResponses(clubId, matchId, pollId);

        assertThat(responses.pollId()).isEqualTo(pollId);
        assertThat(responses.teamId()).isEqualTo(teamId);
        assertThat(responses.open()).isTrue();
        assertThat(responses.availableCount()).isEqualTo(1);
        assertThat(responses.unavailableCount()).isEqualTo(1);
        assertThat(responses.unsureCount()).isEqualTo(0);
        assertThat(responses.noResponseCount()).isEqualTo(1);
        assertThat(responses.publicPath()).isEqualTo("/poll/" + pollId);
        assertThat(responses.responses()).hasSize(3);
        assertThat(responses.responses())
                .anySatisfy(row -> {
                    if (row.playerProfileId().equals(playerC)) {
                        assertThat(row.status()).isNull();
                    }
                });
    }
}
