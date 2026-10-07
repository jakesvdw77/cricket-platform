package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.AnswerSource;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.dto.PublicAnswerDto;
import com.cricketlegend.dto.PublicAnswersDto;
import com.cricketlegend.dto.PublicAnswersRequest;
import com.cricketlegend.dto.SectionAvailabilityResponseRowDto;
import com.cricketlegend.exception.InvalidPublicTokenException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.SectionAvailabilityWindowClosedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.PublicSectionAvailabilityRoundServiceImpl;
import com.cricketlegend.service.support.PublicAvailabilityToken;
import com.cricketlegend.service.support.PublicAvailabilityVerifier;
import com.cricketlegend.service.support.PublicPollKind;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Business rules of the public group poll answers (docs/specs/077). */
@ExtendWith(MockitoExtension.class)
class PublicSectionAvailabilityRoundServiceImplTest {

    @Mock private SectionAvailabilityRoundRepository roundRepository;
    @Mock private SectionAvailabilityWindowRepository windowRepository;
    @Mock private SectionAvailabilityWindowMatchRepository windowMatchRepository;
    @Mock private SectionAvailabilityResponseRepository responseRepository;
    @Mock private SectionRepository sectionRepository;
    @Mock private MatchRepository matchRepository;
    @Mock private TeamRepository teamRepository;
    @Mock private SectionAvailabilityAudienceResolver audienceResolver;
    @Mock private PublicAvailabilityVerifier verifier;

    private final PublicAvailabilityToken tokens = new PublicAvailabilityToken("secret", Clock.systemUTC());
    private PublicSectionAvailabilityRoundServiceImpl service;

    private final UUID roundId = UUID.randomUUID();
    private final UUID sectionId = UUID.randomUUID();
    private final UUID playerId = UUID.randomUUID();
    private final UUID openWindow = UUID.randomUUID();
    private final UUID otherOpenWindow = UUID.randomUUID();
    private final UUID closedWindow = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new PublicSectionAvailabilityRoundServiceImpl(roundRepository, windowRepository,
                windowMatchRepository, responseRepository, sectionRepository, matchRepository, teamRepository,
                audienceResolver, verifier, tokens);
    }

    private String token() {
        return tokens.issue(PublicPollKind.ROUND, roundId, playerId).token();
    }

    private SectionAvailabilityWindow window(UUID id, boolean open) {
        return SectionAvailabilityWindow.builder().id(id).roundId(roundId).windowDate(LocalDate.of(2026, 11, 7))
                .dayPart(DayPart.MORNING).open(open).build();
    }

    private void roundWithWindows() {
        when(roundRepository.findById(roundId)).thenReturn(Optional.of(
                SectionAvailabilityRound.builder().id(roundId).sectionId(sectionId).open(true).build()));
        when(audienceResolver.resolveAudience(sectionId))
                .thenReturn(List.of(new SectionAvailabilityResponseRowDto(playerId, "Al", "Ex", 3, null)));
        org.mockito.Mockito.lenient().when(windowRepository.findByRoundId(roundId)).thenReturn(List.of(
                window(openWindow, true), window(otherOpenWindow, true), window(closedWindow, false)));
    }

    private static PublicAnswersRequest request(PublicAnswerDto... answers) {
        return new PublicAnswersRequest(List.of(answers));
    }

    @Test
    void savesEveryAnswerWithSourcePublicLinkAndUpsertsExistingRows() {
        roundWithWindows();
        SectionAvailabilityResponse existing = SectionAvailabilityResponse.builder().windowId(openWindow)
                .playerProfileId(playerId).status(AvailabilityStatus.AVAILABLE).source(AnswerSource.MANAGER).build();
        when(responseRepository.findByPlayerProfileIdAndWindowIdIn(any(), any())).thenReturn(List.of(existing));
        when(responseRepository.saveAll(any())).thenAnswer(call -> call.getArgument(0));

        PublicAnswersDto result = service.saveAnswers(roundId, playerId, token(), request(
                new PublicAnswerDto(openWindow, AvailabilityStatus.UNSURE),
                new PublicAnswerDto(otherOpenWindow, AvailabilityStatus.AVAILABLE)));

        assertThat(existing.getStatus()).isEqualTo(AvailabilityStatus.UNSURE);
        assertThat(existing.getSource()).isEqualTo(AnswerSource.PUBLIC_LINK);
        assertThat(result.answers()).hasSize(2);
    }

    @Test
    void oneClosedWindowRejectsTheWholeCall() {
        roundWithWindows();

        assertThatThrownBy(() -> service.saveAnswers(roundId, playerId, token(), request(
                new PublicAnswerDto(openWindow, AvailabilityStatus.AVAILABLE),
                new PublicAnswerDto(closedWindow, AvailabilityStatus.AVAILABLE))))
                .isInstanceOf(SectionAvailabilityWindowClosedException.class);
        verify(responseRepository, never()).saveAll(any());
    }

    @Test
    void aWindowOfAnotherRoundIsNotFound() {
        roundWithWindows();

        assertThatThrownBy(() -> service.saveAnswers(roundId, playerId, token(), request(
                new PublicAnswerDto(UUID.randomUUID(), AvailabilityStatus.AVAILABLE))))
                .isInstanceOf(NotFoundException.class);
        verify(responseRepository, never()).saveAll(any());
    }

    @Test
    void emptyDuplicateOrWindowlessAnswersAreInvalid() {
        roundWithWindows();

        assertThatThrownBy(() -> service.saveAnswers(roundId, playerId, token(), request()))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.saveAnswers(roundId, playerId, token(), request(
                new PublicAnswerDto(null, AvailabilityStatus.AVAILABLE))))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> service.saveAnswers(roundId, playerId, token(), request(
                new PublicAnswerDto(openWindow, AvailabilityStatus.AVAILABLE),
                new PublicAnswerDto(openWindow, AvailabilityStatus.UNSURE))))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void aTokenForAnotherRoundIsRefused() {
        when(roundRepository.findById(roundId)).thenReturn(Optional.of(
                SectionAvailabilityRound.builder().id(roundId).sectionId(sectionId).open(true).build()));
        String wrong = tokens.issue(PublicPollKind.ROUND, UUID.randomUUID(), playerId).token();

        assertThatThrownBy(() -> service.getAnswers(roundId, playerId, wrong))
                .isInstanceOf(InvalidPublicTokenException.class);
    }

    @Test
    void aPlayerOutsideTheAudienceIsNotFound() {
        when(roundRepository.findById(roundId)).thenReturn(Optional.of(
                SectionAvailabilityRound.builder().id(roundId).sectionId(sectionId).open(true).build()));
        when(audienceResolver.resolveAudience(sectionId)).thenReturn(List.of());

        assertThatThrownBy(() -> service.getAnswers(roundId, playerId, token()))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void getAnswersListsOnlyThisPlayersAnswersForTheRoundsWindows() {
        roundWithWindows();
        when(responseRepository.findByPlayerProfileIdAndWindowIdIn(any(), any())).thenReturn(List.of(
                SectionAvailabilityResponse.builder().windowId(openWindow).playerProfileId(playerId)
                        .status(AvailabilityStatus.UNAVAILABLE).build()));

        assertThat(service.getAnswers(roundId, playerId, token()).answers())
                .containsExactly(new PublicAnswerDto(openWindow, AvailabilityStatus.UNAVAILABLE));
    }
}
