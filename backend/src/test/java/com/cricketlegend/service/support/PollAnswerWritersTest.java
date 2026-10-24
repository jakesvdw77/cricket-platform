package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.AnswerSource;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.dto.PublicAnswerDto;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.PollClosedException;
import com.cricketlegend.exception.SectionAvailabilityWindowClosedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * The shared writers extracted from the 077 public services (docs/specs/119): who may answer is decided by the caller, the
 * closed rules and the upsert live here, and the caller chooses the {@link AnswerSource}.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PollAnswerWritersTest {

    @Mock private PlayerAvailabilityRepository availabilityRepository;
    @Mock private SectionAvailabilityWindowRepository windowRepository;
    @Mock private SectionAvailabilityResponseRepository responseRepository;

    private final UUID player = UUID.randomUUID();

    // ---- squad polls ----

    @Test
    void aSquadAnswerIsCreatedWithTheCallersSourceAndAClosedPollIsRefusedBeforeAnyWrite() {
        SquadPollAnswerWriter writer = new SquadPollAnswerWriter(availabilityRepository);
        MatchAvailabilityPoll open = MatchAvailabilityPoll.builder().id(UUID.randomUUID()).open(true).build();
        MatchAvailabilityPoll closed = MatchAvailabilityPoll.builder().id(UUID.randomUUID()).open(false).build();
        when(availabilityRepository.findByPollIdAndPlayerProfileId(any(), any())).thenReturn(Optional.empty());
        when(availabilityRepository.save(any(PlayerAvailability.class))).thenAnswer(i -> i.getArgument(0));

        PlayerAvailability saved = writer.save(open, player, AvailabilityStatus.UNSURE, AnswerSource.LINKED_ACCOUNT);

        assertThat(saved.getSource()).isEqualTo(AnswerSource.LINKED_ACCOUNT);
        assertThat(saved.getStatus()).isEqualTo(AvailabilityStatus.UNSURE);
        assertThat(saved.getPollId()).isEqualTo(open.getId());
        assertThatThrownBy(() -> writer.save(closed, player, AvailabilityStatus.AVAILABLE, AnswerSource.LINKED_ACCOUNT))
                .isInstanceOf(PollClosedException.class);
        verify(availabilityRepository, org.mockito.Mockito.times(1)).save(any());
    }

    @Test
    void aSecondSquadAnswerUpdatesTheExistingRowAndTakesTheNewSource() {
        SquadPollAnswerWriter writer = new SquadPollAnswerWriter(availabilityRepository);
        MatchAvailabilityPoll poll = MatchAvailabilityPoll.builder().id(UUID.randomUUID()).open(true).build();
        PlayerAvailability existing = PlayerAvailability.builder().id(UUID.randomUUID()).pollId(poll.getId())
                .playerProfileId(player).status(AvailabilityStatus.AVAILABLE).source(AnswerSource.PUBLIC_LINK).build();
        when(availabilityRepository.findByPollIdAndPlayerProfileId(poll.getId(), player)).thenReturn(Optional.of(existing));
        when(availabilityRepository.save(any(PlayerAvailability.class))).thenAnswer(i -> i.getArgument(0));

        PlayerAvailability saved = writer.save(poll, player, AvailabilityStatus.UNAVAILABLE, AnswerSource.LINKED_ACCOUNT);

        assertThat(saved).isSameAs(existing);
        assertThat(saved.getStatus()).isEqualTo(AvailabilityStatus.UNAVAILABLE);
        assertThat(saved.getSource()).isEqualTo(AnswerSource.LINKED_ACCOUNT);
    }

    // ---- group polls (rounds) ----

    private SectionAvailabilityRound round;
    private SectionAvailabilityWindow open;
    private SectionAvailabilityWindow shut;
    private RoundAnswerWriter roundWriter;

    @BeforeEach
    void rounds() {
        roundWriter = new RoundAnswerWriter(windowRepository, responseRepository);
        round = SectionAvailabilityRound.builder().id(UUID.randomUUID()).build();
        open = SectionAvailabilityWindow.builder().id(UUID.randomUUID()).roundId(round.getId()).open(true).build();
        shut = SectionAvailabilityWindow.builder().id(UUID.randomUUID()).roundId(round.getId()).open(false).build();
        when(windowRepository.findByRoundId(round.getId())).thenReturn(List.of(open, shut));
        when(responseRepository.findByPlayerProfileIdAndWindowIdIn(any(), any())).thenReturn(List.of());
        when(responseRepository.saveAll(any())).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void roundAnswersAreWrittenWithTheCallersSourceAndPartialAnswersAreAllowed() {
        List<SectionAvailabilityResponse> saved = roundWriter.save(round, player,
                List.of(new PublicAnswerDto(open.getId(), AvailabilityStatus.AVAILABLE)), AnswerSource.LINKED_ACCOUNT);

        assertThat(saved).singleElement().satisfies(r -> {
            assertThat(r.getWindowId()).isEqualTo(open.getId());
            assertThat(r.getSource()).isEqualTo(AnswerSource.LINKED_ACCOUNT);
            assertThat(r.getPlayerProfileId()).isEqualTo(player);
        });
    }

    @Test
    void aWindowOfAnotherRoundIs404ADuplicateOrMissingWindowIs400AndAClosedWindowIs409WithNothingSaved() {
        assertThatThrownBy(() -> roundWriter.save(round, player,
                List.of(new PublicAnswerDto(UUID.randomUUID(), AvailabilityStatus.AVAILABLE)), AnswerSource.LINKED_ACCOUNT))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> roundWriter.save(round, player,
                List.of(new PublicAnswerDto(open.getId(), AvailabilityStatus.AVAILABLE),
                        new PublicAnswerDto(open.getId(), AvailabilityStatus.UNSURE)), AnswerSource.LINKED_ACCOUNT))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> roundWriter.save(round, player,
                List.of(new PublicAnswerDto(null, AvailabilityStatus.AVAILABLE)), AnswerSource.LINKED_ACCOUNT))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> roundWriter.save(round, player, List.of(), AnswerSource.LINKED_ACCOUNT))
                .isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> roundWriter.save(round, player,
                List.of(new PublicAnswerDto(open.getId(), AvailabilityStatus.AVAILABLE),
                        new PublicAnswerDto(shut.getId(), AvailabilityStatus.AVAILABLE)), AnswerSource.LINKED_ACCOUNT))
                .isInstanceOf(SectionAvailabilityWindowClosedException.class);
        verify(responseRepository, never()).saveAll(any());
    }
}
