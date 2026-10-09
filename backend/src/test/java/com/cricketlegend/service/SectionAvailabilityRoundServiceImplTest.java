package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
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
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.CreateSectionAvailabilityRoundRequest;
import com.cricketlegend.dto.SectionAvailabilityResponseRowDto;
import com.cricketlegend.dto.SectionAvailabilityRoundDto;
import com.cricketlegend.dto.SectionAvailabilityRoundMatchDto;
import com.cricketlegend.dto.SectionAvailabilityRoundResponsesDto;
import com.cricketlegend.dto.UpdatePollCloseTimeRequest;
import com.cricketlegend.dto.UpdateSectionAvailabilityRoundDescriptionRequest;
import com.cricketlegend.exception.InvalidCloseTimeException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.MatchAlreadyPolledException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.SectionAvailabilityRoundMapper;
import com.cricketlegend.repository.LeagueRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.MatchSquadMemberRepository;
import com.cricketlegend.repository.SectionAvailabilityResponseRepository;
import com.cricketlegend.repository.SectionAvailabilityRoundRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowMatchRepository;
import com.cricketlegend.repository.SectionAvailabilityWindowRepository;
import com.cricketlegend.repository.SectionRepository;
import com.cricketlegend.repository.TeamRepository;
import com.cricketlegend.service.impl.SectionAvailabilityRoundServiceImpl;
import com.cricketlegend.service.support.AvailabilityPollFilter;
import com.cricketlegend.service.support.AvailabilityPollFilters;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
 * closed bracket (accepted since 066), now {@code windowId}-keyed.
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
    private MatchSquadMemberRepository matchSquadMemberRepository;

    @Mock
    private MatchPollCoverageService coverageService;

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
                matchSquadMemberRepository,
                coverageService,
                accessService,
                pollFilters(),
                java.time.Clock.systemUTC());
        org.mockito.Mockito.lenient()
                .when(coverageService.resolveAny(any()))
                .thenReturn(MatchPollCoverageService.Coverage.NONE);
    }

    /** The real shared filter over this test's mocked access service and repositories. */
    private AvailabilityPollFilters pollFilters() {
        return new AvailabilityPollFilters(
                accessService,
                leagueRepository,
                teamRepository,
                matchRepository,
                sectionAvailabilityWindowRepository,
                sectionAvailabilityWindowMatchRepository);
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
        when(sectionAvailabilityRoundMapper.toDto(any(), any(), any(), any(), anyBoolean())).thenAnswer(invocation -> {
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
                    invocation.getArgument(2),
                    round.isOpen(),
                    List.of(),
                    invocation.getArgument(4));
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

        List<SectionAvailabilityRoundDto> result = service.list(authentication, clubId, matchingSectionId, null, null, null, null);

        verify(accessService).assertCanAdministerSection(authentication, clubId, matchingSectionId);
        assertThat(result).hasSize(1);
    }

    @Test
    void listWithOpenFalseReturnsOnlyClosedRoundsMostRecentFirstCappedAtFifty() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        List<SectionAvailabilityRound> rounds = new java.util.ArrayList<>();
        rounds.add(round(UUID.randomUUID(), clubId, sectionId, true)); // open: excluded
        for (int i = 0; i < 60; i++) {
            SectionAvailabilityRound closed = round(UUID.randomUUID(), clubId, sectionId, false);
            closed.setLastMatchDate(java.time.LocalDate.of(2026, 1, 1).plusDays(i));
            rounds.add(closed);
        }
        when(sectionAvailabilityRoundRepository.findByClubId(clubId)).thenReturn(rounds);
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(sectionAvailabilityWindowRepository.findByRoundId(any())).thenReturn(List.of());
        stubEmptyBracketsFor(sectionId);

        List<SectionAvailabilityRoundDto> result = service.list(authentication, clubId, null, null, null, null, false);

        assertThat(result).hasSize(AvailabilityPollFilter.CLOSED_POLLS_LIMIT);
        assertThat(result).allMatch(dto -> !dto.open());
        assertThat(result.get(0).lastMatchDate()).isEqualTo(java.time.LocalDate.of(2026, 1, 1).plusDays(59));
        assertThat(result.get(49).lastMatchDate()).isEqualTo(java.time.LocalDate.of(2026, 1, 1).plusDays(10));
    }

    // --- list: league / team narrowing through the shared filter (docs/specs/083) ---

    private static final UUID SLOT_SEASON_ID = UUID.randomUUID();

    private record Slots(UUID leagueRoundId, UUID teamRoundId, UUID otherRoundId, UUID leagueId, UUID teamId) {
    }

    /** Three rounds: one with an active slot match in the league, one with the team as a side, one with neither. */
    private Slots stubSlotWorld(UUID clubId, UUID sectionId, boolean slotMatchActive) {
        UUID leagueId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        SectionAvailabilityRound leagueRound = round(UUID.randomUUID(), clubId, sectionId, true);
        SectionAvailabilityRound teamRound = round(UUID.randomUUID(), clubId, sectionId, true);
        SectionAvailabilityRound otherRound = round(UUID.randomUUID(), clubId, sectionId, true);
        Match inLeague = Match.builder().id(UUID.randomUUID()).clubId(clubId).leagueId(leagueId)
                .homeTeamId(UUID.randomUUID()).active(slotMatchActive).build();
        Match withTeam = Match.builder().id(UUID.randomUUID()).clubId(clubId).awayTeamId(teamId).seasonId(SLOT_SEASON_ID)
                .homeTeamId(UUID.randomUUID()).active(slotMatchActive).build();
        Match elsewhere = Match.builder().id(UUID.randomUUID()).clubId(clubId).leagueId(UUID.randomUUID())
                .homeTeamId(UUID.randomUUID()).active(true).build();
        UUID w1 = UUID.randomUUID();
        UUID w2 = UUID.randomUUID();
        UUID w3 = UUID.randomUUID();
        when(sectionAvailabilityRoundRepository.findByClubId(clubId))
                .thenReturn(List.of(leagueRound, teamRound, otherRound));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        org.mockito.Mockito.lenient().when(sectionAvailabilityWindowRepository.findByRoundIdIn(any())).thenReturn(List.of(
                SectionAvailabilityWindow.builder().id(w1).roundId(leagueRound.getId()).build(),
                SectionAvailabilityWindow.builder().id(w2).roundId(teamRound.getId()).build(),
                SectionAvailabilityWindow.builder().id(w3).roundId(otherRound.getId()).build()));
        org.mockito.Mockito.lenient().when(sectionAvailabilityWindowMatchRepository.findByWindowIdIn(any())).thenReturn(List.of(
                com.cricketlegend.domain.SectionAvailabilityWindowMatch.builder().windowId(w1).matchId(inLeague.getId()).build(),
                com.cricketlegend.domain.SectionAvailabilityWindowMatch.builder().windowId(w2).matchId(withTeam.getId()).build(),
                com.cricketlegend.domain.SectionAvailabilityWindowMatch.builder().windowId(w3).matchId(elsewhere.getId()).build()));
        org.mockito.Mockito.lenient().when(matchRepository.findAllById(any())).thenReturn(List.of(inLeague, withTeam, elsewhere));
        if (slotMatchActive) {
            stubEmptyBracketsFor(sectionId); // only rounds that survive the narrowing are rendered
        }
        return new Slots(leagueRound.getId(), teamRound.getId(), otherRound.getId(), leagueId, teamId);
    }

    @Test
    void listNarrowsByLeagueToRoundsWithAnActiveSlotMatchInIt() {
        UUID clubId = UUID.randomUUID();
        Slots slots = stubSlotWorld(clubId, UUID.randomUUID(), true);
        when(leagueRepository.findById(slots.leagueId()))
                .thenReturn(Optional.of(com.cricketlegend.domain.League.builder().id(slots.leagueId()).clubId(clubId).build()));

        List<SectionAvailabilityRoundDto> result = service.list(authentication, clubId, null, slots.leagueId(), null, null, null);

        assertThat(result).extracting(SectionAvailabilityRoundDto::id).containsExactly(slots.leagueRoundId());
    }

    @Test
    void listNarrowsBySeasonToRoundsWithAnActiveSlotMatchInIt() {
        UUID clubId = UUID.randomUUID();
        Slots slots = stubSlotWorld(clubId, UUID.randomUUID(), true);

        assertThat(service.list(authentication, clubId, null, null, null, SLOT_SEASON_ID, null))
                .extracting(SectionAvailabilityRoundDto::id).containsExactly(slots.teamRoundId());
        assertThat(service.list(authentication, clubId, null, null, null, UUID.randomUUID(), null)).isEmpty();
        assertThat(service.list(authentication, clubId, null, null, null, null, null)).hasSize(3);
    }

    @Test
    void listNarrowsByTeamToRoundsWhereTheTeamIsASideOfASlotMatch() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Slots slots = stubSlotWorld(clubId, sectionId, true);
        when(teamRepository.findById(slots.teamId())).thenReturn(Optional.of(
                com.cricketlegend.domain.Team.builder().id(slots.teamId()).clubId(clubId).sectionId(sectionId).build()));

        List<SectionAvailabilityRoundDto> result = service.list(authentication, clubId, null, null, slots.teamId(), null, null);

        assertThat(result).extracting(SectionAvailabilityRoundDto::id).containsExactly(slots.teamRoundId());
        verify(accessService).assertCanAdministerSection(authentication, clubId, sectionId);
    }

    @Test
    void aDeactivatedSlotMatchDoesNotSatisfyALeagueOrTeamNarrowing() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        Slots slots = stubSlotWorld(clubId, sectionId, false);
        when(leagueRepository.findById(slots.leagueId()))
                .thenReturn(Optional.of(com.cricketlegend.domain.League.builder().id(slots.leagueId()).clubId(clubId).build()));

        assertThat(service.list(authentication, clubId, null, slots.leagueId(), null, null, null)).isEmpty();
    }

    @Test
    void listWithALeagueOrTeamOfAnotherClubIsNotFound() {
        UUID clubId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(leagueRepository.findById(leagueId)).thenReturn(Optional.of(
                com.cricketlegend.domain.League.builder().id(leagueId).clubId(UUID.randomUUID()).build()));
        org.mockito.Mockito.lenient().when(teamRepository.findById(teamId)).thenReturn(Optional.of(
                com.cricketlegend.domain.Team.builder().id(teamId).clubId(UUID.randomUUID()).sectionId(UUID.randomUUID()).build()));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.list(authentication, clubId, null, leagueId, null, null, null))
                .isInstanceOf(com.cricketlegend.exception.NotFoundException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.list(authentication, clubId, null, null, teamId, null, null))
                .isInstanceOf(com.cricketlegend.exception.NotFoundException.class);
    }

    @Test
    void theClosedCapAppliesAfterTheLeagueNarrowing() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID leagueId = UUID.randomUUID();
        Match inLeague = Match.builder().id(UUID.randomUUID()).clubId(clubId).leagueId(leagueId).active(true).build();
        List<SectionAvailabilityRound> rounds = new java.util.ArrayList<>();
        List<SectionAvailabilityWindow> windows = new java.util.ArrayList<>();
        List<com.cricketlegend.domain.SectionAvailabilityWindowMatch> links = new java.util.ArrayList<>();
        List<Match> allMatches = new java.util.ArrayList<>();
        // 55 newer closed rounds outside the league, 3 older closed rounds inside it
        for (int i = 0; i < 58; i++) {
            SectionAvailabilityRound closed = round(UUID.randomUUID(), clubId, sectionId, false);
            boolean inside = i >= 55;
            closed.setLastMatchDate(java.time.LocalDate.of(2026, 1, 1).plusDays(inside ? 0 : 100 + i));
            rounds.add(closed);
            UUID window = UUID.randomUUID();
            windows.add(SectionAvailabilityWindow.builder().id(window).roundId(closed.getId()).build());
            Match slot = inside ? inLeague
                    : Match.builder().id(UUID.randomUUID()).clubId(clubId).leagueId(UUID.randomUUID()).active(true).build();
            links.add(com.cricketlegend.domain.SectionAvailabilityWindowMatch.builder()
                    .windowId(window).matchId(slot.getId()).build());
            if (!allMatches.contains(slot)) {
                allMatches.add(slot);
            }
        }
        when(sectionAvailabilityRoundRepository.findByClubId(clubId)).thenReturn(rounds);
        when(matchRepository.findAllById(any())).thenReturn(allMatches);
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(leagueRepository.findById(leagueId))
                .thenReturn(Optional.of(com.cricketlegend.domain.League.builder().id(leagueId).clubId(clubId).build()));
        when(sectionAvailabilityWindowRepository.findByRoundIdIn(any())).thenReturn(windows);
        when(sectionAvailabilityWindowMatchRepository.findByWindowIdIn(any())).thenReturn(links);
        stubEmptyBracketsFor(sectionId);

        List<SectionAvailabilityRoundDto> result = service.list(authentication, clubId, null, leagueId, null, null, false);

        // narrowed first: the 3 in-league rounds survive although 55 newer ones were closed outside it
        assertThat(result).hasSize(3);
    }

    private SectionAvailabilityRound closedRoundWithSchedule(
            UUID clubId, UUID roundId, boolean autoClose, java.time.Instant scheduledCloseAt) {
        UUID sectionId = UUID.randomUUID();
        SectionAvailabilityRound closedRound = round(roundId, clubId, sectionId, false);
        closedRound.setAutoClose(autoClose);
        closedRound.setScheduledCloseAt(scheduledCloseAt);
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(closedRound));
        org.mockito.Mockito.lenient()
                .when(sectionAvailabilityRoundRepository.save(any(SectionAvailabilityRound.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        org.mockito.Mockito.lenient().when(sectionAvailabilityWindowRepository.findByRoundId(roundId))
                .thenReturn(List.of());
        org.mockito.Mockito.lenient().when(audienceResolver.resolveAudience(sectionId)).thenReturn(List.of());
        return closedRound;
    }

    @Test
    void openBeforeTheScheduledCloseTimeSucceedsAndKeepsTheSchedule() {
        UUID clubId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        java.time.Instant closeAt = java.time.Instant.now().plusSeconds(7200);
        SectionAvailabilityRound round = closedRoundWithSchedule(clubId, roundId, true, closeAt);

        service.open(authentication, clubId, roundId);

        assertThat(round.isOpen()).isTrue();
        assertThat(round.getScheduledCloseAt()).isEqualTo(closeAt);
    }

    @Test
    void openAtOrAfterTheScheduledCloseTimeThrowsReopenWindowPassed() {
        UUID clubId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound round =
                closedRoundWithSchedule(clubId, roundId, true, java.time.Instant.now().minusSeconds(1));

        assertThatThrownBy(() -> service.open(authentication, clubId, roundId))
                .isInstanceOf(com.cricketlegend.exception.ReopenWindowPassedException.class);
        assertThat(round.isOpen()).isFalse();
        verify(sectionAvailabilityRoundRepository, never()).save(any(SectionAvailabilityRound.class));
    }

    @Test
    void openIsAlwaysAllowedWhenAutoCloseIsOff() {
        UUID clubId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound round = closedRoundWithSchedule(clubId, roundId, false, null);

        service.open(authentication, clubId, roundId);

        assertThat(round.isOpen()).isTrue();
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

        List<SectionAvailabilityRoundDto> result = service.list(authentication, clubId, null, null, null, null, true);

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

        List<SectionAvailabilityRoundDto> result = service.list(authentication, clubId, null, null, null, null, null);

        assertThat(result).isEmpty();
    }

    // --- create ---

    private Team flexibleTeam(UUID id, UUID sectionId, String name) {
        return Team.builder().id(id).sectionId(sectionId).name(name).build();
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
                        sectionId, "Weekend fixtures", List.of(saturdayMatchId, sundayMatchId), true, null));

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
                new CreateSectionAvailabilityRoundRequest(sectionId, "Fixtures", List.of(matchId), false, null));

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
                        new CreateSectionAvailabilityRoundRequest(sectionId, "Fixtures", List.of(matchId), true, null)))
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
                        new CreateSectionAvailabilityRoundRequest(sectionId, "Fixtures", List.of(matchId), true, null)))
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
                        new CreateSectionAvailabilityRoundRequest(sectionId, "Fixtures", List.of(matchId), true, null)))
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
                                sectionId, "Fixtures", List.of(UUID.randomUUID()), true, null)))
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
                .id(morningTeamId).sectionId(sectionId).name("U15 Colts").build();
        Team afternoonTeam = Team.builder()
                .id(afternoonTeamId).sectionId(sectionId).name("U15 Panthers").build();
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
        when(sectionAvailabilityWindowRepository.findByRoundIdIn(any())).thenReturn(List.of(morning, afternoon));
        when(sectionAvailabilityWindowMatchRepository.findByWindowIdIn(any())).thenReturn(List.of(
                SectionAvailabilityWindowMatch.builder().windowId(morningWindowId).matchId(morningMatchId).build(),
                SectionAvailabilityWindowMatch.builder().windowId(afternoonWindowId).matchId(afternoonMatchId).build()));
        when(matchRepository.findAllById(any())).thenReturn(List.of(morningMatch, afternoonMatch));
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

    // 070: a league-team side has no teamId, so only the own team gets a row, labelled with the
    // copied *TeamName.
    @Test
    void getMatchesLabelsALeagueTeamOpponentByItsCopiedNameAndGivesItNoRow() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        UUID windowId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        SectionAvailabilityRound openRound = round(roundId, clubId, sectionId, true);
        SectionAvailabilityWindow window = SectionAvailabilityWindow.builder()
                .id(windowId).roundId(roundId).sectionId(sectionId).dayPart(DayPart.MORNING).open(true).build();
        Match match = Match.builder()
                .id(matchId)
                .homeTeamId(teamId)
                .awayTeamName("Hillside CC")
                .awayLeagueTeamId(UUID.randomUUID())
                .matchDate(Instant.parse("2026-09-27T09:00:00Z"))
                .build();
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(openRound));
        when(sectionAvailabilityWindowRepository.findByRoundIdIn(any())).thenReturn(List.of(window));
        when(sectionAvailabilityWindowMatchRepository.findByWindowIdIn(any())).thenReturn(List.of(
                SectionAvailabilityWindowMatch.builder().windowId(windowId).matchId(matchId).build()));
        when(matchRepository.findAllById(any())).thenReturn(List.of(match));
        when(teamRepository.findById(teamId))
                .thenReturn(Optional.of(Team.builder().id(teamId).sectionId(sectionId).name("U15 Colts").build()));

        List<SectionAvailabilityRoundMatchDto> result = service.getMatches(authentication, clubId, roundId);

        assertThat(result)
                .extracting(SectionAvailabilityRoundMatchDto::teamId, SectionAvailabilityRoundMatchDto::opponentLabel)
                .containsExactly(tuple(teamId, "Hillside CC"));
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
    void setPlayerStatusAcceptsAnAdminOverrideAgainstAClosedBracketAndKeepsItClosed() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        UUID windowId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        SectionAvailabilityRound closedRound = round(roundId, clubId, sectionId, false);
        SectionAvailabilityWindow closedWindow = SectionAvailabilityWindow.builder()
                .id(windowId).roundId(roundId).sectionId(sectionId).dayPart(DayPart.MORNING).open(false).build();
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(closedRound));
        when(audienceResolver.resolveAudience(sectionId))
                .thenReturn(List.of(new SectionAvailabilityResponseRowDto(playerId, "Alice", "A", null, null)));
        when(sectionAvailabilityWindowRepository.findById(windowId)).thenReturn(Optional.of(closedWindow));
        when(sectionAvailabilityResponseRepository.findByWindowIdAndPlayerProfileId(windowId, playerId))
                .thenReturn(Optional.empty());
        when(sectionAvailabilityWindowRepository.findByRoundId(roundId)).thenReturn(List.of(closedWindow));
        when(sectionAvailabilityResponseRepository.findByWindowId(windowId)).thenReturn(List.of());
        when(sectionAvailabilityWindowMatchRepository.findByWindowId(any())).thenReturn(List.of());

        service.setPlayerStatus(
                authentication, clubId, roundId, playerId, windowId, AvailabilityStatus.AVAILABLE);

        ArgumentCaptor<SectionAvailabilityResponse> captor = ArgumentCaptor.forClass(SectionAvailabilityResponse.class);
        verify(sectionAvailabilityResponseRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(AvailabilityStatus.AVAILABLE);
        assertThat(closedRound.isOpen()).isFalse();
        assertThat(closedWindow.isOpen()).isFalse();
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

    // --- 064: cross-kind 409, delete, auto-close ---

    @Test
    void createReturns409WhenASelectedMatchAlreadyHasASquadPoll() {
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
        when(coverageService.resolveAny(matchId))
                .thenReturn(new MatchPollCoverageService.Coverage(
                        MatchPollCoverageService.Kind.SQUAD, UUID.randomUUID(), null, null, "U15 Colts v Occasionals"));

        assertThatThrownBy(() -> service.create(
                        authentication,
                        clubId,
                        new CreateSectionAvailabilityRoundRequest(sectionId, "Fixtures", List.of(matchId), true, null)))
                .isInstanceOf(MatchAlreadyPolledException.class)
                .hasMessageContaining("U15 Colts v Occasionals");
        verify(sectionAvailabilityRoundRepository, never()).save(any());
    }

    // docs/specs/076-team-selection.md: stale match-squad rows no longer block a delete, they are removed.
    @Test
    void deleteClearsTheRoundsMatchSquadMembersInsteadOfRefusing() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        UUID windowId = UUID.randomUUID();
        SectionAvailabilityRound round = round(roundId, clubId, sectionId, true);
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(round));
        when(sectionAvailabilityWindowRepository.findByRoundId(roundId))
                .thenReturn(List.of(SectionAvailabilityWindow.builder().id(windowId).roundId(roundId).build()));

        service.delete(authentication, clubId, roundId);

        org.mockito.InOrder order =
                org.mockito.Mockito.inOrder(matchSquadMemberRepository, sectionAvailabilityRoundRepository);
        order.verify(matchSquadMemberRepository).deleteBySectionAvailabilityWindowIdIn(List.of(windowId));
        order.verify(sectionAvailabilityRoundRepository).delete(round);
    }

    @Test
    void deleteRemovesChildrenFirstThenTheRound() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        UUID windowId = UUID.randomUUID();
        SectionAvailabilityRound round = round(roundId, clubId, sectionId, true);
        when(sectionAvailabilityRoundRepository.findById(roundId)).thenReturn(Optional.of(round));
        when(sectionAvailabilityWindowRepository.findByRoundId(roundId))
                .thenReturn(List.of(SectionAvailabilityWindow.builder().id(windowId).roundId(roundId).build()));

        service.delete(authentication, clubId, roundId);

        verify(accessService).assertCanAdministerSection(authentication, clubId, sectionId);
        org.mockito.InOrder order = org.mockito.Mockito.inOrder(
                matchSquadMemberRepository,
                sectionAvailabilityResponseRepository,
                sectionAvailabilityWindowMatchRepository,
                sectionAvailabilityWindowRepository,
                sectionAvailabilityRoundRepository);
        order.verify(matchSquadMemberRepository).deleteBySectionAvailabilityWindowIdIn(List.of(windowId));
        order.verify(sectionAvailabilityResponseRepository).deleteByWindowIdIn(List.of(windowId));
        order.verify(sectionAvailabilityWindowMatchRepository).deleteByWindowIdIn(List.of(windowId));
        order.verify(sectionAvailabilityWindowRepository).deleteByRoundId(roundId);
        order.verify(sectionAvailabilityRoundRepository).delete(round);
    }

    @Test
    void deleteReturns404WhenRoundBelongsToADifferentClub() {
        UUID roundId = UUID.randomUUID();
        when(sectionAvailabilityRoundRepository.findById(roundId))
                .thenReturn(Optional.of(round(roundId, UUID.randomUUID(), UUID.randomUUID(), true)));

        assertThatThrownBy(() -> service.delete(authentication, UUID.randomUUID(), roundId))
                .isInstanceOf(NotFoundException.class);
        verify(sectionAvailabilityRoundRepository, never()).delete(any());
    }

    @Test
    void closeDueAutoClosePollsClosesTheRoundAndEveryOneOfItsWindows() {
        Instant now = Instant.parse("2026-09-26T10:00:00Z");
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound due = round(roundId, UUID.randomUUID(), UUID.randomUUID(), true);
        SectionAvailabilityWindow w1 = SectionAvailabilityWindow.builder().id(UUID.randomUUID()).roundId(roundId).open(true).build();
        SectionAvailabilityWindow w2 = SectionAvailabilityWindow.builder().id(UUID.randomUUID()).roundId(roundId).open(true).build();
        when(sectionAvailabilityRoundRepository.findDueForAutoClose(now)).thenReturn(List.of(due));
        when(sectionAvailabilityWindowRepository.findByRoundId(roundId)).thenReturn(List.of(w1, w2));

        int closed = service.closeDueAutoClosePolls(now);

        assertThat(closed).isEqualTo(1);
        assertThat(due.isOpen()).isFalse();
        assertThat(w1.isOpen()).isFalse();
        assertThat(w2.isOpen()).isFalse();
        verify(sectionAvailabilityWindowRepository).save(w1);
        verify(sectionAvailabilityWindowRepository).save(w2);
    }

    // --- 066: close time ---

    private static final Instant FAR_KICKOFF = Instant.now().plus(30, ChronoUnit.DAYS);

    /** A round with one window covering two matches; the earliest kicks off at FAR_KICKOFF. */
    private SectionAvailabilityRound roundWithWindowsAndMatches(UUID clubId, UUID roundId, boolean open) {
        UUID sectionId = UUID.randomUUID();
        UUID windowId = UUID.randomUUID();
        UUID earlyMatchId = UUID.randomUUID();
        UUID lateMatchId = UUID.randomUUID();
        SectionAvailabilityRound round = round(roundId, clubId, sectionId, open);
        round.setScheduledCloseAt(Instant.now().minusSeconds(3600));
        SectionAvailabilityWindow window = SectionAvailabilityWindow.builder()
                .id(windowId).roundId(roundId).sectionId(sectionId).dayPart(DayPart.MORNING).open(open).build();
        org.mockito.Mockito.lenient().when(sectionAvailabilityRoundRepository.findById(roundId))
                .thenReturn(Optional.of(round));
        org.mockito.Mockito.lenient()
                .when(sectionAvailabilityRoundRepository.save(any(SectionAvailabilityRound.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        org.mockito.Mockito.lenient().when(sectionAvailabilityWindowRepository.findByRoundId(roundId))
                .thenReturn(List.of(window));
        org.mockito.Mockito.lenient().when(sectionAvailabilityWindowRepository.findByRoundIdIn(any()))
                .thenReturn(List.of(window));
        org.mockito.Mockito.lenient().when(sectionAvailabilityWindowRepository.save(any(SectionAvailabilityWindow.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        org.mockito.Mockito.lenient().when(sectionAvailabilityWindowMatchRepository.findByWindowIdIn(any()))
                .thenReturn(List.of(
                        SectionAvailabilityWindowMatch.builder().windowId(windowId).matchId(lateMatchId).build(),
                        SectionAvailabilityWindowMatch.builder().windowId(windowId).matchId(earlyMatchId).build()));
        org.mockito.Mockito.lenient().when(matchRepository.findAllById(any())).thenReturn(List.of(
                Match.builder().id(lateMatchId).matchDate(FAR_KICKOFF.plus(1, ChronoUnit.DAYS)).build(),
                Match.builder().id(earlyMatchId).matchDate(FAR_KICKOFF).build()));
        org.mockito.Mockito.lenient().when(sectionAvailabilityWindowMatchRepository.findByWindowId(any()))
                .thenReturn(List.of());
        org.mockito.Mockito.lenient().when(audienceResolver.resolveAudience(sectionId)).thenReturn(List.of());
        org.mockito.Mockito.lenient().when(sectionRepository.findById(sectionId))
                .thenReturn(Optional.of(section(clubId, sectionId)));
        org.mockito.Mockito.lenient().when(sectionAvailabilityRoundMapper.toDto(any(), any(), any(), any(), anyBoolean()))
                .thenAnswer(invocation -> {
                    SectionAvailabilityRound r = invocation.getArgument(0);
                    return new SectionAvailabilityRoundDto(
                            r.getId(), r.getSectionId(), null, r.getDescription(), r.getFirstMatchDate(),
                            r.getLastMatchDate(), r.isAutoClose(), r.getScheduledCloseAt(),
                            invocation.getArgument(2), r.isOpen(), List.of(), invocation.getArgument(4));
                });
        return round;
    }

    @Test
    void updateCloseTimeSavesAValidTimeOnAnOpenRoundAndKeepsItOpen() {
        UUID clubId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound round = roundWithWindowsAndMatches(clubId, roundId, true);
        Instant closeAt = FAR_KICKOFF.minus(2, ChronoUnit.DAYS);

        SectionAvailabilityRoundDto dto = service.updateCloseTime(
                authentication, clubId, roundId, new UpdatePollCloseTimeRequest(true, closeAt));

        verify(accessService).assertCanAdministerSection(authentication, clubId, round.getSectionId());
        assertThat(round.isAutoClose()).isTrue();
        assertThat(round.getScheduledCloseAt()).isEqualTo(closeAt);
        assertThat(round.isOpen()).isTrue();
        assertThat(dto.scheduledCloseAt()).isEqualTo(closeAt);
        assertThat(dto.firstMatchKickoff()).isEqualTo(FAR_KICKOFF);
    }

    @Test
    void updateCloseTimeAllowsATimeEqualToTheEarliestKickoffAcrossAllWindows() {
        UUID clubId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound round = roundWithWindowsAndMatches(clubId, roundId, true);

        service.updateCloseTime(authentication, clubId, roundId, new UpdatePollCloseTimeRequest(true, FAR_KICKOFF));

        assertThat(round.getScheduledCloseAt()).isEqualTo(FAR_KICKOFF);
    }

    @Test
    void updateCloseTimeWithAutoCloseFalseClearsTheTime() {
        UUID clubId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound round = roundWithWindowsAndMatches(clubId, roundId, true);

        service.updateCloseTime(
                authentication,
                clubId,
                roundId,
                new UpdatePollCloseTimeRequest(false, FAR_KICKOFF.minus(1, ChronoUnit.DAYS)));

        assertThat(round.isAutoClose()).isFalse();
        assertThat(round.getScheduledCloseAt()).isNull();
    }

    @Test
    void updateCloseTimeRejectsAPastTime() {
        UUID clubId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound round = roundWithWindowsAndMatches(clubId, roundId, true);
        Instant before = round.getScheduledCloseAt();

        assertThatThrownBy(() -> service.updateCloseTime(
                        authentication,
                        clubId,
                        roundId,
                        new UpdatePollCloseTimeRequest(true, Instant.now().minusSeconds(5))))
                .isInstanceOf(InvalidCloseTimeException.class)
                .hasMessage("Choose a closing time in the future.");
        assertThat(round.getScheduledCloseAt()).isEqualTo(before);
        verify(sectionAvailabilityRoundRepository, never()).save(any());
    }

    @Test
    void updateCloseTimeRejectsATimeAfterTheEarliestKickoff() {
        UUID clubId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        roundWithWindowsAndMatches(clubId, roundId, true);

        assertThatThrownBy(() -> service.updateCloseTime(
                        authentication,
                        clubId,
                        roundId,
                        new UpdatePollCloseTimeRequest(true, FAR_KICKOFF.plusSeconds(1))))
                .isInstanceOf(InvalidCloseTimeException.class)
                .hasMessage("Choose a closing time before the first match starts.");
    }

    @Test
    void updateCloseTimeRejectsAutoCloseOnWithoutATime() {
        UUID clubId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        roundWithWindowsAndMatches(clubId, roundId, true);

        assertThatThrownBy(() -> service.updateCloseTime(
                        authentication, clubId, roundId, new UpdatePollCloseTimeRequest(true, null)))
                .isInstanceOf(InvalidCloseTimeException.class)
                .hasMessage("A closing time is required when Autoclose is on.");
    }

    @Test
    void updateCloseTimeOnAClosedRoundKeepsItClosedAndThenOpenSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound round = roundWithWindowsAndMatches(clubId, roundId, false);
        assertThatThrownBy(() -> service.open(authentication, clubId, roundId))
                .isInstanceOf(com.cricketlegend.exception.ReopenWindowPassedException.class);

        service.updateCloseTime(
                authentication,
                clubId,
                roundId,
                new UpdatePollCloseTimeRequest(true, Instant.now().plus(2, ChronoUnit.HOURS)));
        assertThat(round.isOpen()).isFalse();

        service.open(authentication, clubId, roundId);
        assertThat(round.isOpen()).isTrue();
    }

    @Test
    void updateCloseTimeReturns404WhenTheRoundBelongsToADifferentClub() {
        UUID roundId = UUID.randomUUID();
        roundWithWindowsAndMatches(UUID.randomUUID(), roundId, true);

        assertThatThrownBy(() -> service.updateCloseTime(
                        authentication,
                        UUID.randomUUID(),
                        roundId,
                        new UpdatePollCloseTimeRequest(true, FAR_KICKOFF.minus(1, ChronoUnit.DAYS))))
                .isInstanceOf(NotFoundException.class);
        verify(sectionAvailabilityRoundRepository, never()).save(any());
    }

    private SectionAvailabilityRound createRoundWithScheduledCloseAt(boolean autoClose, Instant scheduledCloseAt) {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        Team team = flexibleTeam(teamId, sectionId, "U15 Colts");
        Match match = Match.builder()
                .id(matchId).clubId(clubId).homeTeamId(teamId).awayTeamName("Occasionals")
                .matchDate(FAR_KICKOFF).build();
        when(sectionRepository.findById(sectionId)).thenReturn(Optional.of(section(clubId, sectionId)));
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(teamRepository.findById(teamId)).thenReturn(Optional.of(team));
        when(matchResolver.resolveWindowKey(team, match))
                .thenReturn(new SectionAvailabilityMatchResolver.WindowKey(
                        sectionId, java.time.LocalDate.of(2026, 9, 26), DayPart.MORNING));
        org.mockito.Mockito.lenient()
                .when(sectionAvailabilityWindowRepository.existsBySectionIdAndWindowDateAndDayPart(any(), any(), any()))
                .thenReturn(false);
        org.mockito.Mockito.lenient()
                .when(sectionAvailabilityRoundRepository.save(any(SectionAvailabilityRound.class)))
                .thenAnswer(invocation -> {
                    SectionAvailabilityRound saved = invocation.getArgument(0);
                    saved.setId(UUID.randomUUID());
                    return saved;
                });
        org.mockito.Mockito.lenient()
                .when(sectionAvailabilityWindowRepository.save(any(SectionAvailabilityWindow.class)))
                .thenAnswer(invocation -> {
                    SectionAvailabilityWindow saved = invocation.getArgument(0);
                    saved.setId(UUID.randomUUID());
                    return saved;
                });
        org.mockito.Mockito.lenient()
                .when(sectionAvailabilityWindowMatchRepository.save(any(SectionAvailabilityWindowMatch.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        org.mockito.Mockito.lenient().when(audienceResolver.resolveAudience(sectionId)).thenReturn(List.of());
        org.mockito.Mockito.lenient().when(sectionAvailabilityWindowRepository.findByRoundId(any()))
                .thenReturn(List.of());
        org.mockito.Mockito.lenient().when(sectionAvailabilityRoundMapper.toDto(any(), any(), any(), any(), anyBoolean()))
                .thenReturn(null);

        service.create(
                authentication,
                clubId,
                new CreateSectionAvailabilityRoundRequest(
                        sectionId, "Fixtures", List.of(matchId), autoClose, scheduledCloseAt));

        ArgumentCaptor<SectionAvailabilityRound> captor = ArgumentCaptor.forClass(SectionAvailabilityRound.class);
        verify(sectionAvailabilityRoundRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void createWithAnExplicitScheduledCloseAtStoresIt() {
        Instant closeAt = FAR_KICKOFF.minus(3, ChronoUnit.DAYS);

        SectionAvailabilityRound saved = createRoundWithScheduledCloseAt(true, closeAt);

        assertThat(saved.getScheduledCloseAt()).isEqualTo(closeAt);
    }

    @Test
    void createWithoutScheduledCloseAtKeepsTheTwentyFourHourDefault() {
        SectionAvailabilityRound saved = createRoundWithScheduledCloseAt(true, null);

        assertThat(saved.getScheduledCloseAt()).isEqualTo(FAR_KICKOFF.minus(24, ChronoUnit.HOURS));
    }

    @Test
    void createWithAutoCloseFalseIgnoresAScheduledCloseAt() {
        SectionAvailabilityRound saved =
                createRoundWithScheduledCloseAt(false, FAR_KICKOFF.minus(3, ChronoUnit.DAYS));

        assertThat(saved.isAutoClose()).isFalse();
        assertThat(saved.getScheduledCloseAt()).isNull();
    }

    @Test
    void createWithAPastScheduledCloseAtThrowsInvalidCloseTimeAndSavesNothing() {
        assertThatThrownBy(() -> createRoundWithScheduledCloseAt(true, Instant.now().minusSeconds(60)))
                .isInstanceOf(InvalidCloseTimeException.class)
                .hasMessage("Choose a closing time in the future.");
        verify(sectionAvailabilityRoundRepository, never()).save(any());
    }

    @Test
    void createWithAScheduledCloseAtAfterTheEarliestKickoffThrowsInvalidCloseTime() {
        assertThatThrownBy(() -> createRoundWithScheduledCloseAt(true, FAR_KICKOFF.plusSeconds(1)))
                .isInstanceOf(InvalidCloseTimeException.class)
                .hasMessage("Choose a closing time before the first match starts.");
    }

    @Test
    void listComputesFirstMatchKickoffForAllRoundsWithOneBatchedWalk() {
        UUID clubId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        SectionAvailabilityRound r1 = round(UUID.randomUUID(), clubId, sectionId, true);
        SectionAvailabilityRound r2 = round(UUID.randomUUID(), clubId, sectionId, true);
        SectionAvailabilityWindow w1 = SectionAvailabilityWindow.builder().id(UUID.randomUUID())
                .roundId(r1.getId()).sectionId(sectionId).dayPart(DayPart.MORNING).open(true).build();
        SectionAvailabilityWindow w2 = SectionAvailabilityWindow.builder().id(UUID.randomUUID())
                .roundId(r2.getId()).sectionId(sectionId).dayPart(DayPart.MORNING).open(true).build();
        UUID m1 = UUID.randomUUID();
        UUID m1b = UUID.randomUUID();
        UUID m2 = UUID.randomUUID();
        when(sectionAvailabilityRoundRepository.findByClubId(clubId)).thenReturn(List.of(r1, r2));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(sectionAvailabilityWindowRepository.findByRoundIdIn(any())).thenReturn(List.of(w1, w2));
        when(sectionAvailabilityWindowRepository.findByRoundId(any())).thenReturn(List.of());
        when(sectionAvailabilityWindowMatchRepository.findByWindowIdIn(any())).thenReturn(List.of(
                SectionAvailabilityWindowMatch.builder().windowId(w1.getId()).matchId(m1).build(),
                SectionAvailabilityWindowMatch.builder().windowId(w1.getId()).matchId(m1b).build(),
                SectionAvailabilityWindowMatch.builder().windowId(w2.getId()).matchId(m2).build()));
        Instant early = Instant.parse("2026-10-10T09:00:00Z");
        when(matchRepository.findAllById(any())).thenReturn(List.of(
                Match.builder().id(m1).matchDate(early.plusSeconds(7200)).build(),
                Match.builder().id(m1b).matchDate(early).build(),
                Match.builder().id(m2).matchDate(early.plusSeconds(86400)).build()));
        stubEmptyBracketsFor(sectionId);

        List<SectionAvailabilityRoundDto> result = service.list(authentication, clubId, null, null, null, null, null);

        assertThat(result).extracting(SectionAvailabilityRoundDto::firstMatchKickoff)
                .containsExactly(early, early.plusSeconds(86400));
        verify(sectionAvailabilityWindowRepository, times(1)).findByRoundIdIn(any());
        verify(matchRepository, times(1)).findAllById(any());
    }

    // --- 082: manual reopen refused once the latest match started more than 24 hours ago ---

    private static final Instant NOW_082 = Instant.parse("2026-10-07T12:00:00Z");

    private SectionAvailabilityRoundServiceImpl serviceAt(Instant now) {
        return new SectionAvailabilityRoundServiceImpl(
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
                matchSquadMemberRepository,
                coverageService,
                accessService,
                pollFilters(),
                java.time.Clock.fixed(now, java.time.ZoneOffset.UTC));
    }

    /**
     * A closed round with one window per entry of {@code matchStartsPerWindow}; a window whose list
     * is empty has no match and sits on {@code matchlessDate}.
     */
    private SectionAvailabilityRound closedRoundWithWindows(
            UUID clubId, UUID roundId, boolean autoClose, Instant scheduledCloseAt,
            java.time.LocalDate matchlessDate, List<List<Instant>> matchStartsPerWindow) {
        UUID sectionId = UUID.randomUUID();
        SectionAvailabilityRound closed = round(roundId, clubId, sectionId, false);
        closed.setAutoClose(autoClose);
        closed.setScheduledCloseAt(scheduledCloseAt);
        List<SectionAvailabilityWindow> windows = new java.util.ArrayList<>();
        List<SectionAvailabilityWindowMatch> windowMatches = new java.util.ArrayList<>();
        List<Match> matches = new java.util.ArrayList<>();
        for (List<Instant> starts : matchStartsPerWindow) {
            SectionAvailabilityWindow window = SectionAvailabilityWindow.builder()
                    .id(UUID.randomUUID()).roundId(roundId).sectionId(sectionId).dayPart(DayPart.MORNING)
                    .windowDate(matchlessDate).open(false).build();
            windows.add(window);
            for (Instant start : starts) {
                UUID matchId = UUID.randomUUID();
                matches.add(Match.builder().id(matchId).matchDate(start).build());
                windowMatches.add(
                        SectionAvailabilityWindowMatch.builder().windowId(window.getId()).matchId(matchId).build());
            }
        }
        org.mockito.Mockito.lenient().when(sectionAvailabilityRoundRepository.findById(roundId))
                .thenReturn(Optional.of(closed));
        org.mockito.Mockito.lenient().when(sectionAvailabilityRoundRepository.findByClubId(clubId))
                .thenReturn(List.of(closed));
        org.mockito.Mockito.lenient().when(accessService.accessibleSectionIds(authentication, clubId))
                .thenReturn(Optional.empty());
        org.mockito.Mockito.lenient()
                .when(sectionAvailabilityRoundRepository.save(any(SectionAvailabilityRound.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        org.mockito.Mockito.lenient().when(sectionAvailabilityWindowRepository.findByRoundId(roundId))
                .thenReturn(windows);
        org.mockito.Mockito.lenient().when(sectionAvailabilityWindowRepository.findByRoundIdIn(any()))
                .thenReturn(windows);
        org.mockito.Mockito.lenient().when(sectionAvailabilityWindowMatchRepository.findByWindowIdIn(any()))
                .thenReturn(windowMatches);
        org.mockito.Mockito.lenient().when(matchRepository.findAllById(any())).thenReturn(matches);
        org.mockito.Mockito.lenient().doReturn(Optional.of(section(UUID.randomUUID(), sectionId)))
                .when(sectionRepository).findById(sectionId);
        org.mockito.Mockito.lenient().doReturn(List.of()).when(audienceResolver).resolveAudience(sectionId);
        org.mockito.Mockito.lenient().doAnswer(invocation -> {
            SectionAvailabilityRound r = invocation.getArgument(0);
            return new SectionAvailabilityRoundDto(
                    r.getId(), r.getSectionId(), null, r.getDescription(), r.getFirstMatchDate(),
                    r.getLastMatchDate(), r.isAutoClose(), r.getScheduledCloseAt(),
                    invocation.getArgument(2), r.isOpen(), List.of(), invocation.getArgument(4));
        }).when(sectionAvailabilityRoundMapper).toDto(any(), any(), any(), any(), anyBoolean());
        return closed;
    }

    private static final java.time.LocalDate LONG_AGO = java.time.LocalDate.of(2026, 1, 1);

    @Test
    void openThrowsWhenTheLatestMatchOfTheRoundStartedMoreThan24HoursAgo() {
        UUID clubId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound closed = closedRoundWithWindows(clubId, roundId, false, null, LONG_AGO,
                List.of(List.of(NOW_082.minus(25, ChronoUnit.HOURS), NOW_082.minus(5, ChronoUnit.DAYS))));

        assertThatThrownBy(() -> serviceAt(NOW_082).open(authentication, clubId, roundId))
                .isInstanceOf(com.cricketlegend.exception.ReopenWindowPassedException.class)
                .hasMessage("This poll can no longer be reopened because its matches are in the past.");
        assertThat(closed.isOpen()).isFalse();
        verify(sectionAvailabilityRoundRepository, never()).save(any(SectionAvailabilityRound.class));
    }

    @Test
    void openUsesTheLatestMatchAcrossAllWindowsOfTheRound() {
        UUID clubId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound closed = closedRoundWithWindows(clubId, roundId, false, null, LONG_AGO,
                List.of(List.of(NOW_082.minus(9, ChronoUnit.DAYS)), List.of(NOW_082.minus(3, ChronoUnit.HOURS))));

        SectionAvailabilityRoundDto dto = serviceAt(NOW_082).open(authentication, clubId, roundId);

        assertThat(closed.isOpen()).isTrue();
        assertThat(dto.canReopen()).isTrue();
    }

    @Test
    void openStillWorksAtTheEdgeAndForFutureMatches() {
        for (Instant start : List.of(NOW_082.minus(24, ChronoUnit.HOURS), NOW_082.plus(2, ChronoUnit.DAYS))) {
            UUID clubId = UUID.randomUUID();
            UUID roundId = UUID.randomUUID();
            SectionAvailabilityRound closed =
                    closedRoundWithWindows(clubId, roundId, false, null, LONG_AGO, List.of(List.of(start)));

            serviceAt(NOW_082).open(authentication, clubId, roundId);

            assertThat(closed.isOpen()).as("match at %s", start).isTrue();
        }
    }

    @Test
    void aWindowWithoutAMatchFallsBackToTheEndOfItsDate() {
        java.time.ZoneId zone = java.time.ZoneId.systemDefault();
        Instant now = java.time.LocalDate.of(2026, 10, 7).atTime(12, 0).atZone(zone).toInstant();
        UUID clubId = UUID.randomUUID();
        UUID refusedId = UUID.randomUUID();
        closedRoundWithWindows(clubId, refusedId, false, null, java.time.LocalDate.of(2026, 10, 4), List.of(List.of()));
        assertThatThrownBy(() -> serviceAt(now).open(authentication, clubId, refusedId))
                .isInstanceOf(com.cricketlegend.exception.ReopenWindowPassedException.class);

        UUID allowedId = UUID.randomUUID();
        SectionAvailabilityRound allowed = closedRoundWithWindows(
                clubId, allowedId, false, null, java.time.LocalDate.of(2026, 10, 6), List.of(List.of()));
        serviceAt(now).open(authentication, clubId, allowedId);
        assertThat(allowed.isOpen()).isTrue();
    }

    @Test
    void theAutoCloseRuleStillAppliesToARoundWithFutureMatches() {
        UUID clubId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        SectionAvailabilityRound closed = closedRoundWithWindows(clubId, roundId, true,
                NOW_082.minusSeconds(1), LONG_AGO, List.of(List.of(NOW_082.plus(2, ChronoUnit.DAYS))));

        assertThatThrownBy(() -> serviceAt(NOW_082).open(authentication, clubId, roundId))
                .isInstanceOf(com.cricketlegend.exception.ReopenWindowPassedException.class)
                .hasMessageContaining("automatic close time");
        assertThat(closed.isOpen()).isFalse();
    }

    @Test
    void listedRoundsCarryCanReopenFromBothRules() {
        UUID clubId = UUID.randomUUID();
        UUID roundId = UUID.randomUUID();
        closedRoundWithWindows(clubId, roundId, false, null, LONG_AGO,
                List.of(List.of(NOW_082.minus(3, ChronoUnit.DAYS))));
        assertThat(serviceAt(NOW_082).list(authentication, clubId, null, null, null, null, false))
                .extracting(SectionAvailabilityRoundDto::canReopen).containsExactly(false);

        UUID recentId = UUID.randomUUID();
        closedRoundWithWindows(clubId, recentId, false, null, LONG_AGO,
                List.of(List.of(NOW_082.minus(3, ChronoUnit.HOURS))));
        assertThat(serviceAt(NOW_082).list(authentication, clubId, null, null, null, null, false))
                .extracting(SectionAvailabilityRoundDto::canReopen).containsExactly(true);

        UUID autoClosedId = UUID.randomUUID();
        closedRoundWithWindows(clubId, autoClosedId, true, NOW_082.minusSeconds(60), LONG_AGO,
                List.of(List.of(NOW_082.minus(3, ChronoUnit.HOURS))));
        assertThat(serviceAt(NOW_082).list(authentication, clubId, null, null, null, null, false))
                .extracting(SectionAvailabilityRoundDto::canReopen).containsExactly(false);
    }
}
