package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.AnswerSource;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.dto.PlayerAvailabilityRowDto;
import com.cricketlegend.dto.PublicAnswerDto;
import com.cricketlegend.dto.PublicAnswersDto;
import com.cricketlegend.dto.PublicAnswersRequest;
import com.cricketlegend.exception.InvalidPublicTokenException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PollClosedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.SeasonRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.PublicAvailabilityPollServiceImpl;
import com.cricketlegend.service.support.PublicAvailabilityToken;
import com.cricketlegend.service.support.PublicAvailabilityVerifier;
import com.cricketlegend.service.support.PublicPollKind;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Business rules of the public squad poll answers (docs/specs/077). The verify step is covered by its own tests. */
@ExtendWith(MockitoExtension.class)
class PublicAvailabilityPollServiceImplTest {

    @Mock private MatchAvailabilityPollRepository pollRepository;
    @Mock private MatchRepository matchRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private LeagueRepository leagueRepository;
    @Mock private SeasonRepository seasonRepository;
    @Mock private PlayerAvailabilityRepository availabilityRepository;
    @Mock private AvailabilityPollSquadResolver squadResolver;
    @Mock private PublicAvailabilityVerifier verifier;

    private final PublicAvailabilityToken tokens = new PublicAvailabilityToken("secret", Clock.systemUTC());
    private PublicAvailabilityPollServiceImpl service;

    private final UUID pollId = UUID.randomUUID();
    private final UUID teamId = UUID.randomUUID();
    private final UUID seasonId = UUID.randomUUID();
    private final UUID playerId = UUID.randomUUID();
    private MatchAvailabilityPoll poll;

    @BeforeEach
    void setUp() {
        service = new PublicAvailabilityPollServiceImpl(pollRepository, matchRepository, teamRepository,
                leagueRepository, seasonRepository, availabilityRepository, squadResolver, verifier, tokens);
        poll = MatchAvailabilityPoll.builder().id(pollId).matchId(UUID.randomUUID()).teamId(teamId).open(true).build();
    }

    private String validToken() {
        return tokens.issue(PublicPollKind.POLL, pollId, playerId).token();
    }

    private void pollExistsWithPlayerInSquad() {
        when(pollRepository.findById(pollId)).thenReturn(Optional.of(poll));
        when(matchRepository.findById(poll.getMatchId()))
                .thenReturn(Optional.of(Match.builder().seasonId(seasonId).build()));
        when(squadResolver.resolveSquadRows(teamId, seasonId))
                .thenReturn(List.of(new PlayerAvailabilityRowDto(playerId, "Al", "Ex", 3, null)));
    }

    private static PublicAnswersRequest one(AvailabilityStatus status) {
        return new PublicAnswersRequest(List.of(new PublicAnswerDto(null, status)));
    }

    @Test
    void saveUpsertsTheAnswerAndMarksItAsPublicLink() {
        pollExistsWithPlayerInSquad();
        PlayerAvailability existing = PlayerAvailability.builder().pollId(pollId).playerProfileId(playerId)
                .status(AvailabilityStatus.AVAILABLE).source(AnswerSource.MANAGER).build();
        when(availabilityRepository.findByPollIdAndPlayerProfileId(pollId, playerId)).thenReturn(Optional.of(existing));
        when(availabilityRepository.save(existing)).thenReturn(existing);

        PublicAnswersDto result = service.saveAnswers(pollId, playerId, validToken(), one(AvailabilityStatus.UNSURE));

        assertThat(existing.getSource()).isEqualTo(AnswerSource.PUBLIC_LINK);
        assertThat(existing.getStatus()).isEqualTo(AvailabilityStatus.UNSURE);
        assertThat(result.answers()).containsExactly(new PublicAnswerDto(null, AvailabilityStatus.UNSURE));
    }

    @Test
    void saveCreatesTheRowWhenThePlayerNeverAnswered() {
        pollExistsWithPlayerInSquad();
        when(availabilityRepository.findByPollIdAndPlayerProfileId(pollId, playerId)).thenReturn(Optional.empty());
        when(availabilityRepository.save(any())).thenAnswer(call -> call.getArgument(0));

        service.saveAnswers(pollId, playerId, validToken(), one(AvailabilityStatus.AVAILABLE));

        verify(availabilityRepository).save(org.mockito.ArgumentMatchers.argThat(row ->
                row.getPollId().equals(pollId) && row.getSource() == AnswerSource.PUBLIC_LINK));
    }

    @Test
    void saveRequiresExactlyOneAnswer() {
        pollExistsWithPlayerInSquad();

        assertThatThrownBy(() -> service.saveAnswers(pollId, playerId, validToken(),
                new PublicAnswersRequest(List.of())))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.saveAnswers(pollId, playerId, validToken(), new PublicAnswersRequest(
                List.of(new PublicAnswerDto(null, AvailabilityStatus.AVAILABLE),
                        new PublicAnswerDto(null, AvailabilityStatus.UNSURE)))))
                .isInstanceOf(ValidationException.class);
        verify(availabilityRepository, never()).save(any());
    }

    @Test
    void saveToAClosedPollIsRefused() {
        poll.setOpen(false);
        pollExistsWithPlayerInSquad();

        assertThatThrownBy(() -> service.saveAnswers(pollId, playerId, validToken(), one(AvailabilityStatus.AVAILABLE)))
                .isInstanceOf(PollClosedException.class);
        verify(availabilityRepository, never()).save(any());
    }

    @Test
    void aMissingOrWrongTokenIsRefusedBeforeAnythingElse() {
        when(pollRepository.findById(pollId)).thenReturn(Optional.of(poll));
        String otherPlayersToken = tokens.issue(PublicPollKind.POLL, pollId, UUID.randomUUID()).token();

        assertThatThrownBy(() -> service.saveAnswers(pollId, playerId, null, one(AvailabilityStatus.AVAILABLE)))
                .isInstanceOf(InvalidPublicTokenException.class);
        assertThatThrownBy(() -> service.getAnswers(pollId, playerId, otherPlayersToken))
                .isInstanceOf(InvalidPublicTokenException.class);
        verify(availabilityRepository, never()).save(any());
    }

    @Test
    void aPlayerWhoLeftTheSquadIsNotFound() {
        when(pollRepository.findById(pollId)).thenReturn(Optional.of(poll));
        when(matchRepository.findById(poll.getMatchId()))
                .thenReturn(Optional.of(Match.builder().seasonId(seasonId).build()));
        when(squadResolver.resolveSquadRows(teamId, seasonId)).thenReturn(List.of());

        assertThatThrownBy(() -> service.getAnswers(pollId, playerId, validToken()))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void getAnswersIsEmptyUntilTheFirstSave() {
        pollExistsWithPlayerInSquad();
        when(availabilityRepository.findByPollIdAndPlayerProfileId(pollId, playerId)).thenReturn(Optional.empty());

        assertThat(service.getAnswers(pollId, playerId, validToken()).answers()).isEmpty();
    }

    @Test
    void unknownPollIsNotFound() {
        when(pollRepository.findById(pollId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getHeader(pollId)).isInstanceOf(NotFoundException.class);
    }
}
