package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.Team;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.MatchPollCoverageService.Coverage;
import com.cricketlegend.service.MatchPollCoverageService.Kind;
import com.cricketlegend.service.impl.MatchPollCoverageServiceImpl;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * docs/specs/064-unified-availability-polls.md: coverage is resolved from data (window-match row =
 * GROUP, poll row = SQUAD, neither = NONE), GROUP takes precedence, and {@code resolve} is
 * team-scoped for squad polls while {@code resolveAny} is not.
 */
@ExtendWith(MockitoExtension.class)
class MatchPollCoverageServiceImplTest {

    @Mock
    private SectionAvailabilityWindowMatchRepository windowMatchRepository;

    @Mock
    private SectionAvailabilityWindowRepository windowRepository;

    @Mock
    private SectionAvailabilityRoundRepository roundRepository;

    @Mock
    private MatchAvailabilityPollRepository pollRepository;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private TeamRepository teamRepository;

    private MatchPollCoverageServiceImpl service;

    private final UUID matchId = UUID.randomUUID();
    private final UUID homeTeamId = UUID.randomUUID();
    private final UUID awayTeamId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new MatchPollCoverageServiceImpl(
                windowMatchRepository, windowRepository, roundRepository, pollRepository, matchRepository,
                teamRepository);
        lenient().when(windowMatchRepository.findByMatchId(matchId)).thenReturn(Optional.empty());
        lenient().when(pollRepository.findByMatchIdAndTeamId(matchId, homeTeamId)).thenReturn(Optional.empty());
        lenient().when(pollRepository.findByMatchId(matchId)).thenReturn(List.of());
    }

    private UUID stubGroupCoverage(String description) {
        UUID windowId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        when(windowMatchRepository.findByMatchId(matchId))
                .thenReturn(Optional.of(
                        SectionAvailabilityWindowMatch.builder().windowId(windowId).matchId(matchId).build()));
        when(windowRepository.findById(windowId))
                .thenReturn(Optional.of(SectionAvailabilityWindow.builder().id(windowId).roundId(roundId).build()));
        when(roundRepository.findById(roundId))
                .thenReturn(Optional.of(SectionAvailabilityRound.builder().id(roundId).description(description).build()));
        return roundId;
    }

    private MatchAvailabilityPoll stubSquadPoll(UUID teamId) {
        MatchAvailabilityPoll poll =
                MatchAvailabilityPoll.builder().id(UUID.randomUUID()).matchId(matchId).teamId(teamId).build();
        lenient().when(pollRepository.findByMatchIdAndTeamId(matchId, teamId)).thenReturn(Optional.of(poll));
        lenient().when(pollRepository.findByMatchId(matchId)).thenReturn(List.of(poll));
        lenient().when(matchRepository.findById(matchId))
                .thenReturn(Optional.of(Match.builder()
                        .id(matchId)
                        .homeTeamId(homeTeamId)
                        .awayTeamId(awayTeamId)
                        .awayTeamName("Away FC")
                        .build()));
        lenient().when(teamRepository.findById(homeTeamId))
                .thenReturn(Optional.of(Team.builder().id(homeTeamId).name("U15 Colts").build()));
        lenient().when(teamRepository.findById(awayTeamId))
                .thenReturn(Optional.of(Team.builder().id(awayTeamId).name("Rivals").build()));
        return poll;
    }

    @Test
    void resolveReturnsNoneWhenNoPollCoversTheMatch() {
        Coverage coverage = service.resolve(matchId, homeTeamId);
        assertThat(coverage).isEqualTo(Coverage.NONE);
        assertThat(coverage.covered()).isFalse();
    }

    @Test
    void resolveReturnsGroupWithRoundWindowAndDescriptionWhenALinkedWindowExists() {
        UUID roundId = stubGroupCoverage("Saturday fixtures");

        Coverage coverage = service.resolve(matchId, homeTeamId);

        assertThat(coverage.kind()).isEqualTo(Kind.GROUP);
        assertThat(coverage.roundId()).isEqualTo(roundId);
        assertThat(coverage.windowId()).isNotNull();
        assertThat(coverage.pollId()).isNull();
        assertThat(coverage.label()).isEqualTo("Saturday fixtures");
        assertThat(coverage.coveringPollId()).isEqualTo(roundId);
    }

    @Test
    void resolveReturnsSquadWithPollIdAndTeamVersusOpponentLabel() {
        MatchAvailabilityPoll poll = stubSquadPoll(homeTeamId);

        Coverage coverage = service.resolve(matchId, homeTeamId);

        assertThat(coverage.kind()).isEqualTo(Kind.SQUAD);
        assertThat(coverage.pollId()).isEqualTo(poll.getId());
        assertThat(coverage.roundId()).isNull();
        assertThat(coverage.windowId()).isNull();
        assertThat(coverage.label()).isEqualTo("U15 Colts v Rivals");
        assertThat(coverage.coveringPollId()).isEqualTo(poll.getId());
    }

    @Test
    void groupTakesPrecedenceOverASquadPoll() {
        stubGroupCoverage("Weekend");
        stubSquadPoll(homeTeamId);

        assertThat(service.resolve(matchId, homeTeamId).kind()).isEqualTo(Kind.GROUP);
        assertThat(service.resolveAny(matchId).kind()).isEqualTo(Kind.GROUP);
    }

    @Test
    void resolveIsTeamScopedForSquadPollsButResolveAnyIsNot() {
        stubSquadPoll(awayTeamId); // only the away team has a poll

        assertThat(service.resolve(matchId, homeTeamId)).isEqualTo(Coverage.NONE);
        assertThat(service.resolve(matchId, awayTeamId).kind()).isEqualTo(Kind.SQUAD);
        assertThat(service.resolveAny(matchId).kind()).isEqualTo(Kind.SQUAD);
    }

    @Test
    void resolveAnyReturnsNoneWhenNothingCoversTheMatch() {
        assertThat(service.resolveAny(matchId)).isEqualTo(Coverage.NONE);
    }
}
