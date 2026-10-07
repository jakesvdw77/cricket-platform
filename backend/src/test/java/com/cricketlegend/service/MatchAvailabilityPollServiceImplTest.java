package com.cricketlegend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cricketlegend.config.AccessService;
import com.cricketlegend.domain.AvailabilityStatus;
import com.cricketlegend.domain.Match;
import com.cricketlegend.domain.MatchAvailabilityPoll;
import com.cricketlegend.domain.PlayerAvailability;
import com.cricketlegend.domain.Team;
import com.cricketlegend.dto.CreateMatchAvailabilityPollRequest;
import com.cricketlegend.dto.MatchAvailabilityPollResponsesDto;
import com.cricketlegend.dto.OpenAvailabilityPollDto;
import com.cricketlegend.dto.PlayerAvailabilityRowDto;
import com.cricketlegend.exception.ConflictException;
import com.cricketlegend.dto.UpdatePollCloseTimeRequest;
import com.cricketlegend.exception.InvalidCloseTimeException;
import com.cricketlegend.exception.InvalidStatusTransitionException;
import com.cricketlegend.exception.NotFoundException;
import com.cricketlegend.exception.MatchAlreadyPolledException;
import com.cricketlegend.exception.ValidationException;
import com.cricketlegend.mapper.MatchAvailabilityPollMapper;
import com.cricketlegend.repository.MatchAvailabilityPollRepository;
import com.cricketlegend.repository.MatchRepository;
import com.cricketlegend.repository.PlayerAvailabilityRepository;
import com.cricketlegend.service.MatchPollCoverageService;
import com.cricketlegend.service.impl.MatchAvailabilityPollServiceImpl;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
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
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/**
 * Unit tests for MatchAvailabilityPollServiceImpl's business rules from
 * docs/specs/032-match-availability-polls.md: {@code create} restricted to the match's own two
 * team ids (400) and rejecting a duplicate {@code (match, team)} poll (409); {@code open}/{@code
 * close} transitions and their {@code InvalidStatusTransitionException} (409) "already in that
 * state" guards; {@code getResponses} resolving the full season-scoped squad with correct counts,
 * including zero-response members. Extended per docs/specs/035-section-scoped-access.md for
 * {@code assertCanAdministerAnySection} being consulted on every existing method, and per
 * docs/specs/034-availability-polls-dashboard.md/035's amendment for {@code listOpenForClub}.
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
    private MatchPollCoverageService coverageService;

    @Mock
    private AvailabilityPollSquadResolver squadResolver;

    @Mock
    private MatchAvailabilityPollMapper matchAvailabilityPollMapper;

    @Mock
    private AccessService accessService;

    private MatchAvailabilityPollServiceImpl service;
    private final Authentication authentication = new TestingAuthenticationToken(
            "club-admin-subject", null, List.of(new SimpleGrantedAuthority("ROLE_someone_else")));

    @BeforeEach
    void setUp() {
        service = new MatchAvailabilityPollServiceImpl(
                matchRepository,
                matchAvailabilityPollRepository,
                playerAvailabilityRepository,
                coverageService,
                squadResolver,
                matchAvailabilityPollMapper,
                accessService,
                java.time.Clock.systemUTC());
    }

    @BeforeEach
    void defaultNoCoverage() {
        org.mockito.Mockito.lenient()
                .when(coverageService.resolve(any(), any()))
                .thenReturn(MatchPollCoverageService.Coverage.NONE);
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

        service.create(authentication, clubId, matchId, new CreateMatchAvailabilityPollRequest(homeTeamId, null, null));

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

        assertThatThrownBy(() -> service.create(
                        authentication, clubId, matchId, new CreateMatchAvailabilityPollRequest(unrelatedTeamId, null, null)))
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

        assertThatThrownBy(() -> service.create(
                        authentication, clubId, matchId, new CreateMatchAvailabilityPollRequest(homeTeamId, null, null)))
                .isInstanceOf(ConflictException.class);

        verify(matchAvailabilityPollRepository, never()).save(any());
    }

    /** docs/specs/064: a match already covered by a group poll cannot also get a squad poll. */
    @Test
    void createReturns409WhenTheMatchIsAlreadyCoveredByAGroupPoll() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID homeTeamId = UUID.randomUUID();
        UUID awayTeamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, homeTeamId, awayTeamId, seasonId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(coverageService.resolve(matchId, homeTeamId))
                .thenReturn(new MatchPollCoverageService.Coverage(
                        MatchPollCoverageService.Kind.GROUP, null, UUID.randomUUID(), UUID.randomUUID(), "Sat 3 Oct"));

        assertThatThrownBy(() -> service.create(
                        authentication, clubId, matchId, new CreateMatchAvailabilityPollRequest(homeTeamId, null, null)))
                .isInstanceOf(MatchAlreadyPolledException.class)
                .hasMessageContaining("Sat 3 Oct");

        verify(matchAvailabilityPollRepository, never()).save(any());
    }

    @Test
    void createReturns404WhenMatchBelongsToADifferentClub() {
        UUID matchId = UUID.randomUUID();
        Match match = match(UUID.randomUUID(), matchId, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));

        assertThatThrownBy(() -> service.create(
                        authentication,
                        UUID.randomUUID(),
                        matchId,
                        new CreateMatchAvailabilityPollRequest(UUID.randomUUID(), null, null)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void createThrowsAccessDeniedWhenCallerCannotAdministerAnyOfTheMatchsResolvedSections() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID homeTeamId = UUID.randomUUID();
        UUID awayTeamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, homeTeamId, awayTeamId, seasonId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        Set<UUID> resolvedSections = Set.of(UUID.randomUUID());
        when(accessService.resolveMatchSectionIds(clubId, homeTeamId, awayTeamId)).thenReturn(resolvedSections);
        org.mockito.Mockito.doThrow(new org.springframework.security.access.AccessDeniedException("denied"))
                .when(accessService)
                .assertCanAdministerAnySection(authentication, clubId, resolvedSections);

        assertThatThrownBy(() -> service.create(
                        authentication, clubId, matchId, new CreateMatchAvailabilityPollRequest(homeTeamId, null, null)))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(matchAvailabilityPollRepository, never()).save(any());
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

        service.open(authentication, clubId, matchId, pollId);

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

        assertThatThrownBy(() -> service.open(authentication, clubId, matchId, pollId))
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

        service.close(authentication, clubId, matchId, pollId);

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

        assertThatThrownBy(() -> service.close(authentication, clubId, matchId, pollId))
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

        assertThatThrownBy(() -> service.open(authentication, clubId, matchId, pollId))
                .isInstanceOf(NotFoundException.class);
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

        MatchAvailabilityPollResponsesDto responses = service.getResponses(authentication, clubId, matchId, pollId);

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
                .filteredOn(row -> row.playerProfileId().equals(playerC))
                .singleElement()
                .satisfies(row -> assertThat(row.status()).isNull());
    }

    // --- setPlayerStatus (admin override) ---

    @Test
    void setPlayerStatusInsertsANewResponseWhenNoneExistsYet() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));
        when(squadResolver.resolveSquadRows(teamId, seasonId))
                .thenReturn(List.of(new PlayerAvailabilityRowDto(playerId, "Jane", "Smith", null, null)));
        when(playerAvailabilityRepository.findByPollIdAndPlayerProfileId(pollId, playerId))
                .thenReturn(Optional.empty());
        when(playerAvailabilityRepository.findByPollId(pollId)).thenReturn(List.of());

        MatchAvailabilityPollResponsesDto result = service.setPlayerStatus(
                authentication, clubId, matchId, pollId, playerId, AvailabilityStatus.UNAVAILABLE);

        ArgumentCaptor<PlayerAvailability> captor = ArgumentCaptor.forClass(PlayerAvailability.class);
        verify(playerAvailabilityRepository).save(captor.capture());
        assertThat(captor.getValue().getPollId()).isEqualTo(pollId);
        assertThat(captor.getValue().getPlayerProfileId()).isEqualTo(playerId);
        assertThat(captor.getValue().getStatus()).isEqualTo(AvailabilityStatus.UNAVAILABLE);
        assertThat(result.pollId()).isEqualTo(pollId);
    }

    @Test
    void setPlayerStatusUpdatesInPlaceForARepeatCall() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        PlayerAvailability existing = PlayerAvailability.builder()
                .pollId(pollId).playerProfileId(playerId).status(AvailabilityStatus.UNSURE).build();
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));
        when(squadResolver.resolveSquadRows(teamId, seasonId))
                .thenReturn(List.of(new PlayerAvailabilityRowDto(playerId, "Jane", "Smith", null, null)));
        when(playerAvailabilityRepository.findByPollIdAndPlayerProfileId(pollId, playerId))
                .thenReturn(Optional.of(existing));
        when(playerAvailabilityRepository.findByPollId(pollId)).thenReturn(List.of());

        service.setPlayerStatus(authentication, clubId, matchId, pollId, playerId, AvailabilityStatus.AVAILABLE);

        verify(playerAvailabilityRepository).save(existing);
        assertThat(existing.getStatus()).isEqualTo(AvailabilityStatus.AVAILABLE);
    }

    @Test
    void setPlayerStatusRejectsAPlayerNotInThePollsOwnSquad() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(openPoll));
        when(squadResolver.resolveSquadRows(teamId, seasonId)).thenReturn(List.of());

        assertThatThrownBy(() -> service.setPlayerStatus(
                        authentication, clubId, matchId, pollId, playerId, AvailabilityStatus.AVAILABLE))
                .isInstanceOf(NotFoundException.class);
        verify(playerAvailabilityRepository, never()).save(any());
    }

    @Test
    void setPlayerStatusAcceptsAnAdminOverrideAgainstAClosedPollAndKeepsItClosed() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID playerId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll closedPoll = poll(pollId, matchId, teamId, false);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(closedPoll));
        when(squadResolver.resolveSquadRows(teamId, seasonId))
                .thenReturn(List.of(new PlayerAvailabilityRowDto(playerId, "Jane", "Smith", null, null)));
        when(playerAvailabilityRepository.findByPollIdAndPlayerProfileId(pollId, playerId))
                .thenReturn(Optional.empty());
        when(playerAvailabilityRepository.findByPollId(pollId)).thenReturn(List.of());

        service.setPlayerStatus(authentication, clubId, matchId, pollId, playerId, AvailabilityStatus.AVAILABLE);

        ArgumentCaptor<PlayerAvailability> captor = ArgumentCaptor.forClass(PlayerAvailability.class);
        verify(playerAvailabilityRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(AvailabilityStatus.AVAILABLE);
        assertThat(closedPoll.isOpen()).isFalse();
    }

    // --- listOpenForClub (034/035) ---

    @Test
    void listOpenForClubReturnsOneEntryPerOpenPollScopedToClub() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        match.setHomeTeamName(null);
        match.setAwayTeamName("Away Occasionals");
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchAvailabilityPollRepository.findOpenByMatchClubId(clubId)).thenReturn(List.of(openPoll));
        when(matchRepository.findAllById(Set.of(matchId))).thenReturn(List.of(match));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.resolveMatchSectionIds(clubId, match.getHomeTeamId(), match.getAwayTeamId()))
                .thenReturn(Set.of(UUID.randomUUID()));
        when(squadResolver.resolveSquadRows(teamId, seasonId)).thenReturn(List.of());

        List<OpenAvailabilityPollDto> result = service.listOpenForClub(authentication, clubId, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).pollId()).isEqualTo(pollId);
        assertThat(result.get(0).matchId()).isEqualTo(matchId);
    }

    @Test
    void listOpenForClubExcludesAClosedPollAndReturnsEmptyListNotAnErrorWhenNoneOpen() {
        UUID clubId = UUID.randomUUID();
        when(matchAvailabilityPollRepository.findOpenByMatchClubId(clubId)).thenReturn(List.of());
        when(matchRepository.findAllById(Set.of())).thenReturn(List.of());
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());

        assertThat(service.listOpenForClub(authentication, clubId, null)).isEmpty();
    }

    @Test
    void listOpenForClubBucketsRespondentsByStatusExcludingNullStatusFromAllThreeBuckets() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID available = UUID.randomUUID();
        UUID unavailable = UUID.randomUUID();
        UUID unsure = UUID.randomUUID();
        UUID noResponse = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchAvailabilityPollRepository.findOpenByMatchClubId(clubId)).thenReturn(List.of(openPoll));
        when(matchRepository.findAllById(Set.of(matchId))).thenReturn(List.of(match));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.resolveMatchSectionIds(clubId, match.getHomeTeamId(), match.getAwayTeamId()))
                .thenReturn(Set.of(UUID.randomUUID()));
        when(squadResolver.resolveSquadRows(teamId, seasonId)).thenReturn(List.of(
                new PlayerAvailabilityRowDto(available, "Alice", "A", null, null),
                new PlayerAvailabilityRowDto(unavailable, "Bob", "B", null, null),
                new PlayerAvailabilityRowDto(unsure, "Cara", "C", null, null),
                new PlayerAvailabilityRowDto(noResponse, "Dee", "D", null, null)));
        when(playerAvailabilityRepository.findByPollId(pollId)).thenReturn(List.of(
                PlayerAvailability.builder().pollId(pollId).playerProfileId(available)
                        .status(AvailabilityStatus.AVAILABLE).build(),
                PlayerAvailability.builder().pollId(pollId).playerProfileId(unavailable)
                        .status(AvailabilityStatus.UNAVAILABLE).build(),
                PlayerAvailability.builder().pollId(pollId).playerProfileId(unsure)
                        .status(AvailabilityStatus.UNSURE).build()));

        OpenAvailabilityPollDto dto = service.listOpenForClub(authentication, clubId, null).get(0);

        assertThat(dto.availableCount()).isEqualTo(1);
        assertThat(dto.unavailableCount()).isEqualTo(1);
        assertThat(dto.unsureCount()).isEqualTo(1);
        assertThat(dto.noResponseCount()).isEqualTo(1);
        assertThat(dto.availableRespondents()).extracting("playerProfileId").containsExactly(available);
        assertThat(dto.unavailableRespondents()).extracting("playerProfileId").containsExactly(unavailable);
        assertThat(dto.unsureRespondents()).extracting("playerProfileId").containsExactly(unsure);
    }

    @Test
    void listOpenForClubSortsByMatchDateAscending() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID laterMatchId = UUID.randomUUID();
        UUID soonerMatchId = UUID.randomUUID();
        Instant now = Instant.now();
        Match laterMatch = match(clubId, laterMatchId, teamId, UUID.randomUUID(), seasonId);
        laterMatch.setMatchDate(now.plus(5, ChronoUnit.DAYS));
        Match soonerMatch = match(clubId, soonerMatchId, teamId, UUID.randomUUID(), seasonId);
        soonerMatch.setMatchDate(now.plus(1, ChronoUnit.DAYS));
        MatchAvailabilityPoll laterPoll = poll(UUID.randomUUID(), laterMatchId, teamId, true);
        MatchAvailabilityPoll soonerPoll = poll(UUID.randomUUID(), soonerMatchId, teamId, true);
        when(matchAvailabilityPollRepository.findOpenByMatchClubId(clubId))
                .thenReturn(List.of(laterPoll, soonerPoll));
        when(matchRepository.findAllById(Set.of(laterMatchId, soonerMatchId)))
                .thenReturn(List.of(laterMatch, soonerMatch));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.resolveMatchSectionIds(eq(clubId), any(), any())).thenReturn(Set.of(UUID.randomUUID()));
        when(squadResolver.resolveSquadRows(eq(teamId), eq(seasonId))).thenReturn(List.of());

        List<OpenAvailabilityPollDto> result = service.listOpenForClub(authentication, clubId, null);

        assertThat(result).extracting(OpenAvailabilityPollDto::matchId)
                .containsExactly(soonerMatchId, laterMatchId);
    }

    // 070: a league-team side has no teamId, so it never gets a poll and is shown by its copied name.
    @Test
    void createForALeagueTeamSideIsRejectedAndNoPollIsSaved() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID ownTeamId = UUID.randomUUID();
        UUID leagueTeamId = UUID.randomUUID();
        Match match = match(clubId, matchId, ownTeamId, null, UUID.randomUUID());
        match.setAwayTeamName("Hillside CC");
        match.setAwayLeagueTeamId(leagueTeamId);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));

        assertThatThrownBy(() -> service.create(
                        authentication, clubId, matchId, new CreateMatchAvailabilityPollRequest(leagueTeamId, null, null)))
                .isInstanceOf(ValidationException.class);

        verify(matchAvailabilityPollRepository, never()).save(any());
    }

    @Test
    void listOpenForClubShowsALeagueTeamOpponentByItsCopiedNameWithNoTeamId() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, null, seasonId);
        match.setAwayTeamName("Hillside CC");
        match.setAwayLeagueTeamId(UUID.randomUUID());
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchAvailabilityPollRepository.findOpenByMatchClubId(clubId)).thenReturn(List.of(openPoll));
        when(matchRepository.findAllById(Set.of(matchId))).thenReturn(List.of(match));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.resolveMatchSectionIds(clubId, teamId, null)).thenReturn(Set.of(UUID.randomUUID()));
        when(squadResolver.resolveSquadRows(teamId, seasonId)).thenReturn(List.of());

        OpenAvailabilityPollDto dto = service.listOpenForClub(authentication, clubId, null).get(0);

        assertThat(dto.awayTeamId()).isNull();
        assertThat(dto.awayTeamName()).isEqualTo("Hillside CC");
        assertThat(dto.homeTeamId()).isEqualTo(teamId);
    }

    @Test
    void listOpenForClubExcludesAPollWhoseMatchIsOutsideTheCallersAccessibleSections() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        UUID matchSectionId = UUID.randomUUID();
        UUID accessibleSectionId = UUID.randomUUID();
        when(matchAvailabilityPollRepository.findOpenByMatchClubId(clubId)).thenReturn(List.of(openPoll));
        when(matchRepository.findAllById(Set.of(matchId))).thenReturn(List.of(match));
        when(accessService.accessibleSectionIds(authentication, clubId))
                .thenReturn(Optional.of(Set.of(accessibleSectionId)));
        when(accessService.resolveMatchSectionIds(clubId, match.getHomeTeamId(), match.getAwayTeamId()))
                .thenReturn(Set.of(matchSectionId));

        assertThat(service.listOpenForClub(authentication, clubId, null)).isEmpty();
    }

    @Test
    void listOpenForClubNarrowsToAnExplicitSectionIdsClosureAfterValidatingIt() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID filterSectionId = UUID.randomUUID();
        UUID matchSectionId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll openPoll = poll(pollId, matchId, teamId, true);
        when(matchAvailabilityPollRepository.findOpenByMatchClubId(clubId)).thenReturn(List.of(openPoll));
        when(matchRepository.findAllById(Set.of(matchId))).thenReturn(List.of(match));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.sectionAndDescendantIds(clubId, filterSectionId))
                .thenReturn(Set.of(filterSectionId, matchSectionId));
        when(accessService.resolveMatchSectionIds(clubId, match.getHomeTeamId(), match.getAwayTeamId()))
                .thenReturn(Set.of(matchSectionId));
        when(squadResolver.resolveSquadRows(teamId, seasonId)).thenReturn(List.of());

        List<OpenAvailabilityPollDto> result = service.listOpenForClub(authentication, clubId, filterSectionId);

        verify(accessService).assertCanAdministerSection(authentication, clubId, filterSectionId);
        assertThat(result).hasSize(1);
    }

    // --- 064: GET /availability-polls/closed ---

    @Test
    void listClosedForClubReturnsPollsInRepositoryOrderMostRecentFirst() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID newerMatchId = UUID.randomUUID();
        UUID olderMatchId = UUID.randomUUID();
        Match newer = match(clubId, newerMatchId, teamId, UUID.randomUUID(), seasonId);
        Match older = match(clubId, olderMatchId, teamId, UUID.randomUUID(), seasonId);
        when(matchAvailabilityPollRepository.findClosedByMatchClubId(clubId))
                .thenReturn(List.of(
                        poll(UUID.randomUUID(), newerMatchId, teamId, false),
                        poll(UUID.randomUUID(), olderMatchId, teamId, false)));
        when(matchRepository.findAllById(any())).thenReturn(List.of(older, newer));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.resolveMatchSectionIds(eq(clubId), any(), any())).thenReturn(Set.of(UUID.randomUUID()));
        when(squadResolver.resolveSquadRows(eq(teamId), eq(seasonId))).thenReturn(List.of());

        List<OpenAvailabilityPollDto> result = service.listClosedForClub(authentication, clubId, null);

        assertThat(result).extracting(OpenAvailabilityPollDto::matchId).containsExactly(newerMatchId, olderMatchId);
    }

    @Test
    void listClosedForClubIsCappedAtTheFiftyMostRecentPolls() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        List<MatchAvailabilityPoll> polls = new ArrayList<>();
        List<Match> matches = new ArrayList<>();
        for (int i = 0; i < 60; i++) {
            UUID matchId = UUID.randomUUID();
            matches.add(match(clubId, matchId, teamId, UUID.randomUUID(), seasonId));
            polls.add(poll(UUID.randomUUID(), matchId, teamId, false));
        }
        when(matchAvailabilityPollRepository.findClosedByMatchClubId(clubId)).thenReturn(polls);
        when(matchRepository.findAllById(any())).thenReturn(matches);
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.resolveMatchSectionIds(eq(clubId), any(), any())).thenReturn(Set.of(UUID.randomUUID()));
        when(squadResolver.resolveSquadRows(eq(teamId), eq(seasonId))).thenReturn(List.of());

        List<OpenAvailabilityPollDto> result = service.listClosedForClub(authentication, clubId, null);

        assertThat(result).hasSize(MatchAvailabilityPollServiceImpl.CLOSED_POLLS_LIMIT);
        assertThat(result).extracting(OpenAvailabilityPollDto::pollId)
                .containsExactlyElementsOf(polls.subList(0, 50).stream().map(MatchAvailabilityPoll::getId).toList());
    }

    @Test
    void listClosedForClubNarrowsToTheSectionAfterValidatingItAndTheCapAppliesAfterNarrowing() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID filterSectionId = UUID.randomUUID();
        UUID inSection = UUID.randomUUID();
        UUID otherSection = UUID.randomUUID();
        UUID otherMatchId = UUID.randomUUID();
        UUID inMatchId = UUID.randomUUID();
        Match otherMatch = match(clubId, otherMatchId, UUID.randomUUID(), UUID.randomUUID(), seasonId);
        Match inMatch = match(clubId, inMatchId, teamId, UUID.randomUUID(), seasonId);
        when(matchAvailabilityPollRepository.findClosedByMatchClubId(clubId))
                .thenReturn(List.of(
                        poll(UUID.randomUUID(), otherMatchId, otherMatch.getHomeTeamId(), false),
                        poll(UUID.randomUUID(), inMatchId, teamId, false)));
        when(matchRepository.findAllById(any())).thenReturn(List.of(otherMatch, inMatch));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.sectionAndDescendantIds(clubId, filterSectionId))
                .thenReturn(Set.of(filterSectionId, inSection));
        when(accessService.resolveMatchSectionIds(clubId, otherMatch.getHomeTeamId(), otherMatch.getAwayTeamId()))
                .thenReturn(Set.of(otherSection));
        when(accessService.resolveMatchSectionIds(clubId, inMatch.getHomeTeamId(), inMatch.getAwayTeamId()))
                .thenReturn(Set.of(inSection));
        when(squadResolver.resolveSquadRows(teamId, seasonId)).thenReturn(List.of());

        List<OpenAvailabilityPollDto> result = service.listClosedForClub(authentication, clubId, filterSectionId);

        verify(accessService).assertCanAdministerSection(authentication, clubId, filterSectionId);
        assertThat(result).extracting(OpenAvailabilityPollDto::matchId).containsExactly(inMatchId);
    }

    // --- 064: manual reopen allowed only until the automatic close time ---

    private MatchAvailabilityPoll closedPollWithSchedule(
            UUID clubId, UUID matchId, UUID teamId, UUID pollId, boolean autoClose, Instant scheduledCloseAt) {
        UUID seasonId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), seasonId);
        MatchAvailabilityPoll closedPoll = poll(pollId, matchId, teamId, false);
        closedPoll.setAutoClose(autoClose);
        closedPoll.setScheduledCloseAt(scheduledCloseAt);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(closedPoll));
        org.mockito.Mockito.lenient()
                .when(matchAvailabilityPollRepository.save(any(MatchAvailabilityPoll.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        org.mockito.Mockito.lenient()
                .when(squadResolver.resolveSquadRows(eq(teamId), eq(seasonId)))
                .thenReturn(List.of());
        return closedPoll;
    }

    @Test
    void openBeforeTheScheduledCloseTimeSucceedsAndKeepsTheSchedule() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        Instant closeAt = Instant.now().plus(2, ChronoUnit.HOURS);
        MatchAvailabilityPoll poll = closedPollWithSchedule(clubId, matchId, UUID.randomUUID(), pollId, true, closeAt);

        service.open(authentication, clubId, matchId, pollId);

        assertThat(poll.isOpen()).isTrue();
        assertThat(poll.getScheduledCloseAt()).isEqualTo(closeAt);
    }

    @Test
    void openAtOrAfterTheScheduledCloseTimeThrowsReopenWindowPassed() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        MatchAvailabilityPoll poll = closedPollWithSchedule(
                clubId, matchId, UUID.randomUUID(), pollId, true, Instant.now().minusSeconds(1));

        assertThatThrownBy(() -> service.open(authentication, clubId, matchId, pollId))
                .isInstanceOf(com.cricketlegend.exception.ReopenWindowPassedException.class);
        assertThat(poll.isOpen()).isFalse();
        verify(matchAvailabilityPollRepository, never()).save(any(MatchAvailabilityPoll.class));
    }

    @Test
    void openIsAlwaysAllowedWhenAutoCloseIsOff() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        MatchAvailabilityPoll poll =
                closedPollWithSchedule(clubId, matchId, UUID.randomUUID(), pollId, false, null);

        service.open(authentication, clubId, matchId, pollId);

        assertThat(poll.isOpen()).isTrue();
    }

    // --- 082: manual reopen refused once the match started more than 24 hours ago ---

    private static final Instant NOW_082 = Instant.parse("2026-10-07T12:00:00Z");

    private MatchAvailabilityPollServiceImpl serviceAt(Instant now) {
        return new MatchAvailabilityPollServiceImpl(
                matchRepository,
                matchAvailabilityPollRepository,
                playerAvailabilityRepository,
                coverageService,
                squadResolver,
                matchAvailabilityPollMapper,
                accessService,
                java.time.Clock.fixed(now, java.time.ZoneOffset.UTC));
    }

    private MatchAvailabilityPoll closedPollWithMatchAt(
            UUID clubId, UUID matchId, UUID pollId, Instant matchDate, boolean autoClose, Instant scheduledCloseAt) {
        MatchAvailabilityPoll poll =
                closedPollWithSchedule(clubId, matchId, UUID.randomUUID(), pollId, autoClose, scheduledCloseAt);
        matchRepository.findById(matchId).orElseThrow().setMatchDate(matchDate);
        return poll;
    }

    @Test
    void openThrowsWhenTheMatchStartedMoreThan24HoursAgo() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        MatchAvailabilityPoll poll = closedPollWithMatchAt(
                clubId, matchId, pollId, NOW_082.minus(25, ChronoUnit.HOURS), false, null);

        assertThatThrownBy(() -> serviceAt(NOW_082).open(authentication, clubId, matchId, pollId))
                .isInstanceOf(com.cricketlegend.exception.ReopenWindowPassedException.class)
                .hasMessage("This poll can no longer be reopened because its matches are in the past.");
        assertThat(poll.isOpen()).isFalse();
        verify(matchAvailabilityPollRepository, never()).save(any(MatchAvailabilityPoll.class));
    }

    @Test
    void openStillWorksInsideTheGraceAtTheEdgeAndForAFutureMatch() {
        for (Instant matchDate : List.of(
                NOW_082.minus(23, ChronoUnit.HOURS), NOW_082.minus(24, ChronoUnit.HOURS),
                NOW_082.plus(2, ChronoUnit.DAYS))) {
            UUID clubId = UUID.randomUUID();
            UUID matchId = UUID.randomUUID();
            UUID pollId = UUID.randomUUID();
            MatchAvailabilityPoll poll = closedPollWithMatchAt(clubId, matchId, pollId, matchDate, false, null);

            serviceAt(NOW_082).open(authentication, clubId, matchId, pollId);

            assertThat(poll.isOpen()).as("match at %s", matchDate).isTrue();
        }
    }

    @Test
    void theAutoCloseRuleStillAppliesInsideTheGrace() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        MatchAvailabilityPoll poll = closedPollWithMatchAt(
                clubId, matchId, pollId, NOW_082.minus(1, ChronoUnit.HOURS), true, NOW_082.minusSeconds(1));

        assertThatThrownBy(() -> serviceAt(NOW_082).open(authentication, clubId, matchId, pollId))
                .isInstanceOf(com.cricketlegend.exception.ReopenWindowPassedException.class)
                .hasMessageContaining("automatic close time");
        assertThat(poll.isOpen()).isFalse();
    }

    @Test
    void listedPollsCarryCanReopenFromBothRules() {
        UUID clubId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        UUID seasonId = UUID.randomUUID();
        UUID pastMatchId = UUID.randomUUID();
        UUID recentMatchId = UUID.randomUUID();
        UUID autoClosedMatchId = UUID.randomUUID();
        Match past = match(clubId, pastMatchId, teamId, UUID.randomUUID(), seasonId);
        past.setMatchDate(NOW_082.minus(3, ChronoUnit.DAYS));
        Match recent = match(clubId, recentMatchId, teamId, UUID.randomUUID(), seasonId);
        recent.setMatchDate(NOW_082.minus(2, ChronoUnit.HOURS));
        Match autoClosed = match(clubId, autoClosedMatchId, teamId, UUID.randomUUID(), seasonId);
        autoClosed.setMatchDate(NOW_082.minus(2, ChronoUnit.HOURS));
        MatchAvailabilityPoll pastPoll = poll(UUID.randomUUID(), pastMatchId, teamId, false);
        pastPoll.setAutoClose(false);
        MatchAvailabilityPoll recentPoll = poll(UUID.randomUUID(), recentMatchId, teamId, false);
        recentPoll.setAutoClose(false);
        MatchAvailabilityPoll autoClosedPoll = poll(UUID.randomUUID(), autoClosedMatchId, teamId, false);
        autoClosedPoll.setAutoClose(true);
        autoClosedPoll.setScheduledCloseAt(NOW_082.minus(1, ChronoUnit.DAYS));
        when(matchAvailabilityPollRepository.findClosedByMatchClubId(clubId))
                .thenReturn(List.of(pastPoll, recentPoll, autoClosedPoll));
        when(matchRepository.findAllById(any())).thenReturn(List.of(past, recent, autoClosed));
        when(accessService.accessibleSectionIds(authentication, clubId)).thenReturn(Optional.empty());
        when(accessService.resolveMatchSectionIds(any(), any(), any())).thenReturn(Set.of());
        when(squadResolver.resolveSquadRows(any(), any())).thenReturn(List.of());

        List<OpenAvailabilityPollDto> result = serviceAt(NOW_082).listClosedForClub(authentication, clubId, null);

        assertThat(result).extracting(OpenAvailabilityPollDto::matchId, OpenAvailabilityPollDto::canReopen)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple(pastMatchId, false),
                        org.assertj.core.groups.Tuple.tuple(recentMatchId, true),
                        org.assertj.core.groups.Tuple.tuple(autoClosedMatchId, false));
    }

    // --- 064: autoClose / scheduledCloseAt ---

    private MatchAvailabilityPoll createAndCapture(Instant matchDate, Boolean autoClose) {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID homeTeamId = UUID.randomUUID();
        Match match = match(clubId, matchId, homeTeamId, UUID.randomUUID(), UUID.randomUUID());
        match.setMatchDate(matchDate);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.save(any(MatchAvailabilityPoll.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(squadResolver.resolveSquadRows(any(), any())).thenReturn(List.of());

        service.create(authentication, clubId, matchId, new CreateMatchAvailabilityPollRequest(homeTeamId, autoClose, null));

        ArgumentCaptor<MatchAvailabilityPoll> captor = ArgumentCaptor.forClass(MatchAvailabilityPoll.class);
        verify(matchAvailabilityPollRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void createWithAutoCloseTrueSchedulesCloseTwentyFourHoursBeforeKickoff() {
        Instant kickoff = Instant.parse("2026-10-10T09:00:00Z");
        MatchAvailabilityPoll saved = createAndCapture(kickoff, true);
        assertThat(saved.isAutoClose()).isTrue();
        assertThat(saved.getScheduledCloseAt()).isEqualTo(Instant.parse("2026-10-09T09:00:00Z"));
    }

    @Test
    void createWithAutoCloseFalseLeavesScheduledCloseAtNull() {
        MatchAvailabilityPoll saved = createAndCapture(Instant.parse("2026-10-10T09:00:00Z"), false);
        assertThat(saved.isAutoClose()).isFalse();
        assertThat(saved.getScheduledCloseAt()).isNull();
    }

    @Test
    void createDefaultsAutoCloseToOnWhenTheFieldIsAbsent() {
        MatchAvailabilityPoll saved = createAndCapture(Instant.parse("2026-10-10T09:00:00Z"), null);
        assertThat(saved.isAutoClose()).isTrue();
        assertThat(saved.getScheduledCloseAt()).isEqualTo(Instant.parse("2026-10-09T09:00:00Z"));
    }

    // --- 064: delete ---

    @Test
    void deleteRemovesTheResponsesBeforeThePoll() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        UUID teamId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        MatchAvailabilityPoll poll = poll(pollId, matchId, teamId, true);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(poll));

        service.delete(authentication, clubId, matchId, pollId);

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(playerAvailabilityRepository, matchAvailabilityPollRepository);
        order.verify(playerAvailabilityRepository).deleteByPollId(pollId);
        order.verify(matchAvailabilityPollRepository).delete(poll);
    }

    @Test
    void deleteReturns404WhenThePollBelongsToADifferentMatch() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        Match match = match(clubId, matchId, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        when(matchAvailabilityPollRepository.findById(pollId))
                .thenReturn(Optional.of(poll(pollId, UUID.randomUUID(), UUID.randomUUID(), true)));

        assertThatThrownBy(() -> service.delete(authentication, clubId, matchId, pollId))
                .isInstanceOf(NotFoundException.class);
        verify(matchAvailabilityPollRepository, never()).delete(any());
        verify(playerAvailabilityRepository, never()).deleteByPollId(any());
    }

    @Test
    void deleteReturns404WhenTheMatchBelongsToADifferentClub() {
        UUID matchId = UUID.randomUUID();
        Match match = match(UUID.randomUUID(), matchId, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));

        assertThatThrownBy(() -> service.delete(authentication, UUID.randomUUID(), matchId, UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
        verify(matchAvailabilityPollRepository, never()).delete(any());
    }

    // --- 064: auto-close ---

    @Test
    void closeDueAutoClosePollsClosesEachDuePollAndReturnsTheCount() {
        Instant now = Instant.parse("2026-10-09T10:00:00Z");
        MatchAvailabilityPoll a = poll(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), true);
        MatchAvailabilityPoll b = poll(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), true);
        when(matchAvailabilityPollRepository.findDueForAutoClose(now)).thenReturn(List.of(a, b));

        int closed = service.closeDueAutoClosePolls(now);

        assertThat(closed).isEqualTo(2);
        assertThat(a.isOpen()).isFalse();
        assertThat(b.isOpen()).isFalse();
        verify(matchAvailabilityPollRepository).save(a);
        verify(matchAvailabilityPollRepository).save(b);
    }

    @Test
    void closeDueAutoClosePollsReturnsZeroWhenNothingIsDue() {
        Instant now = Instant.now();
        when(matchAvailabilityPollRepository.findDueForAutoClose(now)).thenReturn(List.of());
        assertThat(service.closeDueAutoClosePolls(now)).isZero();
        verify(matchAvailabilityPollRepository, never()).save(any());
    }

    // --- 066: close time (create with scheduledCloseAt, updateCloseTime) ---

    private static final Instant FAR_KICKOFF = Instant.now().plus(30, ChronoUnit.DAYS);

    private MatchAvailabilityPoll createWithScheduledCloseAt(Boolean autoClose, Instant scheduledCloseAt) {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID homeTeamId = UUID.randomUUID();
        Match match = match(clubId, matchId, homeTeamId, UUID.randomUUID(), UUID.randomUUID());
        match.setMatchDate(FAR_KICKOFF);
        when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        org.mockito.Mockito.lenient()
                .when(matchAvailabilityPollRepository.save(any(MatchAvailabilityPoll.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        org.mockito.Mockito.lenient().when(squadResolver.resolveSquadRows(any(), any())).thenReturn(List.of());

        service.create(
                authentication,
                clubId,
                matchId,
                new CreateMatchAvailabilityPollRequest(homeTeamId, autoClose, scheduledCloseAt));

        ArgumentCaptor<MatchAvailabilityPoll> captor = ArgumentCaptor.forClass(MatchAvailabilityPoll.class);
        verify(matchAvailabilityPollRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void createWithAnExplicitScheduledCloseAtStoresIt() {
        Instant closeAt = FAR_KICKOFF.minus(3, ChronoUnit.DAYS);

        MatchAvailabilityPoll saved = createWithScheduledCloseAt(true, closeAt);

        assertThat(saved.isAutoClose()).isTrue();
        assertThat(saved.getScheduledCloseAt()).isEqualTo(closeAt);
    }

    @Test
    void createWithoutScheduledCloseAtKeepsTheTwentyFourHourDefault() {
        MatchAvailabilityPoll saved = createWithScheduledCloseAt(true, null);

        assertThat(saved.getScheduledCloseAt()).isEqualTo(FAR_KICKOFF.minus(24, ChronoUnit.HOURS));
    }

    @Test
    void createWithAutoCloseFalseIgnoresAScheduledCloseAt() {
        MatchAvailabilityPoll saved = createWithScheduledCloseAt(false, FAR_KICKOFF.minus(3, ChronoUnit.DAYS));

        assertThat(saved.isAutoClose()).isFalse();
        assertThat(saved.getScheduledCloseAt()).isNull();
    }

    @Test
    void createWithAPastScheduledCloseAtThrowsInvalidCloseTime() {
        assertThatThrownBy(() -> createWithScheduledCloseAt(true, Instant.now().minusSeconds(60)))
                .isInstanceOf(InvalidCloseTimeException.class)
                .hasMessage("Choose a closing time in the future.");
        verify(matchAvailabilityPollRepository, never()).save(any());
    }

    @Test
    void createWithAScheduledCloseAtAfterKickoffThrowsInvalidCloseTime() {
        assertThatThrownBy(() -> createWithScheduledCloseAt(true, FAR_KICKOFF.plusSeconds(1)))
                .isInstanceOf(InvalidCloseTimeException.class)
                .hasMessage("Choose a closing time before the first match starts.");
    }

    private MatchAvailabilityPoll pollForCloseTimeEdit(UUID clubId, UUID matchId, UUID pollId, boolean open) {
        UUID teamId = UUID.randomUUID();
        Match match = match(clubId, matchId, teamId, UUID.randomUUID(), UUID.randomUUID());
        match.setMatchDate(FAR_KICKOFF);
        MatchAvailabilityPoll poll = poll(pollId, matchId, teamId, open);
        poll.setAutoClose(true);
        poll.setScheduledCloseAt(Instant.now().minusSeconds(3600));
        org.mockito.Mockito.lenient().when(matchRepository.findById(matchId)).thenReturn(Optional.of(match));
        org.mockito.Mockito.lenient().when(matchAvailabilityPollRepository.findById(pollId)).thenReturn(Optional.of(poll));
        org.mockito.Mockito.lenient()
                .when(matchAvailabilityPollRepository.save(any(MatchAvailabilityPoll.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        org.mockito.Mockito.lenient().when(squadResolver.resolveSquadRows(any(), any())).thenReturn(List.of());
        return poll;
    }

    @Test
    void updateCloseTimeSavesAValidTimeOnAnOpenPollAndKeepsItOpen() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        MatchAvailabilityPoll poll = pollForCloseTimeEdit(clubId, matchId, pollId, true);
        Instant closeAt = FAR_KICKOFF.minus(2, ChronoUnit.DAYS);

        service.updateCloseTime(
                authentication, clubId, matchId, pollId, new UpdatePollCloseTimeRequest(true, closeAt));

        assertThat(poll.isAutoClose()).isTrue();
        assertThat(poll.getScheduledCloseAt()).isEqualTo(closeAt);
        assertThat(poll.isOpen()).isTrue();
        verify(matchAvailabilityPollRepository).save(poll);
    }

    @Test
    void updateCloseTimeWithAutoCloseFalseClearsTheTimeEvenIfOneIsSent() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        MatchAvailabilityPoll poll = pollForCloseTimeEdit(clubId, matchId, pollId, true);

        service.updateCloseTime(
                authentication,
                clubId,
                matchId,
                pollId,
                new UpdatePollCloseTimeRequest(false, FAR_KICKOFF.minus(1, ChronoUnit.DAYS)));

        assertThat(poll.isAutoClose()).isFalse();
        assertThat(poll.getScheduledCloseAt()).isNull();
    }

    @Test
    void updateCloseTimeRejectsAPastTime() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        MatchAvailabilityPoll poll = pollForCloseTimeEdit(clubId, matchId, pollId, true);
        Instant before = poll.getScheduledCloseAt();

        assertThatThrownBy(() -> service.updateCloseTime(
                        authentication,
                        clubId,
                        matchId,
                        pollId,
                        new UpdatePollCloseTimeRequest(true, Instant.now().minusSeconds(5))))
                .isInstanceOf(InvalidCloseTimeException.class)
                .hasMessage("Choose a closing time in the future.");
        assertThat(poll.getScheduledCloseAt()).isEqualTo(before);
        verify(matchAvailabilityPollRepository, never()).save(any());
    }

    @Test
    void updateCloseTimeRejectsATimeAfterKickoff() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        pollForCloseTimeEdit(clubId, matchId, pollId, true);

        assertThatThrownBy(() -> service.updateCloseTime(
                        authentication,
                        clubId,
                        matchId,
                        pollId,
                        new UpdatePollCloseTimeRequest(true, FAR_KICKOFF.plusSeconds(1))))
                .isInstanceOf(InvalidCloseTimeException.class)
                .hasMessage("Choose a closing time before the first match starts.");
    }

    @Test
    void updateCloseTimeRejectsAutoCloseOnWithoutATime() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        pollForCloseTimeEdit(clubId, matchId, pollId, true);

        assertThatThrownBy(() -> service.updateCloseTime(
                        authentication, clubId, matchId, pollId, new UpdatePollCloseTimeRequest(true, null)))
                .isInstanceOf(InvalidCloseTimeException.class)
                .hasMessage("A closing time is required when Autoclose is on.");
    }

    @Test
    void updateCloseTimeOnAClosedPollKeepsItClosedAndThenOpenSucceeds() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        MatchAvailabilityPoll poll = pollForCloseTimeEdit(clubId, matchId, pollId, false);
        // Reopen is refused while the old close time is in the past.
        assertThatThrownBy(() -> service.open(authentication, clubId, matchId, pollId))
                .isInstanceOf(com.cricketlegend.exception.ReopenWindowPassedException.class);

        service.updateCloseTime(
                authentication,
                clubId,
                matchId,
                pollId,
                new UpdatePollCloseTimeRequest(true, Instant.now().plus(2, ChronoUnit.HOURS)));
        assertThat(poll.isOpen()).isFalse();

        service.open(authentication, clubId, matchId, pollId);
        assertThat(poll.isOpen()).isTrue();
    }

    @Test
    void updateCloseTimeReturns404WhenTheMatchBelongsToADifferentClub() {
        UUID clubId = UUID.randomUUID();
        UUID matchId = UUID.randomUUID();
        UUID pollId = UUID.randomUUID();
        pollForCloseTimeEdit(UUID.randomUUID(), matchId, pollId, true);

        assertThatThrownBy(() -> service.updateCloseTime(
                        authentication,
                        clubId,
                        matchId,
                        pollId,
                        new UpdatePollCloseTimeRequest(true, FAR_KICKOFF.minus(1, ChronoUnit.DAYS))))
                .isInstanceOf(NotFoundException.class);
        verify(matchAvailabilityPollRepository, never()).save(any());
    }
}
