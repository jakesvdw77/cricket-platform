package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.DayPart;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.Section;
import com.cricketlegend.domain.SectionAvailabilityResponse;
import com.cricketlegend.domain.SectionAvailabilityRound;
import com.cricketlegend.domain.SectionAvailabilityWindow;
import com.cricketlegend.domain.SectionAvailabilityWindowMatch;
import com.cricketlegend.domain.SquadMode;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.CreateSectionAvailabilityRoundRequest;
import com.cricketlegend.dto.SectionAvailabilityResponseRowDto;
import com.cricketlegend.dto.SectionAvailabilityRoundDto;
import com.cricketlegend.dto.SectionAvailabilityRoundMatchDto;
import com.cricketlegend.dto.SectionAvailabilityRoundResponsesDto;
import com.cricketlegend.dto.UpdateSectionAvailabilityRoundDescriptionRequest;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.MatchAlreadyPolledException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.SectionAvailabilityWindowClosedException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.SectionAvailabilityRoundMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.SectionAvailabilityRoundServiceImpl;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;

/**
 * Unit tests for SectionAvailabilityRoundServiceImpl's business rules from
 * docs/specs/063-section-availability-and-flexible-squads.md's fixture-group-selection revision:
 * {@code create} validates every {@code matchId} resolves to a {@code FLEXIBLE} team in the given
 * section, creates exactly the windows those matches need plus one window-match row per match,
 * and computes {@code firstMatchDate}/{@code lastMatchDate}/{@code scheduledCloseAt}; {@code
 * open}/{@code close} transitions and their "already in that state" guards (409), cascading to
 * every owned window; {@code getResponses} merges each bracket's own status into one per-player
 * row; {@code setPlayerStatus} (admin override) rejects a not-in-audience player (404) then a
 * closed bracket (409), now {@code windowId}-keyed.
 */
@ExtendWith(MockitoExtension.class)
class SectionAvailabilityRoundServiceImplTest {

    @Mock
    private SectionAvailabilityRoundRepository sectionAvailabilityRoundRepository;

    @Mock
    private SectionAvailabilityWindowRepository sectionAvailabilityWindowRepository;

    @Mock
    private SectionAvailabilityWindowMatchRepository sectionAvailabilityWindowMatchRepository;

    @Mock
    private SectionAvailabilityResponseRepository sectionAvailabilityResponseRepository;

    @Mock
    private SectionRepository sectionRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private MatchRepository matchRepository;

    @Mock
    private LeagueRepository leagueRepository;

    @Mock
    private SectionAvailabilityAudienceResolver audienceResolver;

    @Mock
    private SectionAvailabilityMatchResolver matchResolver;

    @Mock
    private SectionAvailabilityRoundMapper sectionAvailabilityRoundMapper;

    @Mock
    private AccessService accessService;

    private SectionAvailabilityRoundServiceImpl service;
    private final Authentication authentication = new TestingAuthenticationToken("club-admin-subject", null, List.of());

    @BeforeEach
    void setUp() {
        service = new SectionAvailabilityRoundServiceImpl(
                sectionAvailabilityRoundRepository,
                sectionAvailabilityWindowRepository,
                sectionAvailabilityWindowMatchRepository,
                sectionAvailabilityResponseRepository,
                sectionRepository,
                teamRepository,
                matchRepository,
                leagueRepository,
                audienceResolver,
                matchResolver,
                sectionAvailabilityRoundMapper,
                accessService);
    }

    private Section section(UUID clubId, UUID sectionId) {
        return Section.builder().id(sectionId).clubId(clubId).name("Juniors").active(true).build();
    }

    private SectionAvailabilityRound round(UUID id, UUID clubId, UUID sectionId, boolean open) {
        return SectionAvailabilityRound.builder()
                .id(id)
                .clubId(clubId)
                .sectionId(sectionId)
                .description("Saturday fixtures")
                .firstMatchDate(java.time.LocalDate.of(2026, 9, 27))
                .lastMatchDate(java.time.LocalDate.of(2026, 9, 27))
                .autoClose(true)
                .open(open)
                .build();
    }

    private void stubEmptyBracketsFor(UUID sectionId) {
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(UUID.randomUUID(), sectionId)));
        when(audienceResolver.resolveAudience(sectionId)).thenReturn(List.of());
        when(sectionAvailabilityRoundMapper.toDto(any(), any(), any())).thenAnswer(invocation -> {
            SectionAvailabilityRound round = invocation.getArgument(0);
            return new SectionAvailabilityRoundDto(
                    round.getId(),
                    round.getSectionId(),
                    null,
                    round.getDescription(),
                    round.getFirstMatchDate(),
                    round.getLastMatchDate(),
                    round.isAutoClose(),
                    round.getScheduledCloseAt(),
                    round.isOpen(),
                    List.of());
        });
    }

    // --- list ---

    @Test
    void listFiltersByTheExplicitSectionIdFilterAfterValidatingIt() {
        UUID clubId = UUID.randomUUID();
        UUID matchingSectionId = UUID.randomUUID();
        UUID otherSectionId = UUID.randomUUID();
        UUID matchingRoundId = UUID.randomUUID();
        UUID otherRoundId = UUID.randomUUID();
        SectionAvailabilityRound matchingRound = round(matchingRoundId, clubId, matchingSectionId, true);
        SectionAvailabilityRound otherRound = round(otherRoundId, clubId, otherSectionId, true);
        when(sectionAvailabilityRoundRepository.findByClubId(clubId)).thenReturn(List.of(matchingRound, otherRound));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.sectionAndDescendantIds(clubId, matchingSectionId)).thenReturn(Set.of(matchingSectionId));
        when(sectionAvailabilityWindowRepository.findByRoundId(any())).thenReturn(List.of());
        stubEmptyBracketsFor(matchingSectionId);

        List<SectionAvailabilityRoundDto> result = service.list(authentication, clubId, matchingSectionId, null);

        verify(accessService).assertCanAdministerSection(authentication, clubId, matchingSectionId);
        assertThat(result).hasSize(1);
    }

    @Test
    void listFiltersByTheOpenFlag() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        SectionAvailabilityRound openRound = round(UUID.randomUUID(), clubId, sectionId, true);
        SectionAvailabilityRound closedRound = round(UUID.randomUUID(), clubId, sectionId, false);
        when(sectionAvailabilityRoundRepository.findByClubId(clubId)).thenReturn(List.of(openRound, closedRound));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(sectionAvailabilityWindowRepository.findByRoundId(any())).thenReturn(List.of());
        stubEmptyBracketsFor(sectionId);

        List<SectionAvailabilityRoundDto> result = service.list(authentication, clubId, null, true);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).open()).isTrue();
    }

    @Test
    void listExcludesARoundOutsideTheCallersOwnAccessibleSections() {
        UUID clubId = UUID.randomUUID();
        UUID roundSectionId = UUID.randomUUID();
        UUID accessibleSectionId = UUID.randomUUID();
        SectionAvailabilityRound round = round(UUID.randomUUID(), clubId, roundSectionId, true);
        when(sectionAvailabilityRoundRepository.findByClubId(clubId)).thenReturn(List.of(round));
        when(accessService.accessibleSectionIds(authentication, clubId))
                .thenReturn(Optional.of(Set.of(accessibleSectionId)));

        List<SectionAvailabilityRoundDto> result = service.list(authentication, clubId, null, null);

        assertThat(result).isEmpty();
    }

    // --- create ---

    private Team flexibleTeam(UUID id, UUID sectionId, String name) {
        return Team.builder().id(id).sectionId(sectionId).name(name).squadMode(SquadMode.FLEXIBLE).build();
    }

    @Test
    void createValidatesEachMatchAndCreatesExactlyTheWindowsTheySelectedMatchesNeed() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID saturdayMatchId = UUID.randomUUID();
        UUID sundayMatchId = UUID.randomUUID();
        Section section = section(clubId, sectionId);
        Team team = flexibleTeam(teamId, sectionId, "U15 Colts");
        Match saturdayMatch = Match.builder()
                .id(saturdayMatchId)
                .clubId(clubId)
                .homeTeamId(teamId)
                .awayTeamName("Occasionals")
                .matchDate(Instant.parse("2026-09-26T09:00:00Z"))
                .build();
        Match sundayMatch = Match.builder()
                .id(sundayMatchId)
                .clubId(clubId)
                .homeTeamId(teamId)
                .awayTeamName("Visitors")
                .matchDate(Instant.parse("2026-09-27T09:00:00Z"))
                .build();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section));
        when(matchRepository.findById(saturdayMatchId)).thenReturn(Optional.of(saturdayMatch));
        when(matchRepository.findById(sundayMatchId)).thenReturn(Optional.of(sundayMatch));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(matchResolver.resolveWindowKey(team, saturdayMatch))
                .thenReturn(new SectionAvailabilityMatchResolver.WindowKey(
                        sectionId, java.time.LocalDate.of(2026, 9, 26), DayPart.MORNING));
        when(matchResolver.resolveWindowKey(team, sundayMatch))
                .thenReturn(new SectionAvailabilityMatchResolver.WindowKey(
                        sectionId, java.time.LocalDate.of(2026, 9, 27), DayPart.MORNING));
        when(sectionAvailabilityWindowRepository.existsBySectionIdAndWindowDateAndDayPart(any(), any(), any()))
                .thenReturn(false);
        when(sectionAvailabilityRoundRepository.save(any(SectionAvailabilityRound.class)))
                .thenAnswer(invocation -> {
                    SectionAvailabilityRound saved = invocation.getArgument(0);
                    saved.setId(UUID.randomUUID());
                    return saved;
                });
        when(sectionAvailabilityWindowRepository.save(any(SectionAvailabilityWindow.class)))
                .thenAnswer(invocation -> {
                    SectionAvailabilityWindow saved = invocation.getArgument(0);
                    saved.setId(UUID.randomUUID());
                    return saved;
                });
        when(sectionAvailabilityWindowMatchRepository.save(any(SectionAvailabilityWindowMatch.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(audienceResolver.resolveAudience(sectionId)).thenReturn(List.of());
        when(sectionAvailabilityWindowRepository.findByRoundId(any())).thenReturn(List.of());

        service.create(
                authentication,
                clubId,
                new CreateSectionAvailabilityRoundRequest(
                        sectionId, "Weekend fixtures", List.of(saturdayMatchId, sundayMatchId), true));

        verify(accessService).assertCanAdministerSection(authentication, clubId, sectionId);
        ArgumentCaptor<SectionAvailabilityWindow> windowCaptor = ArgumentCaptor.forClass(SectionAvailabilityWindow.class);
        verify(sectionAvailabilityWindowRepository, times(2)).save(windowCaptor.capture());
        assertThat(windowCaptor.getAllValues()).extracting(SectionAvailabilityWindow::getWindowDate)
                .containsExactlyInAnyOrder(java.time.LocalDate.of(2026, 9, 26), java.time.LocalDate.of(2026, 9, 27));
        verify(sectionAvailabilityWindowMatchRepository, times(2)).save(any(SectionAvailabilityWindowMatch.class));

        ArgumentCaptor<SectionAvailabilityRound> roundCaptor = ArgumentCaptor.forClass(SectionAvailabilityRound.class);
        verify(sectionAvailabilityRoundRepository).save(roundCaptor.capture());
        assertThat(roundCaptor.getValue().getFirstMatchDate()).isEqualTo(java.time.LocalDate.of(2026, 9, 26));
        assertThat(roundCaptor.getValue().getLastMatchDate()).isEqualTo(java.time.LocalDate.of(2026, 9, 27));
        assertThat(roundCaptor.getValue().getScheduledCloseAt())
                .isEqualTo(Instant.parse("2026-09-26T09:00:00Z").minus(java.time.Duration.ofHours(24)));
    }

    @Test
    void createLeavesScheduledCloseAtNullWhenAutoCloseIsFalse() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        Section section = section(clubId, sectionId);
        Team team = flexibleTeam(teamId, sectionId, "U15 Colts");
        Match match = Match.builder()
                .id(matchId)
                .clubId(clubId)
                .homeTeamId(teamId)
                .awayTeamName("Occasionals")
                .matchDate(Instant.parse("2026-09-26T09:00:00Z"))
                .build();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section));
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(matchResolver.resolveWindowKey(team, match))
                .thenReturn(new SectionAvailabilityMatchResolver.WindowKey(
                        sectionId, java.time.LocalDate.of(2026, 9, 26), DayPart.MORNING));
        when(sectionAvailabilityWindowRepository.existsBySectionIdAndWindowDateAndDayPart(any(), any(), any()))
                .thenReturn(false);
        when(sectionAvailabilityRoundRepository.save(any(SectionAvailabilityRound.class)))
                .thenAnswer(invocation -> {
                    SectionAvailabilityRound saved = invocation.getArgument(0);
                    saved.setId(UUID.randomUUID());
                    return saved;
                });
        when(sectionAvailabilityWindowRepository.save(any(SectionAvailabilityWindow.class)))
                .thenAnswer(invocation -> {
                    SectionAvailabilityWindow saved = invocation.getArgument(0);
                    saved.setId(UUID.randomUUID());
                    return saved;
                });
        when(sectionAvailabilityWindowMatchRepository.save(any(SectionAvailabilityWindowMatch.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(audienceResolver.resolveAudience(sectionId)).thenReturn(List.of());
        when(sectionAvailabilityWindowRepository.findByRoundId(any())).thenReturn(List.of());

        service.create(
                authentication,
                clubId,
                new CreateSectionAvailabilityRoundRequest(sectionId, "Fixtures", List.of(matchId), false));

        ArgumentCaptor<SectionAvailabilityRound> roundCaptor = ArgumentCaptor.forClass(SectionAvailabilityRound.class);
        verify(sectionAvailabilityRoundRepository).save(roundCaptor.capture());
        assertThat(roundCaptor.getValue().isAutoClose()).isFalse();
        assertThat(roundCaptor.getValue().getScheduledCloseAt()).isNull();
    }

    @Test
    void createReturns400WhenAMatchDoesNotResolveToAFlexibleTeamInTheSection() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        Match match = Match.builder().id(matchId).clubId(clubId).homeTeamId(null).awayTeamName("Occasionals")
                .matchDate(Instant.now()).build();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(clubId, sectionId)));
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));

        assertThatThrownBy(() -> service.create(
                        authentication,
                        clubId,
                        new CreateSectionAvailabilityRoundRequest(sectionId, "Fixtures", List.of(matchId), true)))
                .isInstanceOf(ValidationException.class);
        verify(sectionAvailabilityRoundRepository, never()).save(any());
    }

    @Test
    void createReturns400WhenTheMatchsOwnTeamIsAttachedButNotFlexibleInThisSection() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        // A real, resolvable team, but STATIC — the actual business rule this validation
        // enforces, not just "no team attached at all" (the degenerate case above).
        Team staticTeam = Team.builder().id(teamId).sectionId(sectionId).name("1st XI")
                .squadMode(SquadMode.STATIC).build();
        Match match = Match.builder().id(matchId).clubId(clubId).homeTeamId(teamId).awayTeamName("Occasionals")
                .matchDate(Instant.now()).build();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(clubId, sectionId)));
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(staticTeam));

        assertThatThrownBy(() -> service.create(
                        authentication,
                        clubId,
                        new CreateSectionAvailabilityRoundRequest(sectionId, "Fixtures", List.of(matchId), true)))
                .isInstanceOf(ValidationException.class);
        verify(sectionAvailabilityRoundRepository, never()).save(any());
    }

    @Test
    void createReturns400WhenTheMatchsOwnTeamBelongsToADifferentSection() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID otherSectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        Team teamInOtherSection = flexibleTeam(teamId, otherSectionId, "U15 Colts");
        Match match = Match.builder().id(matchId).clubId(clubId).homeTeamId(teamId).awayTeamName("Occasionals")
                .matchDate(Instant.now()).build();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(clubId, sectionId)));
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(teamInOtherSection));

        assertThatThrownBy(() -> service.create(
                        authentication,
                        clubId,
                        new CreateSectionAvailabilityRoundRequest(sectionId, "Fixtures", List.of(matchId), true)))
                .isInstanceOf(ValidationException.class);
        verify(sectionAvailabilityRoundRepository, never()).save(any());
    }

    @Test
    void createReturns409WhenAMatchesBracketAlreadyHasAWindow() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        Team team = flexibleTeam(teamId, sectionId, "U15 Colts");
        Match match = Match.builder().id(matchId).clubId(clubId).homeTeamId(teamId).awayTeamName("Occasionals")
                .matchDate(Instant.parse("2026-09-26T09:00:00Z")).build();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(clubId, sectionId)));
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(matchResolver.resolveWindowKey(team, match)).thenReturn(new SectionAvailabilityMatchResolver.WindowKey(
                sectionId, java.time.LocalDate.of(2026, 9, 26), DayPart.MORNING));
        when(sectionAvailabilityWindowRepository.existsBySectionIdAndWindowDateAndDayPart(
                        sectionId, java.time.LocalDate.of(2026, 9, 26), DayPart.MORNING))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(
                        authentication,
                        clubId,
                        new CreateSectionAvailabilityRoundRequest(sectionId, "Fixtures", List.of(matchId), true)))
                .isInstanceOf(MatchAlreadyPolledException.class);
        verify(sectionAvailabilityRoundRepository, never()).save(any());
    }

    @Test
    void createReturns404WhenSectionBelongsToADifferentClub() {
        UUID sectionId = UUID.randomUUID();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(UUID.randomUUID(), sectionId)));

        assertThatThrownBy(() -> service.create(
                        authentication,
                        UUID.randomUUID(),
                        new CreateSectionAvailabilityRoundRequest(
                                sectionId, "Fixtures", List.of(UUID.randomUUID()), true)))
                .isInstanceOf(NotFoundException.class);
    }

    // --- updateDescription ---

    @Test
    void updateDescriptionEditsTheDescriptionOnly() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound existingRound = round(roundId, clubId, sectionId, true);
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(existingRound));
        when(sectionAvailabilityRoundRepository.save(any(SectionAvailabilityRound.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(sectionAvailabilityWindowRepository.findByRoundId(roundId)).thenReturn(List.of());
        when(audienceResolver.resolveAudience(sectionId)).thenReturn(List.of());
        stubEmptyBracketsFor(sectionId);

        service.updateDescription(
                authentication, clubId, roundId, new UpdateSectionAvailabilityRoundDescriptionRequest("New title"));

        assertThat(existingRound.getDescription()).isEqualTo("New title");
    }

    // --- open/close ---

    @Test
    void openTransitionsAClosedRoundToOpenAndCascadesToEveryWindow() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound closedRound = round(roundId, clubId, sectionId, false);
        SectionAvailabilityWindow morning = SectionAvailabilityWindow.builder()
                .id(UUID.randomUUID()).roundId(roundId).sectionId(sectionId)
                .windowDate(java.time.LocalDate.of(2026, 9, 27)).dayPart(DayPart.MORNING).open(false).build();
        SectionAvailabilityWindow afternoon = SectionAvailabilityWindow.builder()
                .id(UUID.randomUUID()).roundId(roundId).sectionId(sectionId)
                .windowDate(java.time.LocalDate.of(2026, 9, 27)).dayPart(DayPart.AFTERNOON).open(false).build();
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(closedRound));
        when(sectionAvailabilityRoundRepository.save(any(SectionAvailabilityRound.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(sectionAvailabilityWindowRepository.findByRoundId(roundId)).thenReturn(List.of(morning, afternoon));
        when(sectionAvailabilityWindowRepository.save(any(SectionAvailabilityWindow.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(audienceResolver.resolveAudience(sectionId)).thenReturn(List.of());
        when(sectionAvailabilityWindowMatchRepository.findByWindowId(any())).thenReturn(List.of());

        service.open(authentication, clubId, roundId);

        assertThat(closedRound.isOpen()).isTrue();
        assertThat(morning.isOpen()).isTrue();
        assertThat(afternoon.isOpen()).isTrue();
    }

    @Test
    void openReturns409WhenRoundIsAlreadyOpen() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound openRound = round(roundId, clubId, sectionId, true);
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(openRound));

        assertThatThrownBy(() -> service.open(authentication, clubId, roundId))
                .isInstanceOf(InvalidStatusTransitionException.class);
        verify(sectionAvailabilityRoundRepository, never()).save(any());
    }

    @Test
    void closeReturns409WhenRoundIsAlreadyClosed() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound closedRound = round(roundId, clubId, sectionId, false);
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(closedRound));

        assertThatThrownBy(() -> service.close(authentication, clubId, roundId))
                .isInstanceOf(InvalidStatusTransitionException.class);
        verify(sectionAvailabilityRoundRepository, never()).save(any());
    }

    @Test
    void openReturns404WhenRoundBelongsToADifferentClub() {
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound otherClubsRound = round(roundId, UUID.randomUUID(), UUID.randomUUID(), false);
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(otherClubsRound));

        assertThatThrownBy(() -> service.open(authentication, UUID.randomUUID(), roundId))
                .isInstanceOf(NotFoundException.class);
    }

    // --- getResponses ---

    @Test
    void getResponsesMergesEachBracketsOwnStatusIntoOnePerPlayerRow() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        UUID morningWindowId = UUID.randomUUID();
        UUID afternoonWindowId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        SectionAvailabilityRound openRound = round(roundId, clubId, sectionId, true);
        SectionAvailabilityWindow morning = SectionAvailabilityWindow.builder()
                .id(morningWindowId).roundId(roundId).sectionId(sectionId)
                .windowDate(java.time.LocalDate.of(2026, 9, 27)).dayPart(DayPart.MORNING).open(true).build();
        SectionAvailabilityWindow afternoon = SectionAvailabilityWindow.builder()
                .id(afternoonWindowId).roundId(roundId).sectionId(sectionId)
                .windowDate(java.time.LocalDate.of(2026, 9, 27)).dayPart(DayPart.AFTERNOON).open(true).build();
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(openRound));
        when(sectionAvailabilityWindowRepository.findByRoundId(roundId)).thenReturn(List.of(morning, afternoon));
        when(audienceResolver.resolveAudience(sectionId))
                .thenReturn(List.of(new SectionAvailabilityResponseRowDto(playerId, "Alice", "A", 7, null)));
        when(sectionAvailabilityResponseRepository.findByWindowId(morningWindowId)).thenReturn(List.of(
                SectionAvailabilityResponse.builder().windowId(morningWindowId).playerProfileId(playerId)
                        .status(AvailabilityStatus.AVAILABLE).build()));
        when(sectionAvailabilityResponseRepository.findByWindowId(afternoonWindowId)).thenReturn(List.of());
        when(sectionAvailabilityWindowMatchRepository.findByWindowId(any())).thenReturn(List.of());

        SectionAvailabilityRoundResponsesDto responses = service.getResponses(authentication, clubId, roundId);

        assertThat(responses.responses()).hasSize(1);
        assertThat(responses.responses().get(0).statuses()).hasSize(2);
        assertThat(responses.responses().get(0).statuses())
                .filteredOn(status -> status.windowId().equals(morningWindowId))
                .extracting(com.cricketlegend.dto.SectionAvailabilityRoundStatusDto::status)
                .containsExactly(AvailabilityStatus.AVAILABLE);
        assertThat(responses.responses().get(0).statuses())
                .filteredOn(status -> status.windowId().equals(afternoonWindowId))
                .extracting(com.cricketlegend.dto.SectionAvailabilityRoundStatusDto::status)
                .containsExactly((AvailabilityStatus) null);
        assertThat(responses.brackets()).hasSize(2);
        assertThat(responses.publicPath()).isEqualTo("/section-availability/" + roundId);
    }

    // --- getMatches ---

    @Test
    void getMatchesTagsEachBracketsCoveredMatchesWithItsOwnWindow() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        UUID morningWindowId = UUID.randomUUID();
        UUID afternoonWindowId = UUID.randomUUID();
        UUID morningTeamId = UUID.randomUUID();
        UUID afternoonTeamId = UUID.randomUUID();
        UUID morningMatchId = UUID.randomUUID();
        UUID afternoonMatchId = UUID.randomUUID();
        SectionAvailabilityRound openRound = round(roundId, clubId, sectionId, true);
        SectionAvailabilityWindow morning = SectionAvailabilityWindow.builder()
                .id(morningWindowId).roundId(roundId).sectionId(sectionId).dayPart(DayPart.MORNING).open(true).build();
        SectionAvailabilityWindow afternoon = SectionAvailabilityWindow.builder()
                .id(afternoonWindowId).roundId(roundId).sectionId(sectionId).dayPart(DayPart.AFTERNOON).open(true).build();
        Team morningTeam = Team.builder()
                .id(morningTeamId).sectionId(sectionId).name("U15 Colts").squadMode(SquadMode.FLEXIBLE).build();
        Team afternoonTeam = Team.builder()
                .id(afternoonTeamId).sectionId(sectionId).name("U15 Panthers").squadMode(SquadMode.FLEXIBLE).build();
        Match morningMatch = Match.builder()
                .id(morningMatchId)
                .homeTeamId(morningTeamId)
                .awayTeamName("Occasionals")
                .matchDate(Instant.parse("2026-09-27T09:00:00Z"))
                .venue("Home Ground")
                .build();
        Match afternoonMatch = Match.builder()
                .id(afternoonMatchId)
                .homeTeamId(afternoonTeamId)
                .awayTeamName("Visitors")
                .matchDate(Instant.parse("2026-09-27T14:00:00Z"))
                .venue("Away Ground")
                .build();
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(openRound));
        when(sectionAvailabilityWindowRepository.findByRoundId(roundId)).thenReturn(List.of(morning, afternoon));
        when(sectionAvailabilityWindowMatchRepository.findByWindowIdIn(any())).thenReturn(List.of(
                SectionAvailabilityWindowMatch.builder().windowId(morningWindowId).matchId(morningMatchId).build(),
                SectionAvailabilityWindowMatch.builder().windowId(afternoonWindowId).matchId(afternoonMatchId).build()));
        when(matchRepository.findById(morningMatchId)).thenReturn(Optional.of(morningMatch));
        when(matchRepository.findById(afternoonMatchId)).thenReturn(Optional.of(afternoonMatch));
        when(teamRepository.findById(morningTeamId)).thenReturn(Optional.of(morningTeam));
        when(teamRepository.findById(afternoonTeamId)).thenReturn(Optional.of(afternoonTeam));

        List<SectionAvailabilityRoundMatchDto> result = service.getMatches(authentication, clubId, roundId);

        assertThat(result).hasSize(2);
        assertThat(result)
                .extracting(
                        SectionAvailabilityRoundMatchDto::matchId,
                        SectionAvailabilityRoundMatchDto::teamId,
                        SectionAvailabilityRoundMatchDto::opponentLabel,
                        SectionAvailabilityRoundMatchDto::windowId)
                .containsExactlyInAnyOrder(
                        tuple(morningMatchId, morningTeamId, "Occasionals", morningWindowId),
                        tuple(afternoonMatchId, afternoonTeamId, "Visitors", afternoonWindowId));
    }

    @Test
    void getMatchesReturns404WhenRoundBelongsToADifferentClub() {
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound otherClubsRound = round(roundId, UUID.randomUUID(), UUID.randomUUID(), true);
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(otherClubsRound));

        assertThatThrownBy(() -> service.getMatches(authentication, UUID.randomUUID(), roundId))
                .isInstanceOf(NotFoundException.class);
    }

    // --- setPlayerStatus (admin override) ---

    @Test
    void setPlayerStatusRejectsAPlayerNotInTheRoundsOwnAudience() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        SectionAvailabilityRound openRound = round(roundId, clubId, sectionId, true);
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(openRound));
        when(audienceResolver.resolveAudience(sectionId)).thenReturn(List.of());

        assertThatThrownBy(() -> service.setPlayerStatus(
                        authentication, clubId, roundId, playerId, UUID.randomUUID(), AvailabilityStatus.AVAILABLE))
                .isInstanceOf(NotFoundException.class);
        verify(sectionAvailabilityResponseRepository, never()).save(any());
    }

    @Test
    void setPlayerStatusRejectsAWriteAgainstAClosedBracket() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        UUID windowId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        SectionAvailabilityRound openRound = round(roundId, clubId, sectionId, true);
        SectionAvailabilityWindow closedWindow = SectionAvailabilityWindow.builder()
                .id(windowId).roundId(roundId).sectionId(sectionId).dayPart(DayPart.MORNING).open(false).build();
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(openRound));
        when(audienceResolver.resolveAudience(sectionId))
                .thenReturn(List.of(new SectionAvailabilityResponseRowDto(playerId, "Alice", "A", null, null)));
        when(sectionAvailabilityWindowRepository.findById(windowId)).thenReturn(Optional.of(closedWindow));

        assertThatThrownBy(() -> service.setPlayerStatus(
                        authentication, clubId, roundId, playerId, windowId, AvailabilityStatus.AVAILABLE))
                .isInstanceOf(SectionAvailabilityWindowClosedException.class);
        verify(sectionAvailabilityResponseRepository, never()).save(any());
    }

    @Test
    void setPlayerStatusUpsertsAResponseAgainstTheResolvedWindow() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        UUID windowId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        SectionAvailabilityRound openRound = round(roundId, clubId, sectionId, true);
        SectionAvailabilityWindow openWindow = SectionAvailabilityWindow.builder()
                .id(windowId).roundId(roundId).sectionId(sectionId).dayPart(DayPart.MORNING).open(true).build();
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(openRound));
        when(audienceResolver.resolveAudience(sectionId))
                .thenReturn(List.of(new SectionAvailabilityResponseRowDto(playerId, "Alice", "A", null, null)));
        when(sectionAvailabilityWindowRepository.findById(windowId)).thenReturn(Optional.of(openWindow));
        when(sectionAvailabilityResponseRepository.findByWindowIdAndPlayerProfileId(windowId, playerId))
                .thenReturn(Optional.empty());
        when(sectionAvailabilityWindowRepository.findByRoundId(roundId)).thenReturn(List.of(openWindow));
        when(sectionAvailabilityResponseRepository.findByWindowId(windowId)).thenReturn(List.of());
        when(sectionAvailabilityWindowMatchRepository.findByWindowId(any())).thenReturn(List.of());

        SectionAvailabilityRoundResponsesDto result = service.setPlayerStatus(
                authentication, clubId, roundId, playerId, windowId, AvailabilityStatus.UNAVAILABLE);

        ArgumentCaptor<SectionAvailabilityResponse> captor = ArgumentCaptor.forClass(SectionAvailabilityResponse.class);
        verify(sectionAvailabilityResponseRepository).save(captor.capture());
        assertThat(captor.getValue().getWindowId()).isEqualTo(windowId);
        assertThat(captor.getValue().getPlayerProfileId()).isEqualTo(playerId);
        assertThat(captor.getValue().getStatus()).isEqualTo(AvailabilityStatus.UNAVAILABLE);
        assertThat(result.roundId()).isEqualTo(roundId);
    }
}
