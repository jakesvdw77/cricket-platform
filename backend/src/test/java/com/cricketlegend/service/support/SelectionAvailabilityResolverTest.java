package com.cricketlegend.service.support;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.PlayerProfile;
import com.cricketlegend.domain.PlayerSection;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SelectionAvailability;
import com.cricketlegend.domain.TeamSquadMember;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.repository.PlayerProfileRepository;
import com.cricketlegend.repository.PlayerSectionRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.TeamSquadMemberRepository;
import com.cricketlegend.service.MatchPollCoverageService;
import com.cricketlegend.service.MatchPollCoverageService.Coverage;
import com.cricketlegend.service.MatchPollCoverageService.Kind;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for {@link SelectionAvailabilityResolver} per docs/specs/076-team-selection.md section 7
 * and its Test Plan (as amended by the phase 1 build record): GROUP answers come from the window's
 * responses, SQUAD answers from the squad poll's rows, an unanswered player in the poll's audience is
 * NO_RESPONSE and outside it NOT_POLLED, and NONE means nobody was polled.
 */
@ExtendWith(MockitoExtension.class)
class SelectionAvailabilityResolverTest {

    @Mock
    private MatchPollCoverageService coverageService;

    @Mock
    private SectionAvailabilityWindowRepository windowRepository;

    @Mock
    private SectionAvailabilityResponseRepository windowResponseRepository;

    @Mock
    private PlayerAvailabilityRepository playerAvailabilityRepository;

    @Mock
    private PlayerSectionRepository playerSectionRepository;

    @Mock
    private PlayerProfileRepository playerProfileRepository;

    @Mock
    private TeamSquadMemberRepository teamSquadMemberRepository;

    @Mock
    private AccessService accessService;

    private SelectionAvailabilityResolver resolver;
    private final UUID clubId = UUID.randomUUID();
    private final UUID sectionId = UUID.randomUUID();
    private final UUID teamId = UUID.randomUUID();
    private final UUID seasonId = UUID.randomUUID();
    private final Match match = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(teamId)
            .seasonId(seasonId).matchDate(Instant.now()).active(true).build();

    @BeforeEach
    void setUp() {
        resolver = new SelectionAvailabilityResolver(coverageService, windowRepository, windowResponseRepository,
                playerAvailabilityRepository, playerSectionRepository, playerProfileRepository,
                teamSquadMemberRepository, accessService);
    }

    private Coverage groupCoverage(UUID windowId) {
        return new Coverage(Kind.GROUP, null, UUID.randomUUID(), windowId, "Round 1");
    }

    private SectionAvailabilityResponse response(UUID windowId, UUID player, AvailabilityStatus status) {
        return SectionAvailabilityResponse.builder().windowId(windowId).playerProfileId(player).status(status).build();
    }

    private PlayerAvailability answer(UUID pollId, UUID player, AvailabilityStatus status) {
        return PlayerAvailability.builder().pollId(pollId).playerProfileId(player).status(status).build();
    }

    /** A group window for the section; {@code audience} are the players active and tagged to it. */
    private UUID groupWindow(Set<UUID> audience, Set<UUID> inactive) {
        UUID windowId = UUID.randomUUID();
        when(windowRepository.findById(windowId)).thenReturn(Optional.of(SectionAvailabilityWindow.builder()
                .id(windowId).clubId(clubId).sectionId(sectionId).windowDate(LocalDate.now())
                .dayPart(DayPart.MORNING).open(true).build()));
        when(accessService.sectionAndDescendantIds(clubId, sectionId)).thenReturn(Set.of(sectionId));
        when(playerSectionRepository.findBySectionIdIn(any())).thenReturn(audience.stream()
                .map(id -> PlayerSection.builder().playerProfileId(id).sectionId(sectionId).build()).toList());
        when(playerProfileRepository.findAllById(any())).thenAnswer(invocation -> {
            Iterable<UUID> asked = invocation.getArgument(0);
            java.util.ArrayList<PlayerProfile> profiles = new java.util.ArrayList<>();
            asked.forEach(id -> {
                if (audience.contains(id) || inactive.contains(id)) {
                    profiles.add(PlayerProfile.builder().id(id).clubId(clubId).active(!inactive.contains(id)).build());
                }
            });
            return profiles;
        });
        return windowId;
    }

    @Test
    void coverageIsTheCoverageServicesAnswerForThisTeamsSide() {
        Coverage squad = new Coverage(Kind.SQUAD, UUID.randomUUID(), null, null, "x");
        when(coverageService.resolve(match.getId(), teamId)).thenReturn(squad);

        assertThat(resolver.coverage(match.getId(), teamId)).isSameAs(squad);
    }

    @Test
    void groupPollReadsAvailableUnsureAndUnavailableFromTheWindowsResponses() {
        UUID yes = UUID.randomUUID();
        UUID maybe = UUID.randomUUID();
        UUID no = UUID.randomUUID();
        UUID windowId = groupWindow(Set.of(yes, maybe, no), Set.of());
        when(windowResponseRepository.findByWindowId(windowId)).thenReturn(List.of(
                response(windowId, yes, AvailabilityStatus.AVAILABLE),
                response(windowId, maybe, AvailabilityStatus.UNSURE),
                response(windowId, no, AvailabilityStatus.UNAVAILABLE)));

        Map<UUID, SelectionAvailability> result =
                resolver.statuses(match, teamId, groupCoverage(windowId), List.of(yes, maybe, no));

        assertThat(result).containsEntry(yes, SelectionAvailability.AVAILABLE)
                .containsEntry(maybe, SelectionAvailability.UNSURE)
                .containsEntry(no, SelectionAvailability.UNAVAILABLE);
    }

    @Test
    void groupPollNoRowInTheAudienceIsNoResponseAndOutsideItNotPolled() {
        UUID silent = UUID.randomUUID();
        UUID outsider = UUID.randomUUID();
        UUID retired = UUID.randomUUID();
        UUID windowId = groupWindow(Set.of(silent), Set.of(retired));
        when(windowResponseRepository.findByWindowId(windowId)).thenReturn(List.of());

        Map<UUID, SelectionAvailability> result =
                resolver.statuses(match, teamId, groupCoverage(windowId), List.of(silent, outsider, retired));

        assertThat(result).containsEntry(silent, SelectionAvailability.NO_RESPONSE)
                .containsEntry(outsider, SelectionAvailability.NOT_POLLED)
                .containsEntry(retired, SelectionAvailability.NOT_POLLED);
    }

    @Test
    void anAnswerOnTheGroupWindowCountsEvenForAPlayerOutsideTheAudience() {
        UUID answered = UUID.randomUUID();
        UUID windowId = groupWindow(Set.of(), Set.of());
        when(windowResponseRepository.findByWindowId(windowId))
                .thenReturn(List.of(response(windowId, answered, AvailabilityStatus.AVAILABLE)));

        assertThat(resolver.statuses(match, teamId, groupCoverage(windowId), List.of(answered)))
                .containsEntry(answered, SelectionAvailability.AVAILABLE);
    }

    @Test
    void theGroupAnswerIsSharedByEveryMatchOfTheWindow() {
        UUID player = UUID.randomUUID();
        UUID windowId = groupWindow(Set.of(player), Set.of());
        when(windowResponseRepository.findByWindowId(windowId))
                .thenReturn(List.of(response(windowId, player, AvailabilityStatus.UNAVAILABLE)));
        Match otherMatchOfTheWindow = Match.builder().id(UUID.randomUUID()).clubId(clubId).homeTeamId(teamId)
                .seasonId(seasonId).matchDate(Instant.now()).active(true).build();

        Coverage coverage = groupCoverage(windowId);

        assertThat(resolver.statuses(match, teamId, coverage, List.of(player)).get(player))
                .isEqualTo(resolver.statuses(otherMatchOfTheWindow, teamId, coverage, List.of(player)).get(player))
                .isEqualTo(SelectionAvailability.UNAVAILABLE);
    }

    @Test
    void squadPollReadsPerPollAnswersAndANullStatusIsNoAnswer() {
        UUID pollId = UUID.randomUUID();
        UUID yes = UUID.randomUUID();
        UUID unanswered = UUID.randomUUID();
        UUID notInSquad = UUID.randomUUID();
        when(playerAvailabilityRepository.findByPollId(pollId)).thenReturn(List.of(
                answer(pollId, yes, AvailabilityStatus.AVAILABLE), answer(pollId, unanswered, null)));
        when(teamSquadMemberRepository.findByTeamIdAndSeasonId(teamId, seasonId)).thenReturn(List.of(
                TeamSquadMember.builder().teamId(teamId).seasonId(seasonId).playerProfileId(yes).build(),
                TeamSquadMember.builder().teamId(teamId).seasonId(seasonId).playerProfileId(unanswered).build()));

        Map<UUID, SelectionAvailability> result = resolver.statuses(match, teamId,
                new Coverage(Kind.SQUAD, pollId, null, null, "x"), List.of(yes, unanswered, notInSquad));

        assertThat(result).containsEntry(yes, SelectionAvailability.AVAILABLE)
                .containsEntry(unanswered, SelectionAvailability.NO_RESPONSE)
                .containsEntry(notInSquad, SelectionAvailability.NOT_POLLED);
    }

    @Test
    void squadPollMapsUnsureAndUnavailable() {
        UUID pollId = UUID.randomUUID();
        UUID maybe = UUID.randomUUID();
        UUID no = UUID.randomUUID();
        when(playerAvailabilityRepository.findByPollId(pollId)).thenReturn(List.of(
                answer(pollId, maybe, AvailabilityStatus.UNSURE), answer(pollId, no, AvailabilityStatus.UNAVAILABLE)));
        when(teamSquadMemberRepository.findByTeamIdAndSeasonId(teamId, seasonId)).thenReturn(List.of());

        assertThat(resolver.statuses(match, teamId, new Coverage(Kind.SQUAD, pollId, null, null, "x"), List.of(maybe, no)))
                .containsEntry(maybe, SelectionAvailability.UNSURE)
                .containsEntry(no, SelectionAvailability.UNAVAILABLE);
    }

    @Test
    void aDerbyReadsEachSidesOwnPollAndSquad() {
        UUID awayTeamId = UUID.randomUUID();
        UUID homePoll = UUID.randomUUID();
        UUID awayPoll = UUID.randomUUID();
        UUID player = UUID.randomUUID();
        when(playerAvailabilityRepository.findByPollId(homePoll))
                .thenReturn(List.of(answer(homePoll, player, AvailabilityStatus.AVAILABLE)));
        when(playerAvailabilityRepository.findByPollId(awayPoll))
                .thenReturn(List.of(answer(awayPoll, player, AvailabilityStatus.UNAVAILABLE)));
        when(teamSquadMemberRepository.findByTeamIdAndSeasonId(any(), any())).thenReturn(List.of());

        assertThat(resolver.statuses(match, teamId, new Coverage(Kind.SQUAD, homePoll, null, null, "h"), List.of(player)))
                .containsEntry(player, SelectionAvailability.AVAILABLE);
        assertThat(resolver.statuses(match, awayTeamId, new Coverage(Kind.SQUAD, awayPoll, null, null, "a"), List.of(player)))
                .containsEntry(player, SelectionAvailability.UNAVAILABLE);
        verify(teamSquadMemberRepository).findByTeamIdAndSeasonId(teamId, seasonId);
        verify(teamSquadMemberRepository).findByTeamIdAndSeasonId(awayTeamId, seasonId);
    }

    @Test
    void noCoverageMeansEveryoneIsNotPolledWithoutReadingAnyAnswers() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();

        Map<UUID, SelectionAvailability> result = resolver.statuses(match, teamId, Coverage.NONE, List.of(a, b));

        assertThat(result).containsEntry(a, SelectionAvailability.NOT_POLLED)
                .containsEntry(b, SelectionAvailability.NOT_POLLED);
        verifyNoInteractions(windowResponseRepository, playerAvailabilityRepository);
    }

    @Test
    void noPlayersMeansAnEmptyResult() {
        assertThat(resolver.statuses(match, teamId, groupCoverage(UUID.randomUUID()), List.of())).isEmpty();
        verifyNoInteractions(windowRepository);
    }

    @Test
    void availableOnGroupPollListsOnlyThoseWhoSaidAvailable() {
        UUID yes = UUID.randomUUID();
        UUID windowId = UUID.randomUUID();
        when(windowResponseRepository.findByWindowId(windowId)).thenReturn(List.of(
                response(windowId, yes, AvailabilityStatus.AVAILABLE),
                response(windowId, UUID.randomUUID(), AvailabilityStatus.UNSURE),
                response(windowId, UUID.randomUUID(), AvailabilityStatus.UNAVAILABLE)));

        assertThat(resolver.availableOnGroupPoll(groupCoverage(windowId))).containsExactly(yes);
    }

    @Test
    void availableOnGroupPollIsEmptyForSquadAndNoCoverage() {
        assertThat(resolver.availableOnGroupPoll(new Coverage(Kind.SQUAD, UUID.randomUUID(), null, null, "x"))).isEmpty();
        assertThat(resolver.availableOnGroupPoll(Coverage.NONE)).isEmpty();
        verify(windowResponseRepository, never()).findByWindowId(any());
    }
}
